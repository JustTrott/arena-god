import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import {
	cacheMatch,
	checkStorageVersion,
	getArenaProgress,
	getCachedMatch,
	getMatchCache,
	getMatchHistory,
	getPlatform,
	getRiotId,
	setArenaProgress,
	setMatchHistory,
	setPlatform,
	setRiotId,
	setUserPuuid,
} from "./storage";

class FakeStorage {
	private data = new Map<string, string>();
	getItem(key: string) {
		return this.data.has(key) ? (this.data.get(key) as string) : null;
	}
	setItem(key: string, value: string) {
		this.data.set(key, String(value));
	}
	removeItem(key: string) {
		this.data.delete(key);
	}
	clear() {
		this.data.clear();
	}
	get size() {
		return this.data.size;
	}
	keys() {
		return [...this.data.keys()];
	}
}

// storage.ts reads `window` and `localStorage` inside its functions, never at module load, so
// installing the fakes here is enough — every test body runs after this line.
const store = new FakeStorage();
Object.assign(globalThis, { window: globalThis, localStorage: store });

const PUUID_A = "puuid-a";
const PUUID_B = "puuid-b";

beforeEach(() => store.clear());

test("Riot ID survives a round trip", () => {
	assert.equal(getRiotId(), null, "nothing stored yet");

	setRiotId({ gameName: "Faker", tagLine: "KR1" });

	assert.deepEqual(getRiotId(), { gameName: "Faker", tagLine: "KR1" });
});

test("platform defaults to EUW and is overwritable", () => {
	assert.equal(getPlatform(), "euw1");

	setPlatform("na1");

	assert.equal(getPlatform(), "na1");
});

test("arena progress defaults to an empty list", () => {
	assert.deepEqual(getArenaProgress(), { firstPlaceChampions: [] });

	setArenaProgress({ firstPlaceChampions: ["Aatrox", "Ahri"] });

	assert.deepEqual(getArenaProgress().firstPlaceChampions, ["Aatrox", "Ahri"]);
});

test("match history is scoped per puuid", () => {
	setMatchHistory([{ champion: "Aatrox", placement: 1, matchId: "EUW1_1" }], PUUID_A);
	setMatchHistory([{ champion: "Ahri", placement: 4, matchId: "EUW1_2" }], PUUID_B);

	assert.deepEqual(getMatchHistory(PUUID_A).map((m) => m.matchId), ["EUW1_1"]);
	assert.deepEqual(getMatchHistory(PUUID_B).map((m) => m.matchId), ["EUW1_2"]);
});

test("match history falls back to the stored puuid when none is passed", () => {
	setUserPuuid(PUUID_A);
	setMatchHistory([{ champion: "Aatrox", placement: 1, matchId: "EUW1_1" }]);

	assert.deepEqual(getMatchHistory().map((m) => m.matchId), ["EUW1_1"]);
	assert.deepEqual(getMatchHistory(PUUID_B), [], "another account starts empty");
});

test("writing without any puuid is dropped rather than stored globally", () => {
	setMatchHistory([{ champion: "Aatrox", placement: 1, matchId: "EUW1_1" }]);

	assert.equal(store.size, 0, "no unscoped key is created");
	assert.deepEqual(getMatchHistory(), []);
});

test("cacheMatch keeps only the fields the UI reads", () => {
	cacheMatch(
		"EUW1_1",
		{
			info: {
				gameStartTimestamp: 1700000000000,
				gameDuration: 1234,
				participants: [
					{
						puuid: PUUID_A,
						championName: "Aatrox",
						placement: 1,
						riotIdGameName: "Faker",
						riotIdTagline: "KR1",
						totalDamageDealt: 99999,
					},
				],
			},
		} as never,
		PUUID_A
	);

	const cached = getCachedMatch("EUW1_1", PUUID_A);
	assert.ok(cached);
	assert.deepEqual(Object.keys(cached.info).sort(), ["gameStartTimestamp", "participants"]);
	assert.deepEqual(Object.keys(cached.info.participants[0]).sort(), [
		"championName",
		"placement",
		"puuid",
		"riotIdGameName",
		"riotIdTagline",
	]);
	assert.equal(getCachedMatch("EUW1_1", PUUID_B), null, "cache is per account");
});

test("cacheMatch tolerates a match with no participants", () => {
	cacheMatch("EUW1_2", { info: {} } as never, PUUID_A);

	assert.deepEqual(getCachedMatch("EUW1_2", PUUID_A)?.info.participants, []);
});

test("checkStorageVersion moves legacy global data under the puuid", () => {
	const history = JSON.stringify([{ champion: "Aatrox", placement: 1, matchId: "EUW1_1" }]);
	store.setItem("arena-god-user-puuid", PUUID_A);
	store.setItem("arena-god-match-history", history);
	store.setItem("arena-god-match-cache", JSON.stringify({ EUW1_1: { info: { participants: [] } } }));

	const wiped = checkStorageVersion();

	assert.equal(wiped, false, "a first-time visitor is not told their data was reset");
	assert.deepEqual(getMatchHistory(PUUID_A).map((m) => m.matchId), ["EUW1_1"]);
	assert.ok(getMatchCache(PUUID_A).EUW1_1, "cache migrated too");
	assert.equal(store.getItem("arena-god-match-history"), null, "legacy keys removed");
	assert.equal(store.getItem("arena-god-match-cache"), null);
});

test("checkStorageVersion reports a reset only when an older version was present", () => {
	store.setItem("arena-god-version", "1");

	assert.equal(checkStorageVersion(), true);

	// Running again on the now-current version must not claim a second reset.
	assert.equal(checkStorageVersion(), false);
});

test("checkStorageVersion does not overwrite already-migrated data", () => {
	store.setItem("arena-god-user-puuid", PUUID_A);
	store.setItem(
		`arena-god-match-history-${PUUID_A}`,
		JSON.stringify([{ champion: "Ahri", placement: 2, matchId: "EUW1_NEW" }])
	);
	store.setItem(
		"arena-god-match-history",
		JSON.stringify([{ champion: "Aatrox", placement: 1, matchId: "EUW1_OLD" }])
	);

	checkStorageVersion();

	assert.deepEqual(getMatchHistory(PUUID_A).map((m) => m.matchId), ["EUW1_NEW"]);
});
