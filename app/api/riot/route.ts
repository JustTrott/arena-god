import { NextRequest, NextResponse } from "next/server";

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

export async function GET(request: NextRequest) {
	const searchParams = request.nextUrl.searchParams;
	const endpoint = searchParams.get("endpoint");
	const gameName = searchParams.get("gameName");
	const tagLine = searchParams.get("tagLine");
	const puuid = searchParams.get("puuid");
	const matchId = searchParams.get("matchId");
	const region = searchParams.get("region") || "americas"; // Default to Americas

	if (!endpoint) {
		return NextResponse.json(
			{ error: "Endpoint is required" },
			{ status: 400 }
		);
	}

	const RIOT_API_BASE = RIOT_API_REGIONS[region as keyof typeof RIOT_API_REGIONS] || RIOT_API_REGIONS.americas;

	try {
		let url = "";
		switch (endpoint) {
			case "account":
				if (!gameName || !tagLine) {
					return NextResponse.json(
						{ error: "Game name and tag line are required" },
						{ status: 400 }
					);
				}
				url = `${RIOT_API_BASE}/riot/account/v1/accounts/by-riot-id/${gameName}/${tagLine}`;
				break;

			case "matches":
				if (!puuid) {
					return NextResponse.json(
						{ error: "PUUID is required" },
						{ status: 400 }
					);
				}
				const queue = searchParams.get("queue");
				const queueParam = queue ? `&queue=${queue}` : "";
				url = `${RIOT_API_BASE}/lol/match/v5/matches/by-puuid/${puuid}/ids?start=0&count=20${queueParam}`;
				break;

			case "match":
				if (!matchId) {
					return NextResponse.json(
						{ error: "Match ID is required" },
						{ status: 400 }
					);
				}
				url = `${RIOT_API_BASE}/lol/match/v5/matches/${matchId}`;
				break;

			default:
				return NextResponse.json(
					{ error: "Invalid endpoint" },
					{ status: 400 }
				);
		}

		const response = await fetch(url, { headers });
		const data = await response.json();

		if (!response.ok) {
			return NextResponse.json(data, { status: response.status });
		}

		return NextResponse.json(data);
	} catch (error) {
		console.error("Error in Riot API route:", error);
		return NextResponse.json(
			{ error: "Internal server error" },
			{ status: 500 }
		);
	}
}
