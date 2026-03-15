import { RiotId, MatchResult, ArenaProgress, MatchInfo } from "../types";

const STORAGE_VERSION = 3;

const STORAGE_KEYS = {
	VERSION: "arena-god-version",
	RIOT_ID: "arena-god-riot-id",
	ARENA_PROGRESS: "arena-god-progress",
	USER_PUUID: "arena-god-user-puuid",
} as const;

// PUUID-scoped keys
function matchHistoryKey(puuid: string) { return `arena-god-match-history-${puuid}`; }
function matchCacheKey(puuid: string) { return `arena-god-match-cache-${puuid}`; }

/** Returns true if storage was cleared due to version mismatch. */
export function checkStorageVersion(): boolean {
	if (typeof window === "undefined") return false;
	const stored = localStorage.getItem(STORAGE_KEYS.VERSION);
	const currentVersion = stored ? parseInt(stored, 10) : 0;
	if (currentVersion < STORAGE_VERSION) {
		// Migrate: move global match data to PUUID-scoped keys, then remove globals
		const puuid = localStorage.getItem(STORAGE_KEYS.USER_PUUID);
		const oldHistory = localStorage.getItem("arena-god-match-history");
		const oldCache = localStorage.getItem("arena-god-match-cache");
		if (puuid) {
			if (oldHistory && !localStorage.getItem(matchHistoryKey(puuid))) {
				localStorage.setItem(matchHistoryKey(puuid), oldHistory);
			}
			if (oldCache && !localStorage.getItem(matchCacheKey(puuid))) {
				localStorage.setItem(matchCacheKey(puuid), oldCache);
			}
		}
		localStorage.removeItem("arena-god-match-history");
		localStorage.removeItem("arena-god-match-cache");
		localStorage.setItem(STORAGE_KEYS.VERSION, String(STORAGE_VERSION));
		return currentVersion > 0;
	}
	return false;
}

// --- Global storage (not PUUID-scoped) ---

export function getRiotId(): RiotId | null {
	if (typeof window === "undefined") return null;
	const stored = localStorage.getItem(STORAGE_KEYS.RIOT_ID);
	return stored ? JSON.parse(stored) : null;
}

export function setRiotId(riotId: RiotId) {
	if (typeof window === "undefined") return;
	localStorage.setItem(STORAGE_KEYS.RIOT_ID, JSON.stringify(riotId));
}

export function getUserPuuid(): string | null {
	if (typeof window === "undefined") return null;
	return localStorage.getItem(STORAGE_KEYS.USER_PUUID);
}

export function setUserPuuid(puuid: string) {
	if (typeof window === "undefined") return;
	localStorage.setItem(STORAGE_KEYS.USER_PUUID, puuid);
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

// --- PUUID-scoped storage ---

export function getMatchHistory(puuid?: string | null): MatchResult[] {
	if (typeof window === "undefined") return [];
	const id = puuid || localStorage.getItem(STORAGE_KEYS.USER_PUUID);
	if (!id) return [];
	const stored = localStorage.getItem(matchHistoryKey(id));
	return stored ? JSON.parse(stored) : [];
}

export function setMatchHistory(history: MatchResult[], puuid?: string | null) {
	if (typeof window === "undefined") return;
	const id = puuid || localStorage.getItem(STORAGE_KEYS.USER_PUUID);
	if (!id) return;
	localStorage.setItem(matchHistoryKey(id), JSON.stringify(history));
}

export function getMatchCache(puuid?: string | null): Record<string, MatchInfo> {
	if (typeof window === "undefined") return {};
	const id = puuid || localStorage.getItem(STORAGE_KEYS.USER_PUUID);
	if (!id) return {};
	const stored = localStorage.getItem(matchCacheKey(id));
	return stored ? JSON.parse(stored) : {};
}

export function setMatchCache(cache: Record<string, MatchInfo>, puuid?: string | null) {
	if (typeof window === "undefined") return;
	const id = puuid || localStorage.getItem(STORAGE_KEYS.USER_PUUID);
	if (!id) return;
	localStorage.setItem(matchCacheKey(id), JSON.stringify(cache));
}

export function getCachedMatch(matchId: string, puuid?: string | null): MatchInfo | null {
	const cache = getMatchCache(puuid);
	return cache[matchId] || null;
}

export function cacheMatch(matchId: string, fullMatchData: MatchInfo, puuid?: string | null) {
	const minimalMatchInfo: MatchInfo = {
		info: {
			gameStartTimestamp: fullMatchData?.info?.gameStartTimestamp,
			participants: (fullMatchData?.info?.participants || []).map((p: { puuid: string; championName: string; placement: number; riotIdGameName?: string; riotIdTagline?: string }) => ({
				puuid: p.puuid,
				championName: p.championName,
				placement: p.placement,
				riotIdGameName: p.riotIdGameName,
				riotIdTagline: p.riotIdTagline,
			})),
		},
	};
	const cache = getMatchCache(puuid);
	cache[matchId] = minimalMatchInfo;
	setMatchCache(cache, puuid);
}
