import { z } from "zod";

// Types
export const RiotAccountSchema = z.object({
	puuid: z.string(),
	gameName: z.string(),
	tagLine: z.string(),
});

export const RiotErrorSchema = z.object({
	status: z.object({
		status_code: z.number(),
		message: z.string(),
	}),
});

export type RiotAccount = z.infer<typeof RiotAccountSchema>;
export type RiotError = z.infer<typeof RiotErrorSchema>;

export const MatchParticipantSchema = z.object({
	puuid: z.string(),
	championName: z.string(),
	placement: z.number(),
});

export const MatchInfoSchema = z.object({
	info: z.object({
		participants: z.array(MatchParticipantSchema),
	}),
});

export type MatchParticipant = z.infer<typeof MatchParticipantSchema>;
export type MatchInfo = z.infer<typeof MatchInfoSchema>;

// Server Actions
export async function getRiotAccount(gameName: string, tagLine: string) {
	// Try all regions for account lookup
	const regions = ["americas", "europe", "asia", "sea"];

	for (const region of regions) {
		try {
			const response = await fetch(
				`/api/riot?endpoint=account&gameName=${encodeURIComponent(
					gameName
				)}&tagLine=${encodeURIComponent(tagLine)}&region=${region}`
			);

			const data = await response.json();

			if (response.ok) {
				return { data: RiotAccountSchema.parse(data) };
			}
		} catch (error) {
			console.log(`Failed to find account in region: ${region}`);
		}
	}

	return { error: "Account not found in any region" };
}

export async function getMatchIds(puuid: string) {
	// Try all regions for match lookup
	const regions = ["americas", "europe", "asia", "sea"];

	for (const region of regions) {
		try {
			const response = await fetch(
				`/api/riot?endpoint=matches&puuid=${encodeURIComponent(puuid)}&region=${region}&queue=1700`
			);

			if (!response.ok) {
				continue; // Try next region
			}

			const data = await response.json();
			const matches = z.array(z.string()).parse(data);

			// If we found matches, return them
			if (matches.length > 0) {
				console.log(`Found matches in region: ${region}`);
				return { data: matches };
			}
		} catch (error) {
			console.log(`Failed to fetch matches from region: ${region}`);
		}
	}

	return { data: [] }; // No matches found in any region
}

// Helper function to determine region from matchId
function getRegionFromMatchId(matchId: string): string {
	const prefix = matchId.split('_')[0];

	// Map match prefixes to API regions
	const regionMap: Record<string, string> = {
		// Americas
		'NA1': 'americas',
		'BR1': 'americas',
		'LA1': 'americas', // LAS (Latin America South)
		'LA2': 'americas', // LAN (Latin America North)

		// Europe
		'EUW1': 'europe',
		'EUN1': 'europe',
		'TR1': 'europe',
		'RU1': 'europe',

		// Asia
		'KR': 'asia',
		'JP1': 'asia',

		// SEA (Southeast Asia)
		'OC1': 'sea',
		'PH2': 'sea',
		'SG2': 'sea',
		'TH2': 'sea',
		'TW2': 'sea',
		'VN2': 'sea',
	};

	return regionMap[prefix] || 'americas'; // Default to americas
}

export async function getMatchInfo(matchId: string) {
	try {
		const region = getRegionFromMatchId(matchId);
		const response = await fetch(
			`/api/riot?endpoint=match&matchId=${encodeURIComponent(matchId)}&region=${region}`
		);

		if (!response.ok) {
			throw new Error(`HTTP error! status: ${response.status}`);
		}

		const data = await response.json();
		return { data: MatchInfoSchema.parse(data) };
	} catch (error) {
		console.error("Error fetching match info:", error);
		return { error: "Failed to fetch match info" };
	}
}

// Helper function to get player's placement in a match
export function getPlayerMatchResult(
	matchInfo: MatchInfo,
	playerPuuid: string
) {
	const player = matchInfo.info.participants.find(
		(p: MatchParticipant) => p.puuid === playerPuuid
	);

	if (!player) {
		return null;
	}

	return {
		champion: player.championName,
		placement: player.placement,
	};
}
