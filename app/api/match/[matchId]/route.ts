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

async function getMatchInfo(matchId: string, region?: string) {
	// If region is provided, use it directly
	if (region) {
		const RIOT_API_BASE = RIOT_API_REGIONS[region as keyof typeof RIOT_API_REGIONS];
		const url = `${RIOT_API_BASE}/lol/match/v5/matches/${matchId}`;
		
		const response = await fetch(url, { headers });
		const data = await response.json();

		if (response.ok) {
			return { success: true, data, region };
		}
		return { success: false, error: `Failed to fetch match info: ${response.status}` };
	}

	// Otherwise, try all regions to find the correct one
	const regions = ["americas", "europe", "asia", "sea"];
	
	for (const testRegion of regions) {
		const RIOT_API_BASE = RIOT_API_REGIONS[testRegion as keyof typeof RIOT_API_REGIONS];
		const url = `${RIOT_API_BASE}/lol/match/v5/matches/${matchId}`;
		
		const response = await fetch(url, { headers });
		const data = await response.json();

		if (response.ok) {
			return { success: true, data, region: testRegion };
		}
		
		// If not 404, it's a different error (rate limit, etc.) - continue trying other regions
		if (response.status !== 404) {
			// Continue to next region instead of returning error immediately
		}
	}

	return { success: false, error: "Match not found in any region" };
}

export async function GET(
	request: NextRequest,
	{ params }: { params: Promise<{ matchId: string }> }
) {
	const { matchId } = await params;

	if (!matchId) {
		return new Response(
			JSON.stringify({ error: "Match ID is required" }),
			{
				status: 400,
				headers: { "Content-Type": "application/json" },
			}
		);
	}

	try {
		const matchResult = await getMatchInfo(matchId);

		if (!matchResult.success) {
			return new Response(
				JSON.stringify({ error: matchResult.error }),
				{
					status: 404,
					headers: { "Content-Type": "application/json" },
				}
			);
		}

		// Extract only minimal data for caching
		const minimalMatchInfo = {
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

		return new Response(
			JSON.stringify({ matchInfo: minimalMatchInfo }),
			{
				status: 200,
				headers: { "Content-Type": "application/json" },
			}
		);
	} catch (error) {
		console.error("Error fetching match:", error);
		return new Response(
			JSON.stringify({ error: "Internal server error" }),
			{
				status: 500,
				headers: { "Content-Type": "application/json" },
			}
		);
	}
}

