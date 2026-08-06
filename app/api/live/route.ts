import { NextRequest } from "next/server";

// Spectator-v5 is served by platform hosts, not the regional clusters used elsewhere.
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

interface SpectatorParticipant {
	puuid: string;
	teamId: number;
	championId: number;
	riotId?: string;
	bot?: boolean;
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

		const spectatorUrl = `https://${platform}.api.riotgames.com/lol/spectator/v5/active-games/by-summoner/${encodeURIComponent(puuid)}`;
		const response = await fetch(spectatorUrl, { headers: getHeaders(), cache: "no-store" });

		// 404 is the normal "not currently in a game" answer.
		if (response.status === 404) {
			return json({ inGame: false, puuid });
		}
		if (response.status === 401 || response.status === 403) {
			return json({ error: `Riot rejected the API key for ${platform} (${response.status})` }, 502);
		}
		if (response.status === 429) {
			return json({ error: "Rate limited — try again in a moment" }, 429);
		}
		if (!response.ok) {
			return json({ error: `Failed to fetch live game (${response.status})` }, 502);
		}

		const game = await response.json();

		return json({
			inGame: true,
			puuid,
			gameId: game.gameId,
			gameQueueConfigId: game.gameQueueConfigId,
			gameStartTime: game.gameStartTime,
			gameLength: game.gameLength,
			participants: (game.participants || []).map((p: SpectatorParticipant) => ({
				puuid: p.puuid,
				teamId: p.teamId,
				championId: p.championId,
				riotId: p.riotId,
			})),
			// championId is -1 for an empty ban slot; Arena sends no bans at all.
			bannedChampionIds: (game.bannedChampions || [])
				.map((b: { championId: number }) => b.championId)
				.filter((id: number) => id > 0),
		});
	} catch (error) {
		console.error("Error fetching live game:", error);
		return json({ error: "Internal server error" }, 500);
	}
}
