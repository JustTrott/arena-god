import { test } from "node:test";
import assert from "node:assert/strict";
import { DICT, LOCALES, localePath, t } from "./i18n";

test("localePath keeps English at the root and prefixes German", () => {
	assert.equal(localePath("en"), "/");
	assert.equal(localePath("de"), "/de");
	assert.equal(localePath("en", "challenge/arena-god"), "/challenge/arena-god");
	assert.equal(localePath("de", "challenge/arena-god"), "/de/challenge/arena-god");
});

test("localePath tolerates a leading slash on the path", () => {
	assert.equal(localePath("en", "/challenge/aram-god"), "/challenge/aram-god");
	assert.equal(localePath("de", "/challenge/aram-god"), "/de/challenge/aram-god");
	assert.equal(localePath("en", ""), "/");
});

test("t falls back to English for an unknown locale", () => {
	// Locales come from route segments, so a bad one must not blow up rendering.
	const dict = t("fr" as never);
	assert.equal(dict, DICT.en);
});

test("every locale has the same shape and no empty strings", () => {
	const paths = (value: unknown, prefix = ""): string[] => {
		if (typeof value === "function") return [`${prefix}()`];
		if (Array.isArray(value)) {
			// Lists are content, not shape — a locale may legitimately carry more keywords than
			// another. The recursion still asserts every entry is non-empty.
			value.forEach((entry, i) => paths(entry, `${prefix}[${i}]`));
			return [`${prefix}[]`];
		}
		if (value && typeof value === "object") {
			return Object.entries(value).flatMap(([k, v]) => paths(v, prefix ? `${prefix}.${k}` : k));
		}
		assert.notEqual(String(value).trim(), "", `${prefix} is empty`);
		return [prefix];
	};

	const reference = paths(DICT.en);
	for (const locale of LOCALES) {
		assert.deepEqual(paths(DICT[locale]), reference, `${locale} has a different key set`);
	}
});

test("both locales answer the same FAQ questions", () => {
	for (const locale of LOCALES) {
		assert.equal(DICT[locale].faq.length, DICT.en.faq.length);
		for (const item of DICT[locale].faq) {
			assert.ok(item.question.endsWith("?"), `not a question: ${item.question}`);
			assert.ok(item.answer.length > 40, `answer too thin to be useful: ${item.question}`);
		}
	}
});

test("interpolated strings actually use their argument", () => {
	for (const locale of LOCALES) {
		const dict = DICT[locale];
		assert.ok(dict.intro("42").includes("42"));
		assert.ok(dict.challenges.forLevel("gold", "30").includes("30"));
		assert.ok(dict.challenges.ofPlayers("top 1%").includes("top 1%"));
		assert.ok(dict.challenges.rank("7").includes("7"));
		assert.ok(dict.challenges.rankIn("7", "100", "gold").includes("100"));
		assert.ok(dict.challenges.gap(3).startsWith("3"));
		assert.ok(dict.detail.siblingsTitle("ARAM Warrior").includes("ARAM Warrior"));
		assert.ok(dict.detail.metaDescription("Name", "Desc").includes("Name"));
	}
});

test("German singular and plural differ where they should", () => {
	const { gap } = DICT.de.challenges;
	assert.ok(gap(1).includes("Sieg") && !gap(1).includes("Siege"));
	assert.ok(gap(2).includes("Siege"));

	const en = DICT.en.challenges.gap;
	assert.ok(en(1).includes("win ") && !en(1).includes("wins"));
	assert.ok(en(2).includes("wins"));
});
