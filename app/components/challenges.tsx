"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Trophy, Crown, ExternalLink } from "lucide-react";
import {
	ChallengeDef,
	ChallengeGroup,
	ChallengeProgress,
	GOD_CHALLENGES,
	LEVEL_STYLES,
	PlayerChallenges,
	flattenChallenges,
	formatPercentile,
	nextThreshold,
} from "../lib/challenges";
import { Locale, localePath, t } from "../lib/i18n";
import { getArenaProgress, getUserPuuid } from "../lib/storage";
import { useAccount } from "./account";

const NUMBER_LOCALE: Record<Locale, string> = { en: "en-US", de: "de-DE" };

interface TotalPoints {
	level?: string;
	current?: number;
	max?: number;
	percentile?: number;
}

interface ChallengesProps {
	groups: ChallengeGroup[];
	locale: Locale;
}

function LevelBadge({ level, unranked }: { level: string; unranked: string }) {
	return (
		<span
			className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
				LEVEL_STYLES[level] || LEVEL_STYLES.NONE
			}`}
		>
			{level === "NONE" ? unranked : level}
		</span>
	);
}

function ProgressBar({ percent, level }: { percent: number; level: string }) {
	return (
		<div className="h-1.5 bg-gray-200 dark:bg-gray-700/70 rounded-full overflow-hidden">
			<div
				className={`h-full rounded-full transition-[width] duration-500 ${
					level === "NONE" ? "bg-gray-500" : "bg-blue-500"
				}`}
				style={{ width: `${percent}%` }}
			/>
		</div>
	);
}

function ChallengeRow({
	def,
	progress,
	locale,
}: {
	def: ChallengeDef;
	progress?: ChallengeProgress;
	locale: Locale;
}) {
	const dict = t(locale);
	const num = (n: number) => n.toLocaleString(NUMBER_LOCALE[locale]);
	const value = progress?.value ?? 0;
	const level = progress?.level ?? "NONE";
	const { next, target, percent } = nextThreshold(def, value);
	const percentile = formatPercentile(progress?.percentile);
	const maxed = !next;

	return (
		<li className="py-3 first:pt-0 last:pb-0">
			<div className="flex items-baseline justify-between gap-3 flex-wrap">
				<div className="flex items-center gap-2 min-w-0">
					<h4 className="text-sm font-medium truncate">
						<Link
							href={localePath(locale, `challenge/${def.slug}`)}
							className="hover:text-blue-400 transition-colors"
						>
							{def.name}
						</Link>
					</h4>
					<LevelBadge level={level} unranked={dict.challenges.unranked} />
					{maxed && value > 0 && <Crown className="w-3.5 h-3.5 text-yellow-400 shrink-0" />}
				</div>
				<div className="font-mono text-xs text-gray-500 dark:text-gray-400 shrink-0">
					{num(value)}
					<span className="text-gray-600"> / {num(target)}</span>
					{next && <span className="ml-1 text-gray-600">&rarr; {next.level.toLowerCase()}</span>}
				</div>
			</div>
			<p className="text-xs text-gray-500 dark:text-gray-400 mt-1 mb-2">{def.description}</p>
			<ProgressBar percent={percent} level={level} />
			{(percentile || progress?.position) && (
				<div className="flex gap-3 mt-1.5 text-[11px] text-gray-500">
					{percentile && <span>{dict.challenges.ofPlayers(percentile)}</span>}
					{progress?.position ? (
						<span>
							{progress.playersInLevel
								? dict.challenges.rankIn(
										num(progress.position),
										num(progress.playersInLevel),
										(progress.level || "").toLowerCase()
									)
								: dict.challenges.rank(num(progress.position))}
						</span>
					) : null}
				</div>
			)}
		</li>
	);
}

function GroupCard({
	group,
	player,
	locale,
}: {
	group: ChallengeGroup;
	player: PlayerChallenges | null;
	locale: Locale;
}) {
	const dict = t(locale);
	const num = (n: number) => n.toLocaleString(NUMBER_LOCALE[locale]);
	const parentProgress = group.parent ? player?.[String(group.parent.id)] : undefined;
	const parentBar = group.parent ? nextThreshold(group.parent, parentProgress?.value ?? 0) : null;

	return (
		<section className="rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-white/[0.02] p-5 sm:p-6">
			<div className="flex items-start justify-between gap-3 mb-1 flex-wrap">
				<h3 className="text-lg font-semibold">
					{group.parent ? (
						<Link
							href={localePath(locale, `challenge/${group.parent.slug}`)}
							className="hover:text-blue-400 transition-colors"
						>
							{group.name}
						</Link>
					) : (
						group.name
					)}
				</h3>
				{group.parent && (
					<LevelBadge level={parentProgress?.level ?? "NONE"} unranked={dict.challenges.unranked} />
				)}
			</div>
			<p className="text-sm text-gray-500 dark:text-gray-400">{group.description}</p>

			{group.parent && parentBar && (
				<div className="mt-3 space-y-1">
					<div className="flex justify-between font-mono text-xs text-gray-500">
						<span>
							{num(parentProgress?.value ?? 0)} {dict.challenges.points}
						</span>
						<span>
							{parentBar.next
								? dict.challenges.forLevel(parentBar.next.level.toLowerCase(), num(parentBar.target))
								: dict.challenges.maxed}
						</span>
					</div>
					<ProgressBar percent={parentBar.percent} level={parentProgress?.level ?? "NONE"} />
				</div>
			)}

			{group.challenges.length > 0 && (
				<ul className="mt-5 divide-y divide-gray-200 dark:divide-white/5">
					{group.challenges.map((def) => (
						<ChallengeRow
							key={def.id}
							def={def}
							progress={player?.[String(def.id)]}
							locale={locale}
						/>
					))}
				</ul>
			)}
		</section>
	);
}

function GodCard({
	title,
	subtitle,
	def,
	progress,
	loaded,
	locale,
	tracked,
	note,
}: {
	title: string;
	subtitle: string;
	def: ChallengeDef | undefined;
	progress?: ChallengeProgress;
	loaded: boolean;
	locale: Locale;
	tracked?: number;
	note?: string;
}) {
	const dict = t(locale);
	if (!def) return null;
	const value = progress?.value ?? 0;
	const { next, target, percent } = nextThreshold(def, value);

	return (
		<div className="rounded-2xl border border-yellow-500/30 bg-gradient-to-br from-yellow-500/10 to-transparent p-5">
			<div className="flex items-center gap-2 mb-1">
				<Trophy className="w-4 h-4 text-yellow-400" />
				<h3 className="text-sm font-semibold uppercase tracking-wider text-yellow-400">
					<Link href={localePath(locale, `challenge/${def.slug}`)} className="hover:underline">
						{title}
					</Link>
				</h3>
			</div>
			<p className="text-xs text-gray-500 dark:text-gray-400 mb-4">{subtitle}</p>

			<div className="flex items-end gap-4 mb-3">
				<div>
					<div className="font-mono text-4xl font-bold leading-none">
						{loaded ? value : <span className="text-gray-600">&mdash;</span>}
					</div>
					<div className="text-[11px] uppercase tracking-widest text-gray-500 mt-1">
						{dict.challenges.riotValue}
					</div>
				</div>
				{tracked !== undefined && (
					<div>
						<div className="font-mono text-2xl font-bold leading-none text-gray-400">{tracked}</div>
						<div className="text-[11px] uppercase tracking-widest text-gray-500 mt-1">
							{dict.challenges.trackedHere}
						</div>
					</div>
				)}
				<div className="ml-auto text-right">
					<LevelBadge level={progress?.level ?? "NONE"} unranked={dict.challenges.unranked} />
					<div className="font-mono text-[11px] text-gray-500 mt-1">
						{next
							? dict.challenges.forLevel(next.level.toLowerCase(), String(target))
							: dict.challenges.maxLevel}
					</div>
				</div>
			</div>

			<ProgressBar percent={loaded ? percent : 0} level={progress?.level ?? "NONE"} />
			{note && <p className="text-[11px] text-gray-500 mt-3">{note}</p>}
			{loaded && tracked !== undefined && value > tracked && (
				<p className="text-[11px] text-yellow-500/90 mt-2">{dict.challenges.gap(value - tracked)}</p>
			)}
		</div>
	);
}

export function Challenges({ groups, locale }: ChallengesProps) {
	const dict = t(locale);
	const num = (n: number) => n.toLocaleString(NUMBER_LOCALE[locale]);
	const { account, isSet } = useAccount();
	const { gameName, tagLine, platform } = account;
	const [player, setPlayer] = useState<PlayerChallenges | null>(null);
	const [totalPoints, setTotalPoints] = useState<TotalPoints | null>(null);
	const [trackedArena, setTrackedArena] = useState<number | undefined>(undefined);
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		setTrackedArena(getArenaProgress().firstPlaceChampions.length);
	}, []);

	const load = async () => {
		if (!isSet) {
			setError(t(locale).account.missing);
			return;
		}
		setIsLoading(true);
		setError(null);
		try {
			const puuid = getUserPuuid() || "";
			const response = await fetch(
				`/api/challenges?gameName=${encodeURIComponent(gameName)}&tagLine=${encodeURIComponent(tagLine)}&platform=${platform}` +
					(puuid ? `&puuid=${encodeURIComponent(puuid)}` : "")
			);
			const data = await response.json();
			if (!response.ok) {
				setError(data.error || dict.challenges.failed);
				setPlayer(null);
				return;
			}
			setPlayer(data.challenges || {});
			setTotalPoints(data.totalPoints || null);
		} catch (err) {
			console.error("Failed to fetch challenges:", err);
			setError(dict.challenges.failed);
		} finally {
			setIsLoading(false);
		}
	};

	const allDefs = flattenChallenges(groups);
	const arenaGod = allDefs.find((d) => d.id === GOD_CHALLENGES.arena);
	const aramGod = allDefs.find((d) => d.id === GOD_CHALLENGES.aram);
	const categories = ["Arena", "ARAM", "Seasonal"] as const;

	return (
		<div className="space-y-8">
			<button
				onClick={load}
				disabled={isLoading || !isSet}
				className="h-[42px] px-5 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:opacity-50 whitespace-nowrap"
			>
				{isLoading ? dict.challenges.loading : dict.challenges.load}
			</button>

			{error && (
				<p className="text-sm text-red-500 dark:text-red-400" role="alert">
					{error}
				</p>
			)}

			{groups.length === 0 && (
				<p className="text-sm text-gray-500 dark:text-gray-400">{dict.challenges.unavailable}</p>
			)}

			{totalPoints && (
				<div className="rounded-2xl border border-gray-200 dark:border-white/10 bg-gradient-to-br from-blue-500/10 to-transparent p-5 flex items-center gap-6 flex-wrap">
					<div>
						<div className="font-mono text-3xl font-bold leading-none">
							{num(totalPoints.current ?? 0)}
							<span className="text-lg text-gray-500"> / {num(totalPoints.max ?? 0)}</span>
						</div>
						<div className="text-[11px] uppercase tracking-widest text-gray-500 mt-1">
							{dict.challenges.totalPoints}
						</div>
					</div>
					<LevelBadge level={totalPoints.level || "NONE"} unranked={dict.challenges.unranked} />
					{formatPercentile(totalPoints.percentile) && (
						<span className="text-xs text-gray-500">
							{dict.challenges.ofPlayers(formatPercentile(totalPoints.percentile) as string)}
						</span>
					)}
				</div>
			)}

			{(arenaGod || aramGod) && (
				<div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
					<GodCard
						title={dict.challenges.arenaGod}
						subtitle={dict.challenges.arenaGodSub}
						def={arenaGod}
						progress={player?.[String(GOD_CHALLENGES.arena)]}
						loaded={player !== null}
						locale={locale}
						tracked={trackedArena}
					/>
					<GodCard
						title={dict.challenges.aramGod}
						subtitle={dict.challenges.aramGodSub}
						def={aramGod}
						progress={player?.[String(GOD_CHALLENGES.aram)]}
						loaded={player !== null}
						locale={locale}
						note={dict.challenges.aramNote}
					/>
				</div>
			)}

			{categories.map((category) => {
				const inCategory = groups.filter((g) => g.category === category);
				if (inCategory.length === 0) return null;
				return (
					<div key={category} className="space-y-4">
						<div>
							<h2 className="text-xl font-bold">{dict.challenges.categoryLabels[category]}</h2>
							<p className="text-sm text-gray-500 dark:text-gray-400 max-w-3xl">
								{dict.challenges.categoryBlurbs[category]}
							</p>
						</div>
						{inCategory.map((group) => (
							<GroupCard key={group.id} group={group} player={player} locale={locale} />
						))}
					</div>
				);
			})}

			<p className="text-xs text-gray-500 dark:text-gray-400">
				{dict.challenges.source}{" "}
				<a
					href="https://developer.riotgames.com/apis#lol-challenges-v1"
					target="_blank"
					rel="noopener noreferrer"
					className="text-blue-400 hover:underline inline-flex items-center gap-1"
				>
					lol-challenges-v1 <ExternalLink className="w-3 h-3" />
				</a>
			</p>
		</div>
	);
}
