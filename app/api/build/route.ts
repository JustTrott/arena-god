import { NextRequest } from "next/server";

const BLITZ_ARENA_CHAMPION =
	"https://data.v2.iesdev.com/api/v1/query_objects/prod/lol/arena_champion";
const AUGMENT_ICONS = "https://blitz-cdn.blitz.gg/blitz/lol/arena/augments";

// Below these an entry's placement rate is mostly noise — plenty of 3-game items sit at 100%.
const MIN_ITEM_GAMES = 500;
const MIN_AUGMENT_GAMES = 300;

// Data Dragon's tags are unreliable for Arena variants (Runecarver claims to be a boot), so the
// boots are listed outright. Arena reskins keep the base id behind a "22" prefix.
const BOOT_IDS = new Set(["1001", "3006", "3009", "3020", "3047", "3111", "3117", "3158"]);
const TIER_LETTERS: Record<number, string> = { 1: "S", 2: "A", 3: "B", 4: "C", 5: "D" };
const AUGMENT_RARITIES: Record<number, string> = { 2: "Prismatic", 1: "Gold", 0: "Silver" };

function json(body: unknown, status = 200) {
	return new Response(JSON.stringify(body), {
		status,
		headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
	});
}

interface EntryStats {
	num_games?: number;
	pick_rate?: number;
	top_1_percent?: number;
	tier?: number;
}

interface Entry {
	id: string;
	name: string;
	icon: string;
	pickRate: number;
	top1: number;
	tier: string;
	games: number;
}

interface DDragonItem {
	name: string;
	gold?: { total?: number };
}

interface BlitzAugment {
	displayName: string;
	iconLarge: string;
	rarity: number;
}

function baseItemId(id: string) {
	return id.startsWith("22") ? id.slice(2) : id;
}

function sortByPickRate(entries: Entry[]) {
	return entries.sort((a, b) => b.pickRate - a.pickRate);
}

export async function GET(request: NextRequest) {
	const championId = Number(request.nextUrl.searchParams.get("championId"));
	if (!Number.isInteger(championId) || championId <= 0) {
		return json({ error: "championId must be a positive integer" }, 400);
	}

	try {
		const [statsResponse, versionsResponse] = await Promise.all([
			fetch(`${BLITZ_ARENA_CHAMPION}?champion_id=${championId}`, {
				next: { revalidate: 60 * 60 },
			}),
			fetch("https://ddragon.leagueoflegends.com/api/versions.json", {
				next: { revalidate: 60 * 60 },
			}),
		]);

		if (!statsResponse.ok) {
			return json({ found: false, reason: `Stats provider returned ${statsResponse.status}` });
		}

		const row = (await statsResponse.json())?.data?.[0];
		const championStats = row?.data;
		if (!championStats) return json({ found: false, reason: "No Arena stats for this champion" });

		const patch: string = row.patch;
		const version = (await versionsResponse.json())[0];

		const [itemResponse, augmentResponse] = await Promise.all([
			fetch(`https://ddragon.leagueoflegends.com/cdn/${version}/data/en_US/item.json`, {
				next: { revalidate: 60 * 60 },
			}),
			fetch(`https://utils.iesdev.com/static/json/lol/arena/${patch}/augments_en_us`, {
				next: { revalidate: 60 * 60 },
			}),
		]);

		const itemData = (await itemResponse.json()).data as Record<string, DDragonItem>;
		const augmentData = augmentResponse.ok
			? ((await augmentResponse.json()) as Record<string, BlitzAugment>)
			: {};

		const items = Object.entries((championStats.items || {}) as Record<string, EntryStats>)
			.filter(([id, s]) => {
				const item = itemData[id];
				// Trinkets and other free pickups are noise in a build list.
				return item && (item.gold?.total ?? 0) > 0 && (s.num_games ?? 0) >= MIN_ITEM_GAMES;
			})
			.map(([id, s]) => ({
				id,
				name: itemData[id].name,
				icon: `https://ddragon.leagueoflegends.com/cdn/${version}/img/item/${id}.png`,
				pickRate: s.pick_rate ?? 0,
				top1: s.top_1_percent ?? 0,
				tier: TIER_LETTERS[s.tier ?? 0] || "",
				games: s.num_games ?? 0,
			}));

		const augments = Object.entries((championStats.augments || {}) as Record<string, EntryStats>)
			.filter(([id, s]) => augmentData[id] && (s.num_games ?? 0) >= MIN_AUGMENT_GAMES)
			.map(([id, s]) => ({
				entry: {
					id,
					name: augmentData[id].displayName,
					icon: `${AUGMENT_ICONS}/${augmentData[id].iconLarge.replace(/\.png$/, ".webp").toLowerCase()}`,
					pickRate: s.pick_rate ?? 0,
					top1: s.top_1_percent ?? 0,
					tier: TIER_LETTERS[s.tier ?? 0] || "",
					games: s.num_games ?? 0,
				},
				rarity: augmentData[id].rarity,
			}));

		const groups = [
			{
				title: "Boots",
				entries: sortByPickRate(items.filter((i) => BOOT_IDS.has(baseItemId(i.id)))),
			},
			{
				title: "Items",
				entries: sortByPickRate(
					items.filter((i) => !i.id.startsWith("447") && !BOOT_IDS.has(baseItemId(i.id)))
				),
			},
			{
				title: "Prismatics",
				entries: sortByPickRate(items.filter((i) => i.id.startsWith("447"))),
			},
			...[2, 1, 0].map((rarity) => ({
				title: `${AUGMENT_RARITIES[rarity]} Augments`,
				entries: sortByPickRate(
					augments.filter((a) => a.rarity === rarity).map((a) => a.entry)
				),
			})),
		].filter((group) => group.entries.length > 0);

		return json({
			found: true,
			championId,
			patch,
			stats: {
				tier: TIER_LETTERS[championStats.tier ?? 0] || "",
				avgPlacement: championStats.avg_placement ?? 0,
				top1: championStats.top_1_percent ?? 0,
				top4: championStats.top_4_percent ?? 0,
				pickRate: championStats.match_pick_rate ?? 0,
				appearances: championStats.num_duos ?? 0,
			},
			groups,
		});
	} catch (error) {
		console.error("Error fetching build:", error);
		return json({ found: false, reason: "Could not reach stats provider" });
	}
}
