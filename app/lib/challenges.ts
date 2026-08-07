import { Locale, RIOT_LOCALE } from "./i18n";

export const LEVELS = [
	"NONE",
	"IRON",
	"BRONZE",
	"SILVER",
	"GOLD",
	"PLATINUM",
	"DIAMOND",
	"MASTER",
	"GRANDMASTER",
	"CHALLENGER",
] as const;

export type Level = (typeof LEVELS)[number];

export const LEVEL_STYLES: Record<string, string> = {
	NONE: "bg-gray-700 text-gray-300",
	IRON: "bg-stone-600 text-stone-100",
	BRONZE: "bg-amber-800 text-amber-50",
	SILVER: "bg-slate-400 text-slate-900",
	GOLD: "bg-yellow-500 text-yellow-950",
	PLATINUM: "bg-teal-400 text-teal-950",
	DIAMOND: "bg-sky-400 text-sky-950",
	MASTER: "bg-purple-500 text-purple-50",
	GRANDMASTER: "bg-red-500 text-red-50",
	CHALLENGER: "bg-gradient-to-r from-yellow-300 to-sky-300 text-slate-900",
};

export interface ChallengeDef {
	id: number;
	name: string;
	description: string;
	shortDescription: string;
	leaderboard: boolean;
	/** URL segment for the detail page. Stable across locales so both share one slug. */
	slug: string;
	/** Ascending by value. */
	thresholds: { level: Level; value: number }[];
}

export interface ChallengeGroup {
	id: number;
	name: string;
	description: string;
	category: "ARAM" | "Arena" | "Seasonal";
	/** The group's own roll-up challenge, if Riot ships one (ids ending in 00). */
	parent: ChallengeDef | null;
	challenges: ChallengeDef[];
}

/** One challenge merged with a player's progress on it. */
export interface ChallengeProgress {
	level: Level;
	value: number;
	percentile: number;
	achievedTime?: number;
	position?: number;
	playersInLevel?: number;
}

export type PlayerChallenges = Record<string, ChallengeProgress>;

export interface RawChallenge {
	id: number;
	state?: string;
	leaderboard?: boolean;
	thresholds?: Record<string, number>;
	localizedNames?: Record<string, { name?: string; description?: string; shortDescription?: string }>;
}

// Riot's config carries no category or gameMode field, so the Arena/ARAM sets have to be picked by
// id range: 101xxx is the whole ARAM tree, 601xxx/602xxx the two Arena groups. Ids ending in 00 are
// the roll-up parents. 600xxx (account-wide) and 603xxx (Swarm) sit in the same decade but are
// neither mode, so they are excluded on purpose.
const ARAM_RANGE = [101000, 101999] as const;
const ARENA_RANGES = [
	[601000, 601999],
	[602000, 602999],
] as const;

function inRange(id: number, [lo, hi]: readonly [number, number] | readonly number[]) {
	return id >= lo && id <= hi;
}

function categoryOf(c: RawChallenge, text: string): ChallengeGroup["category"] | null {
	if (inRange(c.id, ARAM_RANGE)) return "ARAM";
	if (ARENA_RANGES.some((r) => inRange(c.id, r))) return "Arena";
	// Seasonal split challenges live in 20xxxxx and are only recognisable by their text.
	if (c.id >= 2000000 && /\bARAM\b|\bArena\b/i.test(text)) return "Seasonal";
	return null;
}

/**
 * Slugs are built from the English name so a challenge keeps one URL in every locale. The two
 * per-champion challenges get the name people actually search for instead of Riot's wording.
 */
const SLUG_OVERRIDES: Record<number, string> = {
	602002: "arena-god",
	101301: "aram-god",
};

function slugify(name: string) {
	return name
		.toLowerCase()
		.replace(/['’]/g, "")
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-|-$/g, "");
}

function toDef(
	c: RawChallenge,
	localized: { name?: string; description?: string; shortDescription?: string },
	englishName: string
): ChallengeDef {
	const thresholds = Object.entries(c.thresholds || {})
		.map(([level, value]) => ({ level: level as Level, value }))
		.sort((a, b) => a.value - b.value);

	return {
		id: c.id,
		name: localized.name || englishName || `Challenge ${c.id}`,
		description: stripTags(localized.description || ""),
		shortDescription: stripTags(localized.shortDescription || ""),
		leaderboard: Boolean(c.leaderboard),
		slug: SLUG_OVERRIDES[c.id] || slugify(englishName || String(c.id)),
		thresholds,
	};
}

/** Riot puts <em> in the short descriptions. */
function stripTags(s: string) {
	return s.replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").trim();
}

const CATEGORY_ORDER: ChallengeGroup["category"][] = ["Arena", "ARAM", "Seasonal"];

/**
 * Every enabled Arena/ARAM challenge, grouped the way Riot groups them in-client.
 * Cached for a day — the config only changes on patch days, and a failure here must not take the
 * page down, so it degrades to an empty list.
 */
const CONFIG_URL = "https://euw1.api.riotgames.com/lol/challenges/v1/challenges/config";
const CONFIG_TTL_MS = 60 * 60 * 24 * 1000;

/**
 * Riot's config is ~3 MB — over Next's 2 MB data-cache ceiling, so `next: { revalidate }` silently
 * refuses to store it and every render would re-download the lot. The grouped result is a few dozen
 * kilobytes, so that is what gets cached, in memory, per locale.
 *
 * Per-process cache: each serverless instance warms its own copy. That is fine for a config that
 * changes on patch days; swap in a shared cache only if instance churn ever makes it noticeable.
 */
const groupCache = new Map<Locale, { at: number; groups: ChallengeGroup[] }>();

async function fetchRawConfig(): Promise<RawChallenge[]> {
	const token = process.env.RIOT_API_TOKEN;
	if (!token) return [];

	// One retry: a single blip would otherwise turn every challenge page into a 404 for the whole
	// TTL, because an empty config means "no such challenge".
	for (let attempt = 0; attempt < 2; attempt++) {
		try {
			// Deliberately NOT `cache: "no-store"`: that opts the whole page out of static rendering,
			// which is the entire point of prerendering the challenge pages. Next will log that it
			// cannot store the 3 MB body — harmless, and the memory cache above means it is asked for
			// at most once per locale per day anyway.
			const response = await fetch(CONFIG_URL, {
				headers: { "X-Riot-Token": token },
				next: { revalidate: 60 * 60 * 24 },
			});
			if (response.ok) {
				const raw = (await response.json()) as RawChallenge[];
				if (Array.isArray(raw)) return raw;
			}
		} catch {
			// fall through to the retry
		}
	}
	return [];
}

export async function getChallengeGroups(locale: Locale = "en"): Promise<ChallengeGroup[]> {
	const cached = groupCache.get(locale);
	if (cached && Date.now() - cached.at < CONFIG_TTL_MS) return cached.groups;

	const groups = groupChallenges(await fetchRawConfig(), locale);

	// Never let a failed fetch replace a good list with an empty one.
	if (groups.length === 0) return cached?.groups ?? [];

	groupCache.set(locale, { at: Date.now(), groups });
	return groups;
}

/**
 * The pure half of getChallengeGroups: pick the Arena/ARAM challenges out of Riot's flat config and
 * nest them under their group parents. Kept separate so it can be tested without the network.
 */
export function groupChallenges(raw: RawChallenge[], locale: Locale = "en"): ChallengeGroup[] {
	const riotLocale = RIOT_LOCALE[locale] || "en_US";
	const groups = new Map<number, ChallengeGroup>();
	const seasonal: ChallengeDef[] = [];

	for (const c of raw) {
		if (c.state && c.state !== "ENABLED") continue;
		const en = c.localizedNames?.en_US;
		if (!en?.name) continue;

		const category = categoryOf(c, `${en.name} ${en.description || ""}`);
		if (!category) continue;

		// Fall back to English per field: Riot ships every locale today, but a new challenge can
		// land translated late, and a blank name would break the detail page.
		const def = toDef(c, c.localizedNames?.[riotLocale] || en, en.name);

		if (category === "Seasonal") {
			seasonal.push(def);
			continue;
		}

		const groupId = Math.floor(c.id / 100) * 100;
		const group = groups.get(groupId) || {
			id: groupId,
			name: "",
			description: "",
			category,
			parent: null,
			challenges: [],
		};

		if (c.id === groupId) {
			group.parent = def;
			group.name = def.name;
			group.description = def.description;
		} else {
			group.challenges.push(def);
		}

		groups.set(groupId, group);
	}

	if (seasonal.length > 0) {
		groups.set(9_999_900, {
			id: 9_999_900,
			name: "Retired Seasonal Challenges",
			description:
				"Split challenges from past seasons. They no longer progress, but your final value is kept.",
			category: "Seasonal",
			parent: null,
			challenges: seasonal.sort((a, b) => b.id - a.id),
		});
	}

	return Array.from(groups.values())
		.map((g) => ({
			...g,
			name: g.name || `Group ${g.id}`,
			challenges: g.challenges.sort((a, b) => a.id - b.id),
		}))
		.sort(
			(a, b) =>
				CATEGORY_ORDER.indexOf(a.category) - CATEGORY_ORDER.indexOf(b.category) || a.id - b.id
		);
}

/** Every challenge across all groups, parents included. */
export function flattenChallenges(groups: ChallengeGroup[]): ChallengeDef[] {
	return groups.flatMap((g) => [...(g.parent ? [g.parent] : []), ...g.challenges]);
}

export function findBySlug(groups: ChallengeGroup[], slug: string) {
	for (const group of groups) {
		const match = [...(group.parent ? [group.parent] : []), ...group.challenges].find(
			(d) => d.slug === slug
		);
		if (match) return { def: match, group };
	}
	return null;
}

/** Next level to reach and how far along the bar sits, for one challenge. */
export function nextThreshold(def: ChallengeDef, value: number) {
	const next = def.thresholds.find((t) => value < t.value);
	if (!next) {
		const top = def.thresholds[def.thresholds.length - 1];
		return { next: null, target: top?.value ?? 0, percent: 100 };
	}
	const previous = [...def.thresholds].reverse().find((t) => value >= t.value);
	const floor = previous?.value ?? 0;
	const span = next.value - floor;
	const percent = span > 0 ? Math.round(((value - floor) / span) * 100) : 0;
	return { next, target: next.value, percent: Math.max(0, Math.min(100, percent)) };
}

/** "top 0.1%" style label. Riot sends a fraction, not a percentage. */
export function formatPercentile(percentile: number | undefined): string | null {
	if (percentile === undefined || percentile === null) return null;
	const pct = percentile * 100;
	if (pct <= 0) return null;
	return `top ${pct < 0.1 ? pct.toFixed(2) : pct < 1 ? pct.toFixed(1) : Math.round(pct)}%`;
}

/** The two per-champion "God" challenges this tracker mirrors. */
export const GOD_CHALLENGES = {
	arena: 602002, // Adapt to All Situations — place first in Arena with different champions
	aram: 101301, // All Random All Champions — S- grade with different champions in ARAM
} as const;
