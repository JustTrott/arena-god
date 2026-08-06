export interface ImageTile {
	// Champion id (e.g., "Aatrox", "KSante"). Used internally for keys/progress.
	name: string;
	// Human-readable champion name for UI (e.g., "K'Sante").
	displayName: string;
	// Absolute CDN image URL for the champion square icon.
	src: string;
	// Numeric champion id, as used by the spectator API.
	key: number;
	// Data Dragon roles, e.g. ["Fighter", "Tank"]. Used for the class filter.
	tags: string[];
	// Share of Arena games finished in 1st place, 0 when stats are unavailable.
	top1: number;
}

interface ArenaChampionRow {
	champion_id: string;
	stats?: { top_1_percent?: number };
}

/**
 * Arena placement rates from Blitz's public backend, keyed by the same numeric champion id
 * Data Dragon uses. Undocumented third party, so every failure degrades to "no stats" rather
 * than taking the page down with it.
 */
async function getArenaTop1Rates(): Promise<Map<number, number>> {
	try {
		const response = await fetch(
			"https://data.v2.iesdev.com/api/v1/query_objects/prod/lol/arena_champions",
			{ next: { revalidate: 60 * 60 } }
		);
		if (!response.ok) return new Map();
		const json = (await response.json()) as { data?: ArenaChampionRow[] };
		return new Map(
			(json.data || []).map((row) => [Number(row.champion_id), row.stats?.top_1_percent ?? 0])
		);
	} catch {
		return new Map();
	}
}

async function getLatestDDragonVersion(): Promise<string> {
	const response = await fetch(
		"https://ddragon.leagueoflegends.com/api/versions.json",
		{ next: { revalidate: 60 * 60 } }
	);
	if (!response.ok) {
		throw new Error(`Failed to fetch versions: ${response.status}`);
	}
	const versions = (await response.json()) as string[];
	if (!Array.isArray(versions) || versions.length === 0) {
		throw new Error("No versions returned from Data Dragon");
	}
	return versions[0];
}

export async function getImageTiles(): Promise<ImageTile[]> {
	const version = await getLatestDDragonVersion();
	const top1Rates = await getArenaTop1Rates();
	const championResponse = await fetch(
		`https://ddragon.leagueoflegends.com/cdn/${version}/data/en_US/champion.json`,
		{ next: { revalidate: 60 * 60 } }
	);
	if (!championResponse.ok) {
		throw new Error(`Failed to fetch champions: ${championResponse.status}`);
	}
	const championJson = (await championResponse.json()) as {
		data: Record<
			string,
			{
				id: string;
				key: string;
				name: string;
				tags: string[];
				image: { full: string };
			}
		>;
	};

	const tiles: ImageTile[] = Object.values(championJson.data)
		// Data Dragon also ships game-mode variants (Jade_Ahri, key 60103) that duplicate every
		// champion. Their ids never match the championName the match API returns, so they could
		// never be ticked off. Real champion keys are far below this.
		.filter((champ) => Number(champ.key) < 10000)
		.map((champ) => ({
			name: champ.id,
			displayName: champ.name,
			src: `https://ddragon.leagueoflegends.com/cdn/img/champion/tiles/${champ.id === "Fiddlesticks" ? "FiddleSticks" : champ.id}_0.jpg`,
			key: Number(champ.key),
			tags: champ.tags || [],
			top1: top1Rates.get(Number(champ.key)) ?? 0,
		}))
		.sort((a, b) => a.displayName.localeCompare(b.displayName));

	return tiles;
}
