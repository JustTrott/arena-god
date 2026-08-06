"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Image from "next/image";
import { ImageTile } from "../lib/images";
import {
	getRiotId,
	setRiotId,
	getUserPuuid,
	getArenaProgress,
	setArenaProgress,
	getPlatform,
	setPlatform,
	getMatchHistory,
	setMatchHistory,
	cacheMatch,
} from "../lib/storage";

const PLATFORMS = [
	{ value: "euw1", label: "EUW" },
	{ value: "eun1", label: "EUNE" },
	{ value: "na1", label: "NA" },
	{ value: "kr", label: "KR" },
	{ value: "br1", label: "BR" },
	{ value: "jp1", label: "JP" },
	{ value: "la1", label: "LAN" },
	{ value: "la2", label: "LAS" },
	{ value: "me1", label: "ME" },
	{ value: "oc1", label: "OCE" },
	{ value: "ru", label: "RU" },
	{ value: "sg2", label: "SEA" },
	{ value: "tr1", label: "TR" },
	{ value: "tw2", label: "TW" },
	{ value: "vn2", label: "VN" },
];

const QUEUE_NAMES: Record<number, string> = {
	1700: "Arena 2v2",
	1710: "Arena",
	1750: "Arena 3v3",
	400: "Normal Draft",
	420: "Ranked Solo/Duo",
	430: "Normal Blind",
	440: "Ranked Flex",
	450: "ARAM",
};

const ROLES = ["All", "Tank", "Fighter", "Mage", "Assassin", "Marksman", "Support"];

// Collapsed by default — the full lists run to 35 items and 100 augments, which is unreadable
// mid champ select. "Show all" opens them.
const COMPACT_LIMITS: Record<string, number> = {
	Boots: 1,
	Items: 6,
	Prismatics: 7,
	"Prismatic Augments": 3,
	"Gold Augments": 3,
	"Silver Augments": 3,
};

const TIER_COLORS: Record<string, string> = {
	S: "bg-amber-500",
	A: "bg-teal-500",
	B: "bg-sky-500",
	C: "bg-gray-500",
	D: "bg-gray-600",
};

const POLL_MS = 30000;

interface LiveParticipant {
	puuid: string;
	teamId: number;
	championId: number;
	riotId?: string;
}

interface LiveGame {
	inGame: boolean;
	puuid: string;
	gameId?: number;
	gameQueueConfigId?: number;
	gameStartTime?: number;
	gameLength?: number;
	participants?: LiveParticipant[];
	bannedChampionIds?: number[];
}

interface ChampSelect {
	active: boolean;
	bannedChampionIds: number[];
	pickedChampionIds: number[];
	myChampionId: number;
	timeLeftMs: number | null;
	phase: string | null;
}

interface BuildEntry {
	id: string;
	name: string;
	icon: string;
	pickRate: number;
	top1: number;
	tier: string;
	games: number;
}

interface Build {
	found: boolean;
	patch?: string;
	stats?: {
		tier: string;
		avgPlacement: number;
		top1: number;
		top4: number;
		pickRate: number;
		appearances: number;
	};
	groups?: { title: string; entries: BuildEntry[] }[];
}

function formatDuration(seconds: number): string {
	if (seconds < 0) seconds = 0;
	const m = Math.floor(seconds / 60);
	const s = seconds % 60;
	return `${m}:${String(s).padStart(2, "0")}`;
}

interface LiveGameProps {
	images: ImageTile[];
}

export function LiveGame({ images }: LiveGameProps) {
	const [gameName, setGameName] = useState("");
	const [tagLine, setTagLine] = useState("");
	const [platform, setPlatformState] = useState("euw1");
	const [game, setGame] = useState<LiveGame | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [isLoading, setIsLoading] = useState(false);
	const [lastChecked, setLastChecked] = useState<number | null>(null);
	const [now, setNow] = useState(() => Date.now());
	const [role, setRole] = useState("All");
	const [champSelect, setChampSelect] = useState<ChampSelect | null>(null);
	const [build, setBuild] = useState<Build | null>(null);
	const [result, setResult] = useState<string | null>(null);
	const [showAll, setShowAll] = useState(false);
	const tagLineInputRef = useRef<HTMLInputElement>(null);
	const enabledRef = useRef(false);
	const finishedGameRef = useRef<{ matchId: string; puuid: string } | null>(null);
	const inGame = Boolean(game?.inGame);

	useEffect(() => {
		const storedRiotId = getRiotId();
		if (storedRiotId) {
			setGameName(storedRiotId.gameName);
			setTagLine(storedRiotId.tagLine);
		}
		setPlatformState(getPlatform());
	}, []);

	const check = useCallback(async (name: string, tag: string, region: string) => {
		if (!name || !tag) {
			setError("Please enter both game name and tag line");
			return;
		}

		setIsLoading(true);
		setError(null);

		try {
			// Reuse the puuid the match history already resolved, when it belongs to this Riot ID.
			const storedRiotId = getRiotId();
			const storedPuuid =
				storedRiotId?.gameName === name && storedRiotId?.tagLine === tag ? getUserPuuid() : null;

			const url =
				`/api/live?gameName=${encodeURIComponent(name)}&tagLine=${encodeURIComponent(tag)}&platform=${region}` +
				(storedPuuid ? `&puuid=${encodeURIComponent(storedPuuid)}` : "");
			const response = await fetch(url);
			const data = await response.json();

			if (!response.ok) {
				setError(data.error || "Failed to fetch live game");
				setGame(null);
				return;
			}

			setRiotId({ gameName: name, tagLine: tag });
			setPlatform(region);
			setGame(data);
			setLastChecked(Date.now());
			enabledRef.current = true;
		} catch (err) {
			console.error("Failed to fetch live game:", err);
			setError("Failed to fetch live game");
		} finally {
			setIsLoading(false);
		}
	}, []);

	// Ticks the in-game clock and re-polls every POLL_MS once a check has run.
	useEffect(() => {
		const interval = setInterval(() => {
			setNow(Date.now());
			if (enabledRef.current && !isLoading && lastChecked && Date.now() - lastChecked >= POLL_MS) {
				check(gameName, tagLine, platform);
			}
		}, 1000);
		return () => clearInterval(interval);
	}, [check, gameName, tagLine, platform, isLoading, lastChecked]);

	// Champ select only exists in the local League client, and polling localhost is free —
	// no Riot ID needed, no rate limit. Once a game is running champ select is over, so it stops.
	useEffect(() => {
		if (inGame) {
			setChampSelect(null);
			return;
		}

		let cancelled = false;
		const poll = async () => {
			try {
				const response = await fetch("/api/champ-select");
				const data = await response.json();
				if (!cancelled) setChampSelect(data.active ? data : null);
			} catch {
				if (!cancelled) setChampSelect(null);
			}
		};
		poll();
		const interval = setInterval(poll, 2000);
		return () => {
			cancelled = true;
			clearInterval(interval);
		};
	}, [inGame]);

	// Remember the running game so its result can be recorded once it disappears from spectator.
	useEffect(() => {
		if (inGame && game?.gameId) {
			finishedGameRef.current = {
				matchId: `${platform.toUpperCase()}_${game.gameId}`,
				puuid: game.puuid,
			};
			setResult(null);
		}
	}, [inGame, game, platform]);

	// Game over: pull the finished match and write the placement to local storage. Riot needs a
	// moment to publish it, hence the retries.
	useEffect(() => {
		if (inGame || !finishedGameRef.current) return;

		const { matchId, puuid } = finishedGameRef.current;
		finishedGameRef.current = null;
		let cancelled = false;
		let attempts = 0;

		const record = async () => {
			attempts++;
			try {
				const response = await fetch(`/api/match/${matchId}`);
				if (response.ok) {
					const data = await response.json();
					const me = data.matchInfo?.info?.participants?.find(
						(p: { puuid: string }) => p.puuid === puuid
					);
					if (me && !cancelled) {
						cacheMatch(matchId, data.matchInfo, puuid);

						const history = getMatchHistory(puuid);
						if (!history.some((m) => m.matchId === matchId)) {
							setMatchHistory(
								[
									{ matchId, champion: me.championName, placement: me.placement },
									...history,
								],
								puuid
							);
						}

						if (me.placement === 1) {
							const progress = getArenaProgress();
							if (!progress.firstPlaceChampions.includes(me.championName)) {
								setArenaProgress({
									firstPlaceChampions: [...progress.firstPlaceChampions, me.championName],
								});
							}
							setResult(`First place with ${me.championName} — saved to your tracker`);
						} else {
							setResult(`Finished #${me.placement} with ${me.championName}`);
						}
						return;
					}
				}
			} catch {
				// fall through to the retry
			}
			if (!cancelled && attempts < 5) {
				setTimeout(record, 15000);
			} else if (!cancelled) {
				setResult("Could not read the last match result yet — hit Update in Match History");
			}
		};

		record();
		return () => {
			cancelled = true;
		};
	}, [inGame]);

	// Whatever we are on right now: hovered in champ select, or locked in and playing.
	const myChampionId =
		champSelect?.myChampionId ||
		game?.participants?.find((p) => p.puuid === game.puuid)?.championId ||
		0;

	useEffect(() => {
		if (!myChampionId) {
			setBuild(null);
			return;
		}
		let cancelled = false;
		fetch(`/api/build?championId=${myChampionId}`)
			.then((response) => response.json())
			.then((data) => {
				if (!cancelled) setBuild(data.found ? data : null);
			})
			.catch(() => {
				if (!cancelled) setBuild(null);
			});
		return () => {
			cancelled = true;
		};
	}, [myChampionId]);

	const wonChampions = new Set(getArenaProgress().firstPlaceChampions);
	const myChampion = images.find((image) => image.key === myChampionId);
	const elapsed =
		game?.gameStartTime && game.gameStartTime > 0
			? Math.floor((now - game.gameStartTime) / 1000)
			: (game?.gameLength ?? 0);
	const queueName = game?.gameQueueConfigId
		? QUEUE_NAMES[game.gameQueueConfigId] || `Queue ${game.gameQueueConfigId}`
		: "";

	// Champions still missing a #1, minus everything banned or already taken this game.
	const takenIds = new Set([
		...(game?.bannedChampionIds || []),
		...(game?.participants || []).map((p) => p.championId),
		...(champSelect?.bannedChampionIds || []),
		...(champSelect?.pickedChampionIds || []),
	]);
	// Best 1st-place rate first — that is the whole point of the achievement. Sort is stable, so
	// champions without stats keep their alphabetical order at the bottom.
	const available = images
		.filter(
			(image) =>
				!wonChampions.has(image.name) &&
				!takenIds.has(image.key) &&
				(role === "All" || image.tags.includes(role))
		)
		.sort((a, b) => b.top1 - a.top1);

	return (
		<div className="space-y-6">
			<div className="flex flex-col sm:flex-row gap-4 sm:items-end">
				<div className="flex-1">
					<label htmlFor="liveGameName" className="block text-sm font-medium mb-1">
						Game Name
					</label>
					<input
						type="text"
						id="liveGameName"
						value={gameName}
						onChange={(e) => {
							const val = e.target.value;
							if (val.includes("#")) {
								setGameName(val.replace("#", ""));
								tagLineInputRef.current?.focus();
							} else {
								setGameName(val);
							}
						}}
						className="w-full px-3 py-2 border rounded-md dark:bg-gray-800 dark:border-gray-700"
						placeholder="Enter game name"
					/>
				</div>
				<div className="flex-1">
					<label htmlFor="liveTagLine" className="block text-sm font-medium mb-1">
						Tag Line
					</label>
					<div className="relative">
						<span
							className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500"
							aria-hidden="true"
						>
							#
						</span>
						<input
							ref={tagLineInputRef}
							type="text"
							id="liveTagLine"
							value={tagLine}
							onChange={(e) => setTagLine(e.target.value.replaceAll("#", ""))}
							className="w-full pl-7 pr-3 py-2 border rounded-md dark:bg-gray-800 dark:border-gray-700"
							placeholder="Enter tag line"
						/>
					</div>
				</div>
				<div>
					<label htmlFor="livePlatform" className="block text-sm font-medium mb-1">
						Region
					</label>
					<select
						id="livePlatform"
						value={platform}
						onChange={(e) => setPlatformState(e.target.value)}
						className="h-[42px] px-3 border rounded-md dark:bg-gray-800 dark:border-gray-700"
					>
						{PLATFORMS.map((p) => (
							<option key={p.value} value={p.value}>
								{p.label}
							</option>
						))}
					</select>
				</div>
				<button
					onClick={() => check(gameName, tagLine, platform)}
					disabled={isLoading}
					className="h-[42px] px-4 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
				>
					{isLoading ? "Checking..." : "Check"}
				</button>
			</div>

			{error && (
				<div className="p-4 bg-red-100 text-red-700 rounded-md dark:bg-red-900 dark:text-red-100">
					{error}
				</div>
			)}

			{result && (
				<div
					className={`p-4 rounded-md ${
						result.startsWith("First place")
							? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100 font-semibold"
							: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300"
					}`}
				>
					{result}
				</div>
			)}

			{champSelect && (
				<div className="flex items-center justify-between flex-wrap gap-2 p-3 rounded-lg border border-purple-400 bg-purple-50 dark:bg-purple-950/30">
					<h2 className="text-lg font-semibold flex items-center gap-2">
						<span className="w-2.5 h-2.5 rounded-full bg-purple-500 animate-pulse" />
						Champ Select{champSelect.phase ? ` · ${champSelect.phase}` : ""}
					</h2>
					<div className="text-sm text-gray-600 dark:text-gray-400 tabular-nums">
						{champSelect.bannedChampionIds.length} banned · {champSelect.pickedChampionIds.length}{" "}
						taken
						{champSelect.timeLeftMs !== null && ` · ${Math.ceil(champSelect.timeLeftMs / 1000)}s`}
					</div>
				</div>
			)}

			{inGame && (
				<div className="flex items-center justify-between flex-wrap gap-2 p-3 rounded-lg border border-red-300 dark:border-red-900 bg-red-50 dark:bg-red-950/30">
					<h2 className="text-lg font-semibold flex items-center gap-2">
						<span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
						Live · {queueName}
					</h2>
					<div className="text-sm text-gray-600 dark:text-gray-400 tabular-nums">
						{formatDuration(elapsed)} · refreshing every 30s
					</div>
				</div>
			)}

			{game && !game.inGame && !champSelect && (
				<div className="text-center py-12 text-gray-500 dark:text-gray-400">
					<div className="text-lg">Not in a game right now</div>
					<div className="text-sm mt-1">Auto-refreshing every 30s</div>
				</div>
			)}

			{myChampion && (
				<div className="space-y-4">
					<div className="flex items-center gap-3">
						<div className="relative w-14 h-14 shrink-0">
							<Image
								src={myChampion.src}
								alt={myChampion.displayName}
								fill
								className="object-cover rounded"
								sizes="56px"
							/>
						</div>
						<div>
							<div className="text-lg font-semibold">{myChampion.displayName}</div>
							<div
								className={`text-sm ${
									wonChampions.has(myChampion.name)
										? "text-gray-600 dark:text-gray-400"
										: "text-yellow-600 dark:text-yellow-400 font-medium"
								}`}
							>
								{wonChampions.has(myChampion.name)
									? "Already won #1 with this champion"
									: "No #1 yet — win this one for the tracker!"}
							</div>
						</div>
					</div>

					{build?.stats && (
						<div className="grid grid-cols-3 sm:grid-cols-6 gap-px bg-gray-200 dark:bg-gray-700 rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700">
							<Stat label="Tier" value={build.stats.tier || "—"} />
							<Stat label="Avg. Place" value={build.stats.avgPlacement.toFixed(1)} />
							<Stat label="1st Place" value={`${Math.round(build.stats.top1 * 100)}%`} />
							<Stat label="Top 4" value={`${Math.round(build.stats.top4 * 100)}%`} />
							<Stat label="Pick Rate" value={`${(build.stats.pickRate * 100).toFixed(1)}%`} />
							<Stat label="Appearances" value={build.stats.appearances.toLocaleString()} />
						</div>
					)}

					{build?.groups && (
						<div className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
							{build.groups.map((group) => {
								const limit = COMPACT_LIMITS[group.title] ?? 3;
								const entries = showAll ? group.entries : group.entries.slice(0, limit);
								return (
									<div key={group.title} className="space-y-1.5">
										<h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
											{group.title}
											{!showAll && group.entries.length > limit && (
												<span className="ml-1 normal-case font-normal">
													({limit} of {group.entries.length})
												</span>
											)}
										</h3>
										<div className="flex flex-wrap gap-1.5">
											{entries.map((entry) => (
												<div
													key={entry.id}
													className="w-12"
													title={`${entry.name} — ${(entry.pickRate * 100).toFixed(1)}% pick rate, ${(entry.top1 * 100).toFixed(1)}% 1st place (${entry.games.toLocaleString()} games)`}
												>
													<div className="relative w-12 h-12">
														<Image
															src={entry.icon}
															alt={entry.name}
															fill
															className="object-cover rounded"
															sizes="48px"
														/>
														{entry.tier && (
															<span
																className={`absolute -bottom-1 -left-1 w-4 h-4 rounded-full text-white text-[9px] font-bold flex items-center justify-center ${
																	TIER_COLORS[entry.tier] || "bg-gray-500"
																}`}
															>
																{entry.tier}
															</span>
														)}
													</div>
													<div className="mt-0.5 text-center text-[10px] tabular-nums text-gray-500 dark:text-gray-400">
														{(entry.pickRate * 100).toFixed(1)}%
													</div>
												</div>
											))}
										</div>
									</div>
								);
							})}
						</div>
					)}

					{build?.groups && (
						<button
							onClick={() => setShowAll((prev) => !prev)}
							className="px-3 py-1.5 text-sm rounded-md bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700"
						>
							{showAll ? "Show less" : "Show all"}
						</button>
					)}
				</div>
			)}

			<div className="space-y-3 pt-2 border-t border-gray-200 dark:border-gray-700">
				<div className="flex items-center justify-between flex-wrap gap-2">
					<h2 className="text-xl font-semibold">
						Still needed ({available.length})
						<span className="ml-2 text-sm font-normal text-gray-500 dark:text-gray-400">
							best 1st-place rate first
							{(inGame || champSelect) && ", banned and picked excluded"}
						</span>
					</h2>
					<select
						value={role}
						onChange={(e) => setRole(e.target.value)}
						aria-label="Filter by class"
						className="h-[38px] px-3 border rounded-md dark:bg-gray-800 dark:border-gray-700"
					>
						{ROLES.map((r) => (
							<option key={r} value={r}>
								{r === "All" ? "All classes" : r}
							</option>
						))}
					</select>
				</div>

				{available.length === 0 ? (
					<div className="text-center py-8 text-gray-500 dark:text-gray-400">
						Nothing left here — every champion in this filter already has a #1.
					</div>
				) : (
					<div className="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-10 gap-2">
						{available.map((image) => (
							<div
								key={image.name}
								className="relative aspect-square rounded overflow-hidden"
								title={`${image.displayName}${image.top1 > 0 ? ` — ${(image.top1 * 100).toFixed(1)}% 1st place` : ""}`}
							>
								<Image
									src={image.src}
									alt={image.displayName}
									fill
									className="object-cover"
									sizes="(max-width: 640px) 25vw, (max-width: 1024px) 16vw, 10vw"
								/>
								<div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
								{image.top1 > 0 && (
									<div className="absolute top-0.5 right-0.5 px-1 rounded bg-black/70 text-white text-[10px] font-bold tabular-nums">
										{Math.round(image.top1 * 100)}%
									</div>
								)}
								<div className="absolute bottom-0 left-0 right-0 px-1 pb-0.5 text-white text-[10px] truncate text-center">
									{image.displayName}
								</div>
							</div>
						))}
					</div>
				)}
			</div>
		</div>
	);
}

function Stat({ label, value }: { label: string; value: string }) {
	return (
		<div className="bg-white dark:bg-gray-800 px-3 py-2 text-center">
			<div className="text-[10px] uppercase tracking-wide text-gray-500 dark:text-gray-400">
				{label}
			</div>
			<div className="text-lg font-semibold tabular-nums">{value}</div>
		</div>
	);
}
