import { z } from "zod";

// Types
export const RiotAccountSchema = z.object({
	puuid: z.string(),
	gameName: z.string(),
	tagLine: z.string(),
});

export type RiotAccount = z.infer<typeof RiotAccountSchema>;

export const MatchParticipantSchema = z.object({
	puuid: z.string(),
	championName: z.string(),
	placement: z.number(),
	riotIdGameName: z.string().optional(),
	riotIdTagline: z.string().optional(),
});

export const MatchInfoSchema = z.object({
	info: z.object({
		gameStartTimestamp: z.number().optional(),
		participants: z.array(MatchParticipantSchema),
	}),
});

export type MatchParticipant = z.infer<typeof MatchParticipantSchema>;
export type MatchInfo = z.infer<typeof MatchInfoSchema>;
