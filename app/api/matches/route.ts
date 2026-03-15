import { NextRequest } from "next/server";

const RIOT_API_REGIONS = {
	europe: "https://europe.api.riotgames.com",
	americas: "https://americas.api.riotgames.com",
	asia: "https://asia.api.riotgames.com",
	sea: "https://sea.api.riotgames.com",
} as const;

const RIOT_TOKEN = process.env.RIOT_API_TOKEN;

if (!RIOT_TOKEN) {
	throw new Error("RIOT_API_TOKEN environment variable is not set");
}

const headers = {
	"X-Riot-Token": RIOT_TOKEN,
};

async function getAccount(gameName: string, tagLine: string) {
	const region = "europe";
	const RIOT_API_BASE = RIOT_API_REGIONS[region];
	const url = `${RIOT_API_BASE}/riot/account/v1/accounts/by-riot-id/${gameName}/${tagLine}`;
	
	const response = await fetch(url, { headers });
	const data = await response.json();

	if (response.ok) {
		return { success: true, data };
	}
	return { success: false, error: data.error || "Account not found" };
}

async function getMatchIds(puuid: string, start: number = 0, count: number = 100) {
	const regions = ["americas", "europe", "asia", "sea"];
	const queue = "1700"; // Arena queue
	let lastError: { status?: number; message?: string } | null = null;

	for (const region of regions) {
		try {
			const RIOT_API_BASE = RIOT_API_REGIONS[region as keyof typeof RIOT_API_REGIONS];
			const url = `${RIOT_API_BASE}/lol/match/v5/matches/by-puuid/${puuid}/ids?queue=${queue}&start=${start}&count=${count}`;
			
			const response = await fetch(url, { headers });

			if (response.ok) {
				const data = await response.json();
				if (Array.isArray(data)) {
					// If we found matches, return immediately
					if (data.length > 0) {
						console.log(`[API] matches - Found ${data.length} matches in region: ${region}`);
						return { success: true, data, region };
					}
					// Empty array - continue to next region
					console.log(`[API] matches - Empty array in region: ${region}, trying next region...`);
					continue;
				}
			}

			// Track error but continue to next region
			try {
				const errorData = await response.json();
				lastError = {
					status: response.status,
					message: typeof errorData === "object" && errorData !== null && "error" in errorData
						? String(errorData.error)
						: `HTTP ${response.status}`,
				};
			} catch {
				lastError = {
					status: response.status,
					message: `HTTP ${response.status}`,
				};
			}
			console.log(`[API] matches - Error in region ${region}: ${response.status}, trying next region...`);
		} catch (error) {
			console.log(`[API] matches - Exception in region: ${region}`, error);
			lastError = {
				message: error instanceof Error ? error.message : "Network error",
			};
		}
	}

	// If we got here, all regions returned empty arrays or errors
	// If all were empty arrays (no errors), return empty array
	if (!lastError) {
		console.log(`[API] matches - All regions returned empty arrays`);
		return { success: true, data: [], region: null };
	}

	// If we had errors, return the error
	console.log(`[API] matches - All regions failed`);
	const errorMessage = lastError.status
		? `Failed to fetch matches (${lastError.status}${lastError.message ? `: ${lastError.message}` : ""})`
		: lastError.message || "Failed to fetch matches from all regions";
	return { success: false, error: errorMessage };
}

interface MatchData {
	info: {
		gameStartTimestamp?: number;
		participants: Array<{
			puuid: string;
			championName: string;
			placement: number;
			riotIdGameName?: string;
			riotIdTagline?: string;
		}>;
	};
}

async function getMatchInfo(matchId: string, region?: string): Promise<{ success: true; data: MatchData; region: string } | { success: false; error: string }> {
	// If region is provided, use it directly (for subsequent matches after we've detected the region)
	if (region) {
		const RIOT_API_BASE = RIOT_API_REGIONS[region as keyof typeof RIOT_API_REGIONS];
		const url = `${RIOT_API_BASE}/lol/match/v5/matches/${matchId}`;
		
		const response = await fetch(url, { headers });
		const data = await response.json();

		if (response.ok) {
			return { success: true, data, region };
		}
		console.log(`[API] Failed to fetch match ${matchId} from known region ${region}: ${response.status}`);
		return { success: false, error: `Failed to fetch match info: ${response.status}` };
	}

	// Otherwise, try all regions to find the correct one (for the first match)
	const regions = ["americas", "europe", "asia", "sea"];
	console.log(`[API] Trying all regions for match ${matchId}...`);
	
	for (const testRegion of regions) {
		const RIOT_API_BASE = RIOT_API_REGIONS[testRegion as keyof typeof RIOT_API_REGIONS];
		const url = `${RIOT_API_BASE}/lol/match/v5/matches/${matchId}`;
		
		const response = await fetch(url, { headers });
		const data = await response.json();

		if (response.ok) {
			console.log(`[API] Found match ${matchId} in region: ${testRegion}`);
			return { success: true, data, region: testRegion };
		}
		
		// If not 404, it's a different error (rate limit, etc.) - continue trying other regions
		if (response.status !== 404) {
			console.log(`[API] Non-404 error fetching match ${matchId} from ${testRegion}: ${response.status}, trying next region...`);
			// Continue to next region instead of returning error immediately
		}
	}

	console.log(`[API] Match ${matchId} not found in any region (all returned 404)`);
	return { success: false, error: "Match not found in any region" };
}

export async function GET(request: NextRequest) {
	const searchParams = request.nextUrl.searchParams;
	const gameName = searchParams.get("gameName");
	const tagLine = searchParams.get("tagLine");
	const start = parseInt(searchParams.get("start") || "0", 10);
	const count = parseInt(searchParams.get("count") || "100", 10);
	const knownMatchIdsParam = searchParams.get("knownMatchIds") || "";
	const cachedMatchIdsParam = searchParams.get("cachedMatchIds") || "";

	if (!gameName || !tagLine) {
		return new Response(
			JSON.stringify({ error: "Game name and tag line are required" }),
			{
				status: 400,
				headers: { "Content-Type": "application/json" },
			}
		);
	}

	// Parse known and cached match IDs
	const knownMatchIds = knownMatchIdsParam ? knownMatchIdsParam.split(",").filter(Boolean) : [];
	const cachedMatchIds = cachedMatchIdsParam ? cachedMatchIdsParam.split(",").filter(Boolean) : [];

	// Create a readable stream for Server-Sent Events
	const stream = new ReadableStream({
		async start(controller) {
			const encoder = new TextEncoder();

			const sendEvent = (type: string, data: Record<string, unknown>) => {
				const message = `event: ${type}\ndata: ${JSON.stringify(data)}\n\n`;
				console.log(`[API] Sending SSE event: ${type}`, type === "match" ? { matchId: data.matchId, champion: data.champion, placement: data.placement } : data);
				controller.enqueue(encoder.encode(message));
			};

			try {
				// Step 1: Get account
				sendEvent("status", { message: "Looking up account..." });
				const accountResult = await getAccount(gameName, tagLine);
				
				if (!accountResult.success) {
					sendEvent("error", { error: accountResult.error });
					controller.close();
					return;
				}

				sendEvent("account", { data: accountResult.data });

				// Step 2: Fetch ALL match IDs in batches of 100 until we hit known ones or reach the end
				sendEvent("status", { message: "Fetching match IDs..." });
				
				const allMatchIds: string[] = [];
				let currentStart = start;
				let hasMore = true;
				let batchNumber = 0;
				let detectedRegion: string | undefined = undefined;

				while (hasMore) {
					const matchIdsResult = await getMatchIds(accountResult.data.puuid, currentStart, count);
					
					if (!matchIdsResult.success || !matchIdsResult.data) {
						if (allMatchIds.length === 0) {
							sendEvent("error", { error: matchIdsResult.error || "Failed to fetch matches" });
							controller.close();
							return;
						}
						// If we already have some matches, break and continue with what we have
						break;
					}

					const batchMatchIds = matchIdsResult.data;
					
					// Check if any of these IDs are already known
					const newIds = batchMatchIds.filter(id => !knownMatchIds.includes(id));
					
					if (newIds.length < batchMatchIds.length) {
						// We hit known matches, only add the new ones and stop
						allMatchIds.push(...newIds);
						hasMore = false;
						console.log(`[API] Hit known matches at batch ${batchNumber + 1}, found ${newIds.length} new matches`);
					} else if (batchMatchIds.length < count) {
						// Reached the end (got fewer than requested)
						allMatchIds.push(...batchMatchIds);
						hasMore = false;
						console.log(`[API] Reached end at batch ${batchNumber + 1}, got ${batchMatchIds.length} matches`);
					} else {
						// Keep going
						allMatchIds.push(...batchMatchIds);
						currentStart += count;
						batchNumber++;
						console.log(`[API] Batch ${batchNumber}: fetched ${batchMatchIds.length} matches, continuing...`);
					}

					// Send batch event
					sendEvent("matchIdBatch", {
						matchIds: batchMatchIds,
						batchNumber: batchNumber + 1,
						hasMore: hasMore && batchMatchIds.length === count,
					});
				}

				sendEvent("matchIds", { count: allMatchIds.length, hasMore: false });

				if (allMatchIds.length === 0) {
					sendEvent("complete", {});
					controller.close();
					return;
				}

				// Step 3: Filter to only fetch details for uncached matches
				const matchIdsNeedingDetails = allMatchIds.filter(id => !cachedMatchIds.includes(id));
				const totalNeedingDetails = matchIdsNeedingDetails.length;
				const alreadyCached = allMatchIds.length - totalNeedingDetails;

				if (alreadyCached > 0) {
					sendEvent("status", { message: `Skipping ${alreadyCached} already cached matches...` });
				}

				if (matchIdsNeedingDetails.length === 0) {
					sendEvent("status", { message: "All matches already cached!" });
					sendEvent("complete", {});
					controller.close();
					return;
				}

				// Step 4: Stream match details one by one for uncached matches
				sendEvent("status", { message: `Fetching ${matchIdsNeedingDetails.length} match details...` });
				
				let detailsFetched = 0;
				
				for (let i = 0; i < matchIdsNeedingDetails.length; i++) {
					const matchId = matchIdsNeedingDetails[i];
					sendEvent("status", { message: `Fetching match ${i + 1}/${matchIdsNeedingDetails.length}...` });
					
					// Send progress update
					sendEvent("progress", {
						totalIds: allMatchIds.length,
						detailsFetched: detailsFetched,
						pending: matchIdsNeedingDetails.length - i,
					});
					
					// For the first match, try all regions. For subsequent matches, use the detected region
					const matchResult = await getMatchInfo(matchId, detectedRegion);
					console.log(`[API] Match ${i + 1}/${matchIdsNeedingDetails.length} (${matchId}): success=${matchResult.success}`);
					
					if (matchResult.success) {
						// Store the region from the first successful match
						if (!detectedRegion && matchResult.region) {
							detectedRegion = matchResult.region;
							console.log(`[API] Detected region for matches: ${detectedRegion}`);
						}
						
						// Extract player's result from match
						const player = matchResult.data.info.participants.find(
							(p: { puuid: string; championName: string; placement: number }) => p.puuid === accountResult.data.puuid
						);
						
						console.log(`[API] Match ${i + 1}: player found=${!!player}, participants count=${matchResult.data.info.participants.length}`);
						
						if (player) {
							// Extract only minimal data for caching
							const minimalMatchInfo: MatchData = {
								info: {
									gameStartTimestamp: matchResult.data.info.gameStartTimestamp,
									participants: matchResult.data.info.participants.map((p: { puuid: string; championName: string; placement: number; riotIdGameName?: string; riotIdTagline?: string }) => ({
										puuid: p.puuid,
										championName: p.championName,
										placement: p.placement,
										riotIdGameName: p.riotIdGameName,
										riotIdTagline: p.riotIdTagline,
									})),
								},
							};
							const matchData = {
								matchId,
								champion: player.championName,
								placement: player.placement,
								matchInfo: minimalMatchInfo,
							};
							console.log(`[API] Sending match event:`, { matchId, champion: player.championName, placement: player.placement });
							sendEvent("match", matchData);
							detailsFetched++;
						} else {
							console.log(`[API] Match ${i + 1}: Player not found in participants. PUUID: ${accountResult.data.puuid.substring(0, 8)}...`);
						}
					} else {
						console.log(`[API] Match ${i + 1}: Failed to fetch match info`);
					}

					// Small delay to avoid rate limiting
					if (i < matchIdsNeedingDetails.length - 1) {
						await new Promise(resolve => setTimeout(resolve, 100));
					}
				}

				// Send final progress update
				sendEvent("progress", {
					totalIds: allMatchIds.length,
					detailsFetched: detailsFetched,
					pending: 0,
				});

				sendEvent("complete", {});
				controller.close();
			} catch (error) {
				console.error("Error in matches stream:", error);
				sendEvent("error", { error: "Internal server error" });
				controller.close();
			}
		},
	});

	return new Response(stream, {
		headers: {
			"Content-Type": "text/event-stream",
			"Cache-Control": "no-cache",
			"Connection": "keep-alive",
		},
	});
}
