import { RiotId, MatchResult, ArenaProgress, MatchInfo } from "../types";

const STORAGE_KEYS = {
	RIOT_ID: "arena-god-riot-id",
	MATCH_HISTORY: "arena-god-match-history",
	ARENA_PROGRESS: "arena-god-progress",
	MATCH_CACHE: "arena-god-match-cache",
} as const;

export function getRiotId(): RiotId | null {
	if (typeof window === "undefined") return null;
	const stored = localStorage.getItem(STORAGE_KEYS.RIOT_ID);
	return stored ? JSON.parse(stored) : null;
}

export function setRiotId(riotId: RiotId) {
	if (typeof window === "undefined") return;
	localStorage.setItem(STORAGE_KEYS.RIOT_ID, JSON.stringify(riotId));
}

export function getMatchHistory(): MatchResult[] {
	if (typeof window === "undefined") return [];
	const stored = localStorage.getItem(STORAGE_KEYS.MATCH_HISTORY);
	return stored ? JSON.parse(stored) : [];
}

export function setMatchHistory(history: MatchResult[]) {
	if (typeof window === "undefined") return;
	localStorage.setItem(STORAGE_KEYS.MATCH_HISTORY, JSON.stringify(history));
}

export function getArenaProgress(): ArenaProgress {
	if (typeof window === "undefined") return { firstPlaceChampions: [] };
	const stored = localStorage.getItem(STORAGE_KEYS.ARENA_PROGRESS);
	return stored ? JSON.parse(stored) : { firstPlaceChampions: [] };
}

export function setArenaProgress(progress: ArenaProgress) {
	if (typeof window === "undefined") return;
	localStorage.setItem(STORAGE_KEYS.ARENA_PROGRESS, JSON.stringify(progress));
}

export function getMatchCache(): Record<string, MatchInfo> {
	if (typeof window === "undefined") return {};
	const stored = localStorage.getItem(STORAGE_KEYS.MATCH_CACHE);
	return stored ? JSON.parse(stored) : {};
}

export function setMatchCache(cache: Record<string, MatchInfo>) {
	if (typeof window === "undefined") return;
	localStorage.setItem(STORAGE_KEYS.MATCH_CACHE, JSON.stringify(cache));
}

export function getCachedMatch(matchId: string): MatchInfo | null {
	const cache = getMatchCache();
	return cache[matchId] || null;
}

export function cacheMatch(matchId: string, matchInfo: MatchInfo) {
	const cache = getMatchCache();
	cache[matchId] = matchInfo;
	setMatchCache(cache);
}
