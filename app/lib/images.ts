export interface ImageTile {
	// Champion id (e.g., "Aatrox", "KSante"). Used internally for keys/progress.
	name: string;
	// Human-readable champion name for UI (e.g., "K'Sante").
	displayName: string;
	// Absolute CDN image URL for the champion square icon.
	src: string;
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
				name: string;
				image: { full: string };
			}
		>;
	};

	const tiles: ImageTile[] = Object.values(championJson.data)
		.map((champ) => ({
			name: champ.id,
			displayName: champ.name,
			src: `https://ddragon.leagueoflegends.com/cdn/img/champion/tiles/${champ.id}_0.jpg`,
		}))
		.sort((a, b) => a.displayName.localeCompare(b.displayName));

	return tiles;
}
