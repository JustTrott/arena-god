import { test } from "node:test";
import assert from "node:assert/strict";
import {
	ChallengeDef,
	RawChallenge,
	findBySlug,
	flattenChallenges,
	formatPercentile,
	groupChallenges,
	nextThreshold,
} from "./challenges";

function raw(
	id: number,
	name: string,
	extra: Partial<RawChallenge> & { de?: string; description?: string } = {}
): RawChallenge {
	const { de, description, ...rest } = extra;
	return {
		id,
		state: "ENABLED",
		thresholds: { IRON: 1, GOLD: 10, MASTER: 100 },
		localizedNames: {
			en_US: { name, description: description ?? `${name} description`, shortDescription: name },
			...(de ? { de_DE: { name: de, description: `${de} Beschreibung`, shortDescription: de } } : {}),
		},
		...rest,
	};
}

/** Covers every branch of the id-range filter, which is the piece most likely to rot. */
const CONFIG: RawChallenge[] = [
	raw(101300, "ARAM Champion"),
	raw(101301, "All Random All Champions", { de: "Alle zufällig, alle Champions" }),
	raw(101306, "Can't Touch This"),
	raw(101202, "It was a... Near-Hit"),
	raw(601000, "Arena Brawler"),
	raw(601001, "Cream of the Crop"),
	raw(602002, "Adapt to All Situations"),
	raw(600006, "Been Here a While"), // account-wide, must be excluded
	raw(603001, "Goldfishing"), // Swarm event, must be excluded
	raw(2022001, "All Random All Champions: 2022", { description: "Earn an S- grade in ARAM" }),
	raw(2024999, "Perfect Timing: 2024", { description: "Win ranked games quickly" }), // not ARAM/Arena
	raw(101999, "Disabled ARAM thing", { state: "DISABLED" }),
	{ id: 101998, state: "ENABLED", localizedNames: {} }, // no en_US name at all
];

test("groupChallenges keeps only Arena and ARAM challenges", () => {
	const ids = flattenChallenges(groupChallenges(CONFIG)).map((d) => d.id);

	assert.ok(ids.includes(101301), "ARAM range included");
	assert.ok(ids.includes(601001), "Arena Brawler range included");
	assert.ok(ids.includes(602002), "Arena Champion range included");
	assert.ok(ids.includes(2022001), "seasonal ARAM matched by text");

	assert.ok(!ids.includes(600006), "account-wide challenge excluded");
	assert.ok(!ids.includes(603001), "Swarm challenge excluded");
	assert.ok(!ids.includes(2024999), "seasonal non-ARAM challenge excluded");
	assert.ok(!ids.includes(101999), "disabled challenge excluded");
	assert.ok(!ids.includes(101998), "challenge without an English name excluded");
});

test("groupChallenges nests children under the group parent", () => {
	const groups = groupChallenges(CONFIG);
	const aram = groups.find((g) => g.id === 101300);

	assert.ok(aram);
	assert.equal(aram.parent?.id, 101300);
	assert.equal(aram.name, "ARAM Champion");
	assert.equal(aram.category, "ARAM");
	assert.deepEqual(
		aram.challenges.map((c) => c.id),
		[101301, 101306],
		"children sorted ascending, parent not among them"
	);

	const arena = groups.find((g) => g.id === 601000);
	assert.equal(arena?.parent?.id, 601000);
	assert.equal(arena?.category, "Arena");
});

test("groupChallenges puts groups without a parent in their own bucket", () => {
	const groups = groupChallenges(CONFIG);

	// 101202 has no 101200 parent in this fixture.
	const finesse = groups.find((g) => g.id === 101200);
	assert.equal(finesse?.parent, null);
	assert.equal(finesse?.name, "Group 101200", "falls back to a placeholder name");

	const seasonal = groups.find((g) => g.category === "Seasonal");
	assert.equal(seasonal?.parent, null);
	assert.deepEqual(seasonal?.challenges.map((c) => c.id), [2022001]);
});

test("groupChallenges orders Arena before ARAM before Seasonal", () => {
	const categories = groupChallenges(CONFIG).map((g) => g.category);
	const firstAram = categories.indexOf("ARAM");
	const firstSeasonal = categories.indexOf("Seasonal");

	assert.equal(categories[0], "Arena");
	assert.ok(firstAram > 0 && firstAram < firstSeasonal, "ARAM sits between Arena and Seasonal");
});

test("slugs use the searched-for name for the two God challenges", () => {
	const bySlug = new Map(flattenChallenges(groupChallenges(CONFIG)).map((d) => [d.id, d.slug]));

	assert.equal(bySlug.get(602002), "arena-god");
	assert.equal(bySlug.get(101301), "aram-god");
	assert.equal(bySlug.get(601001), "cream-of-the-crop");
	assert.equal(bySlug.get(101306), "cant-touch-this", "apostrophes dropped, not turned into dashes");
	assert.equal(bySlug.get(101202), "it-was-a-near-hit", "punctuation runs collapse to one dash");
});

test("groupChallenges localises names but keeps one slug per challenge", () => {
	const german = flattenChallenges(groupChallenges(CONFIG, "de"));
	const aramGod = german.find((d) => d.id === 101301);
	const arenaGod = german.find((d) => d.id === 602002);

	assert.equal(aramGod?.name, "Alle zufällig, alle Champions");
	assert.equal(aramGod?.slug, "aram-god", "slug stays stable across locales");
	assert.equal(arenaGod?.name, "Adapt to All Situations", "falls back to English when untranslated");
});

test("groupChallenges strips Riot's markup and sorts thresholds ascending", () => {
	const config = [
		raw(101300, "ARAM Champion"),
		{
			...raw(101301, "All Random All Champions"),
			thresholds: { MASTER: 150, IRON: 1, GOLD: 30 },
			localizedNames: {
				en_US: {
					name: "All Random All Champions",
					description: "Earn an <em>S-</em> grade",
					shortDescription: "Earn&nbsp;S- on <em>different champions</em>",
				},
			},
		},
	];

	const def = flattenChallenges(groupChallenges(config)).find((d) => d.id === 101301);

	assert.equal(def?.description, "Earn an S- grade");
	assert.equal(def?.shortDescription, "Earn S- on different champions");
	assert.deepEqual(def?.thresholds, [
		{ level: "IRON", value: 1 },
		{ level: "GOLD", value: 30 },
		{ level: "MASTER", value: 150 },
	]);
});

test("groupChallenges survives an empty config", () => {
	assert.deepEqual(groupChallenges([]), []);
});

const def: ChallengeDef = {
	id: 1,
	name: "Test",
	description: "",
	shortDescription: "",
	leaderboard: false,
	slug: "test",
	thresholds: [
		{ level: "IRON", value: 10 },
		{ level: "GOLD", value: 20 },
		{ level: "MASTER", value: 40 },
	],
};

test("nextThreshold reports the level being worked toward", () => {
	assert.deepEqual(nextThreshold(def, 0), {
		next: { level: "IRON", value: 10 },
		target: 10,
		percent: 0,
	});

	// 5 of the way from 0 to 10.
	assert.equal(nextThreshold(def, 5).percent, 50);

	// Exactly on a threshold: aiming at the next one, bar back to zero.
	assert.deepEqual(nextThreshold(def, 20), {
		next: { level: "MASTER", value: 40 },
		target: 40,
		percent: 0,
	});

	// Halfway between gold (20) and master (40).
	assert.equal(nextThreshold(def, 30).percent, 50);
});

test("nextThreshold caps out at the highest level", () => {
	assert.deepEqual(nextThreshold(def, 40), { next: null, target: 40, percent: 100 });
	assert.deepEqual(nextThreshold(def, 999), { next: null, target: 40, percent: 100 });
});

test("nextThreshold handles a challenge with no thresholds", () => {
	assert.deepEqual(nextThreshold({ ...def, thresholds: [] }, 7), {
		next: null,
		target: 0,
		percent: 100,
	});
});

test("formatPercentile turns Riot's fraction into a label", () => {
	assert.equal(formatPercentile(0.001), "top 0.1%");
	assert.equal(formatPercentile(0.0005), "top 0.05%");
	assert.equal(formatPercentile(0.087), "top 9%");
	assert.equal(formatPercentile(0.5), "top 50%");
	assert.equal(formatPercentile(0), null, "zero is not a meaningful percentile");
	assert.equal(formatPercentile(undefined), null);
});

test("findBySlug looks through parents and children", () => {
	const groups = groupChallenges(CONFIG);

	assert.equal(findBySlug(groups, "aram-god")?.def.id, 101301);
	assert.equal(findBySlug(groups, "aram-god")?.group.id, 101300);
	assert.equal(findBySlug(groups, "arena-brawler")?.def.id, 601000, "parents are findable too");
	assert.equal(findBySlug(groups, "nope"), null);
});

test("flattenChallenges counts parents and children exactly once", () => {
	const groups = groupChallenges(CONFIG);
	const expected = groups.reduce((n, g) => n + g.challenges.length + (g.parent ? 1 : 0), 0);
	const flat = flattenChallenges(groups);

	assert.equal(flat.length, expected);
	assert.equal(new Set(flat.map((d) => d.id)).size, flat.length, "no duplicates");
	assert.equal(new Set(flat.map((d) => d.slug)).size, flat.length, "slugs are unique");
});
