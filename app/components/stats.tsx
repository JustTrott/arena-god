"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { getMatchHistory, getMatchCache, getUserPuuid } from "../lib/storage";
import { ImageTile } from "../lib/images";
import { MatchResult, MatchInfo } from "../types";

interface StatsProps {
	images: ImageTile[];
}

interface ChampStats {
	champion: string;
	wins: number;
	games: number;
	winrate: number;
	firstGameWon: boolean;
}

interface DuoStats {
	name: string;
	games: number;
	wins: number;
	winrate: number;
}

function computeStats(matches: MatchResult[]): ChampStats[] {
	const chronological = [...matches].reverse();
	const statsMap = new Map<string, { wins: number; games: number; firstGameWon: boolean }>();

	for (const match of chronological) {
		const existing = statsMap.get(match.champion);
		if (existing) {
			existing.games++;
			if (match.placement === 1) existing.wins++;
		} else {
			statsMap.set(match.champion, {
				wins: match.placement === 1 ? 1 : 0,
				games: 1,
				firstGameWon: match.placement === 1,
			});
		}
	}

	return Array.from(statsMap.entries()).map(([champion, data]) => ({
		champion,
		wins: data.wins,
		games: data.games,
		winrate: data.games > 0 ? data.wins / data.games : 0,
		firstGameWon: data.firstGameWon,
	}));
}

function computeDuoStats(matches: MatchResult[], cache: Record<string, MatchInfo>, userPuuid: string | null): DuoStats[] {
	if (!userPuuid) return [];
	const duoMap = new Map<string, { name: string; games: number; wins: number }>();

	for (const match of matches) {
		const matchInfo = cache[match.matchId];
		if (!matchInfo?.info?.participants) continue;

		const user = matchInfo.info.participants.find(p => p.puuid === userPuuid);
		if (!user) continue;

		const teammate = matchInfo.info.participants.find(
			p => p.puuid !== userPuuid && p.placement === user.placement
		);
		if (!teammate) continue;

		const name = teammate.riotIdGameName
			? `${teammate.riotIdGameName}#${teammate.riotIdTagline || "?"}`
			: teammate.puuid.substring(0, 8);

		const existing = duoMap.get(name);
		const won = match.placement === 1;
		if (existing) {
			existing.games++;
			if (won) existing.wins++;
		} else {
			duoMap.set(name, { name, games: 1, wins: won ? 1 : 0 });
		}
	}

	return Array.from(duoMap.values())
		.filter(d => d.games >= 2)
		.map(d => ({ ...d, winrate: d.wins / d.games }));
}

// --- Presentation Components ---

const RANK_STYLES = [
	"from-yellow-500/20 to-yellow-600/5 border-yellow-500/40", // 1st - gold
	"from-gray-300/15 to-gray-400/5 border-gray-400/30",       // 2nd - silver
	"from-amber-700/15 to-amber-800/5 border-amber-600/30",    // 3rd - bronze
] as const;

const RANK_BADGE = [
	"bg-yellow-500 text-black",
	"bg-gray-400 text-black",
	"bg-amber-700 text-white",
] as const;

function StatNumber({ value, label, accent }: { value: string | number; label: string; accent?: boolean }) {
	return (
		<div className="text-center">
			<div className={`font-mono text-3xl sm:text-4xl font-bold tracking-tight ${accent ? "text-yellow-400" : "text-white"}`}>
				{value}
			</div>
			<div className="text-xs uppercase tracking-widest text-gray-500 mt-1">{label}</div>
		</div>
	);
}

function PodiumCard({ rank, champion, stat, subStat, images }: {
	rank: number;
	champion: string;
	stat: string;
	subStat?: string;
	images: ImageTile[];
}) {
	const img = images.find(i => i.name.toLowerCase() === champion.toLowerCase());
	const style = RANK_STYLES[rank] || "";
	const badge = RANK_BADGE[rank] || "bg-gray-600 text-white";

	return (
		<div className={`relative rounded-xl border bg-gradient-to-b ${style} p-3 flex flex-col items-center gap-2`}>
			<div className={`absolute -top-2.5 left-3 px-2 py-0.5 rounded-full text-[10px] font-bold ${badge}`}>
				#{rank + 1}
			</div>
			<div className="relative w-14 h-14 sm:w-16 sm:h-16 rounded-lg overflow-hidden mt-1">
				{img && <Image src={img.src} alt={champion} fill className="object-cover" sizes="64px" />}
			</div>
			<div className="text-sm font-medium text-center truncate w-full">{img?.displayName || champion}</div>
			<div className="font-mono text-lg font-bold text-yellow-400">{stat}</div>
			{subStat && <div className="text-[10px] text-gray-500 -mt-1">{subStat}</div>}
		</div>
	);
}

function ChampPill({ champion, label, images }: { champion: string; label: string; images: ImageTile[] }) {
	const img = images.find(i => i.name.toLowerCase() === champion.toLowerCase());
	return (
		<div className="flex items-center gap-1.5 bg-white/5 border border-white/10 rounded-full pl-1 pr-2.5 py-1">
			{img && (
				<div className="relative w-6 h-6 rounded-full overflow-hidden">
					<Image src={img.src} alt={champion} fill className="object-cover" sizes="24px" />
				</div>
			)}
			<span className="text-sm">{img?.displayName || champion}</span>
			<span className="font-mono text-xs text-gray-400">{label}</span>
		</div>
	);
}

function ExpandableSection({ title, subtitle, children, podium, rest, images, emptyText }: {
	title: string;
	subtitle?: string;
	children?: React.ReactNode;
	podium?: { champion: string; stat: string; subStat?: string }[];
	rest?: { champion: string; label: string }[];
	images: ImageTile[];
	emptyText: string;
}) {
	const [expanded, setExpanded] = useState(false);
	const hasContent = (podium && podium.length > 0) || (rest && rest.length > 0) || children;

	return (
		<div className="space-y-3">
			<div className="flex items-baseline gap-2">
				<h3 className="text-base font-semibold uppercase tracking-wide text-gray-300">{title}</h3>
				{subtitle && <span className="text-xs text-gray-600">{subtitle}</span>}
			</div>

			{!hasContent && <p className="text-sm text-gray-600 italic">{emptyText}</p>}

			{children}

			{podium && podium.length > 0 && (
				<div className="grid grid-cols-3 gap-2">
					{podium.map((item, i) => (
						<PodiumCard key={item.champion} rank={i} champion={item.champion} stat={item.stat} subStat={item.subStat} images={images} />
					))}
				</div>
			)}

			{rest && rest.length > 0 && (
				<>
					{!expanded && (
						<button
							onClick={() => setExpanded(true)}
							className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
						>
							+ {rest.length} more
						</button>
					)}
					{expanded && (
						<div className="flex flex-wrap gap-1.5">
							{rest.map(r => (
								<ChampPill key={r.champion} champion={r.champion} label={r.label} images={images} />
							))}
						</div>
					)}
				</>
			)}
		</div>
	);
}

function DuoPodiumCard({ rank, duo }: { rank: number; duo: DuoStats }) {
	const style = RANK_STYLES[rank] || "";
	const badge = RANK_BADGE[rank] || "bg-gray-600 text-white";

	return (
		<div className={`relative rounded-xl border bg-gradient-to-b ${style} p-3 flex flex-col items-center gap-1`}>
			<div className={`absolute -top-2.5 left-3 px-2 py-0.5 rounded-full text-[10px] font-bold ${badge}`}>
				#{rank + 1}
			</div>
			<div className="text-sm font-medium text-center truncate w-full mt-1">{duo.name}</div>
			<div className="font-mono text-lg font-bold text-yellow-400">{duo.wins}W</div>
			<div className="text-[10px] text-gray-500">{duo.games}G / {Math.round(duo.winrate * 100)}% WR</div>
		</div>
	);
}

// --- Main Component ---

export function Stats({ images }: StatsProps) {
	const [matches, setMatches] = useState<MatchResult[]>([]);
	const [cache, setCache] = useState<Record<string, MatchInfo>>({});
	const [userPuuid, setUserPuuidState] = useState<string | null>(null);

	useEffect(() => {
		setMatches(getMatchHistory());
		setCache(getMatchCache());
		setUserPuuidState(getUserPuuid());
	}, []);

	if (matches.length === 0) {
		return (
			<div className="text-center py-16 space-y-4">
				<div className="text-4xl">&#9876;</div>
				<p className="text-gray-400 text-lg">No match data yet</p>
				<p className="text-sm text-gray-600 max-w-sm mx-auto">
					Play some Arena games, then go to <span className="text-blue-400">Match History</span> to fetch your matches. Stats will appear here automatically.
				</p>
			</div>
		);
	}

	const stats = computeStats(matches);
	const totalGames = matches.length;
	const totalWins = matches.filter(m => m.placement === 1).length;
	const overallWinrate = totalGames > 0 ? Math.round((totalWins / totalGames) * 100) : 0;
	const uniqueChamps = stats.length;
	const uniqueWins = stats.filter(s => s.wins > 0).length;

	// Most wins
	const mostWinsSorted = [...stats]
		.filter(s => s.wins > 0)
		.sort((a, b) => b.wins - a.wins || b.winrate - a.winrate);
	const mostWinsPodium = mostWinsSorted.slice(0, 3);
	const mostWinsRest = mostWinsSorted.slice(3);

	// Highest winrate (min 3 games)
	const winrateSorted = [...stats]
		.filter(s => s.games >= 3 && s.wins > 0)
		.sort((a, b) => b.winrate - a.winrate || b.wins - a.wins);
	const winratePodium = winrateSorted.slice(0, 3);
	const winrateRest = winrateSorted.slice(3);

	// First try wins
	const firstTryWins = stats
		.filter(s => s.firstGameWon)
		.sort((a, b) => a.champion.localeCompare(b.champion));

	// Most tried, never won (min 2 games)
	const neverWon = [...stats]
		.filter(s => s.wins === 0 && s.games >= 2)
		.sort((a, b) => b.games - a.games);

	// Duo stats
	const duoStats = computeDuoStats(matches, cache, userPuuid);
	const mostPlayedDuos = [...duoStats].sort((a, b) => b.games - a.games).slice(0, 5);
	const bestDuos = [...duoStats].filter(d => d.wins > 0).sort((a, b) => b.winrate - a.winrate || b.wins - a.wins).slice(0, 5);

	return (
		<div className="space-y-10">
			{/* Hero Overview */}
			<div className="rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.03] to-transparent p-6 sm:p-8">
				<div className="grid grid-cols-2 sm:grid-cols-5 gap-6 sm:gap-4">
					<StatNumber value={totalGames} label="Games" />
					<StatNumber value={totalWins} label="Wins" accent />
					<StatNumber value={`${overallWinrate}%`} label="Win Rate" />
					<StatNumber value={uniqueChamps} label="Champs" />
					<StatNumber value={uniqueWins} label="Won With" accent />
				</div>
			</div>

			{/* Most Wins */}
			<ExpandableSection
				title="Most Wins"
				images={images}
				emptyText="No wins yet"
				podium={mostWinsPodium.map(s => ({
					champion: s.champion,
					stat: `${s.wins}`,
					subStat: `${s.games}G / ${Math.round(s.winrate * 100)}% WR`,
				}))}
				rest={mostWinsRest.map(s => ({
					champion: s.champion,
					label: `${s.wins}W`,
				}))}
			/>

			{/* Highest Winrate */}
			<ExpandableSection
				title="Highest Winrate"
				subtitle="3+ games"
				images={images}
				emptyText="Play 3+ games on a champion"
				podium={winratePodium.map(s => ({
					champion: s.champion,
					stat: `${Math.round(s.winrate * 100)}%`,
					subStat: `${s.wins}W / ${s.games}G`,
				}))}
				rest={winrateRest.map(s => ({
					champion: s.champion,
					label: `${Math.round(s.winrate * 100)}%`,
				}))}
			/>

			{/* First Try Wins */}
			<ExpandableSection
				title="Won on First Try"
				images={images}
				emptyText="No first-try wins yet"
			>
				{firstTryWins.length > 0 && (
					<div className="flex flex-wrap gap-1.5">
						{firstTryWins.map(s => (
							<ChampPill key={s.champion} champion={s.champion} label={`${s.games}G`} images={images} />
						))}
					</div>
				)}
			</ExpandableSection>

			{/* Never Won */}
			<ExpandableSection
				title="Most Tried, Never Won"
				images={images}
				emptyText="You've won on everything you've tried!"
			>
				{neverWon.length > 0 && (
					<div className="flex flex-wrap gap-1.5">
						{neverWon.map(s => (
							<ChampPill key={s.champion} champion={s.champion} label={`${s.games}G`} images={images} />
						))}
					</div>
				)}
			</ExpandableSection>

			{/* Duo Stats */}
			{duoStats.length > 0 && (
				<div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
					<div className="space-y-3">
						<div className="flex items-baseline gap-2">
							<h3 className="text-base font-semibold uppercase tracking-wide text-gray-300">Most Played Duos</h3>
							<span className="text-xs text-gray-600">2+ games</span>
						</div>
						{mostPlayedDuos.length > 0 ? (
							<div className="grid grid-cols-3 gap-2">
								{mostPlayedDuos.slice(0, 3).map((duo, i) => (
									<DuoPodiumCard key={duo.name} rank={i} duo={duo} />
								))}
							</div>
						) : (
							<p className="text-sm text-gray-600 italic">No duo data</p>
						)}
						{mostPlayedDuos.length > 3 && (
							<div className="flex flex-wrap gap-1.5">
								{mostPlayedDuos.slice(3).map(duo => (
									<div key={duo.name} className="flex items-center gap-1.5 bg-white/5 border border-white/10 rounded-full px-2.5 py-1">
										<span className="text-sm">{duo.name}</span>
										<span className="font-mono text-xs text-gray-400">{duo.games}G</span>
									</div>
								))}
							</div>
						)}
					</div>

					<div className="space-y-3">
						<div className="flex items-baseline gap-2">
							<h3 className="text-base font-semibold uppercase tracking-wide text-gray-300">Best Duos</h3>
							<span className="text-xs text-gray-600">by winrate</span>
						</div>
						{bestDuos.length > 0 ? (
							<div className="grid grid-cols-3 gap-2">
								{bestDuos.slice(0, 3).map((duo, i) => (
									<DuoPodiumCard key={duo.name} rank={i} duo={duo} />
								))}
							</div>
						) : (
							<p className="text-sm text-gray-600 italic">No winning duos yet</p>
						)}
						{bestDuos.length > 3 && (
							<div className="flex flex-wrap gap-1.5">
								{bestDuos.slice(3).map(duo => (
									<div key={duo.name} className="flex items-center gap-1.5 bg-white/5 border border-white/10 rounded-full px-2.5 py-1">
										<span className="text-sm">{duo.name}</span>
										<span className="font-mono text-xs text-gray-400">{Math.round(duo.winrate * 100)}%</span>
									</div>
								))}
							</div>
						)}
					</div>
				</div>
			)}
		</div>
	);
}
