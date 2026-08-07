import { NextRequest } from "next/server";

// challenges-v1 is served by the platform hosts, like spectator — not the regional clusters.
const PLATFORMS = [
	"br1", "eun1", "euw1", "jp1", "kr", "la1", "la2", "me1",
	"na1", "oc1", "ru", "sg2", "tr1", "tw2", "vn2",
] as const;

// puuid is interpolated into a URL path, so it gets shape-checked before use.
const PUUID_RE = /^[A-Za-z0-9_-]{70,110}$/;

function getHeaders() {
	const token = process.env.RIOT_API_TOKEN;
	if (!token) {
		throw new Error("RIOT_API_TOKEN environment variable is not set");
	}
	return { "X-Riot-Token": token };
}

function json(body: unknown, status = 200) {
	return new Response(JSON.stringify(body), {
		status,
		headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
	});
}

interface RawPlayerChallenge {
	challengeId: number;
	level?: string;
	value?: number;
	percentile?: number;
	achievedTime?: number;
	position?: number;
	playersInLevel?: number;
}

export async function GET(request: NextRequest) {
	const searchParams = request.nextUrl.searchParams;
	const gameName = searchParams.get("gameName");
	const tagLine = searchParams.get("tagLine");
	const platform = searchParams.get("platform") || "";
	const cachedPuuid = searchParams.get("puuid") || "";

	if (!PLATFORMS.includes(platform as (typeof PLATFORMS)[number])) {
		return json({ error: "Unknown region" }, 400);
	}

	try {
		let puuid = PUUID_RE.test(cachedPuuid) ? cachedPuuid : "";

		if (!puuid) {
			if (!gameName || !tagLine) {
				return json({ error: "Game name and tag line are required" }, 400);
			}
			const accountUrl = `https://europe.api.riotgames.com/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(gameName)}/${encodeURIComponent(tagLine)}`;
			const accountResponse = await fetch(accountUrl, { headers: getHeaders(), cache: "no-store" });

			// Riot answers 401 for a missing *or* expired key — dev keys die after 24h.
			if (accountResponse.status === 401) {
				return json({ error: "Riot API key rejected (401) — key expired, or the dev server still holds an old one (restart it)" }, 502);
			}
			if (accountResponse.status === 403) {
				return json({ error: "Riot API key has no access to this endpoint (403)" }, 502);
			}
			if (!accountResponse.ok) {
				return json({ error: "Account not found" }, 404);
			}
			puuid = (await accountResponse.json()).puuid;
		}

		const url = `https://${platform}.api.riotgames.com/lol/challenges/v1/player-data/${encodeURIComponent(puuid)}`;
		const response = await fetch(url, { headers: getHeaders(), cache: "no-store" });

		if (response.status === 404) {
			return json({ error: "No challenge data for this account in this region — check the region" }, 404);
		}
		if (response.status === 429) {
			return json({ error: "Rate limited by Riot — try again in a moment" }, 429);
		}
		if (!response.ok) {
			return json({ error: `Riot API error (${response.status})` }, 502);
		}

		const data = (await response.json()) as {
			totalPoints?: unknown;
			challenges?: RawPlayerChallenge[];
		};

		// Flatten to { [challengeId]: progress } so the client can look up its static defs directly.
		const challenges: Record<string, RawPlayerChallenge> = {};
		for (const c of data.challenges || []) {
			if (!c || typeof c.challengeId !== "number") continue;
			challenges[String(c.challengeId)] = {
				challengeId: c.challengeId,
				level: c.level || "NONE",
				value: c.value ?? 0,
				percentile: c.percentile,
				achievedTime: c.achievedTime,
				position: c.position,
				playersInLevel: c.playersInLevel,
			};
		}

		return json({ puuid, totalPoints: data.totalPoints ?? null, challenges });
	} catch (error) {
		console.error("Error fetching challenges:", error);
		return json({ error: "Internal server error" }, 500);
	}
}
