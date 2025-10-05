"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { MatchResult } from "../types";
import {
	getRiotId,
	setRiotId,
	getMatchHistory,
	setMatchHistory,
	getCachedMatch,
	cacheMatch,
	getArenaProgress,
	setArenaProgress,
} from "../lib/storage";
import {
	getRiotAccount,
	getMatchIds,
	getMatchInfo,
	getPlayerMatchResult,
} from "../lib/riot-api";
import { ImageTile } from "../lib/images";

const PLACEMENT_COLORS = {
	1: "bg-yellow-500 dark:bg-yellow-600",
	2: "bg-gray-400 dark:bg-gray-700",
	3: "bg-gray-400 dark:bg-gray-700",
	4: "bg-gray-400 dark:bg-gray-700",
	5: "bg-gray-400 dark:bg-gray-700",
	6: "bg-gray-400 dark:bg-gray-700",
	7: "bg-gray-400 dark:bg-gray-700",
	8: "bg-gray-400 dark:bg-gray-700",
} as const;

interface MatchHistoryProps {
	images: ImageTile[];
}

export function MatchHistory({ images }: MatchHistoryProps) {
	const [gameName, setGameName] = useState("");
	const [tagLine, setTagLine] = useState("");
	const [tagLinePrefixActive, setTagLinePrefixActive] = useState(false);
	const [matchHistory, setMatchHistoryState] = useState<MatchResult[]>([]);
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		const storedRiotId = getRiotId();
		if (storedRiotId) {
			setGameName(storedRiotId.gameName);
			setTagLine(storedRiotId.tagLine);
			setTagLinePrefixActive(Boolean(storedRiotId.tagLine));
		}
		setMatchHistoryState(getMatchHistory());
	}, []);

const handleUpdate = async () => {
		if (!gameName || !tagLine) {
			setError("Please enter both game name and tag line");
			return;
		}

		setIsLoading(true);
		setError(null);

		try {
			const account = await getRiotAccount(gameName, tagLine);
			if (
				account &&
				typeof account === "object" &&
				"error" in account &&
				(account as { error?: unknown }).error
			) {
				const errorValue = (account as { error?: unknown }).error;
				setError(
					typeof errorValue === "string"
						? errorValue
						: (typeof errorValue === "object" &&
							errorValue !== null &&
							"status" in errorValue &&
							typeof (errorValue as any).status?.message === "string")
							? (errorValue as { status?: { message?: string } }).status?.message ?? "Unknown error"
							: "Unknown error"
				);
				return;
			}

			if (!account.data) {
				setError("No account data received");
				return;
			}

			const newRiotId = {
				gameName: account.data.gameName,
				tagLine: account.data.tagLine,
			};
			setRiotId(newRiotId);

			const matchIds = await getMatchIds(account.data.puuid);
			if ("error" in matchIds) {
				setError(typeof matchIds.error === "string" ? matchIds.error : "Failed to fetch match IDs");
				return;
			}

			if (!matchIds.data) {
				setError("No match IDs received");
				return;
			}

			// Process matches in batches to respect rate limits
			const BATCH_SIZE = 15; // Reduced from 20 to be more conservative
			const BATCH_DELAY = 1500; // Increased to 1.5 seconds between batches
			const newHistory: (MatchResult & { isNewMatch: boolean })[] = [];

			for (let i = 0; i < matchIds.data.length; i += BATCH_SIZE) {
				const batch = matchIds.data.slice(i, i + BATCH_SIZE);
				const batchPromises = batch.map(async (matchId) => {
					// Check cache first
					const cachedMatch = getCachedMatch(matchId);
					if (cachedMatch) {
						const result = getPlayerMatchResult(
							cachedMatch,
							account.data.puuid
						);
						if (result) {
							return {
								...result,
								matchId,
								isNewMatch: false,
							};
						}
						return null;
					}

					// If not in cache, fetch from API
					const matchInfo = await getMatchInfo(matchId);
					if ("error" in matchInfo || !matchInfo.data) return null;

					// Cache the match info
					cacheMatch(matchId, matchInfo.data);

					const result = getPlayerMatchResult(
						matchInfo.data,
						account.data.puuid
					);
					if (result) {
						return {
							...result,
							matchId,
							isNewMatch: true,
						};
					}
					return null;
				});

				const batchResults = await Promise.all(batchPromises);
				const validResults = batchResults.filter(
					(result): result is MatchResult & { isNewMatch: boolean } =>
						result !== null
				);
				newHistory.push(...validResults);

				// Add delay between batches if there are more matches to process
				if (i + BATCH_SIZE < matchIds.data.length) {
					await new Promise((resolve) =>
						setTimeout(resolve, BATCH_DELAY)
					);
				}
			}

			setMatchHistoryState(newHistory);
			setMatchHistory(newHistory);

			// Check for first place finishes only in new matches
			const newFirstPlaceChampions = newHistory
				.filter((result) => result.isNewMatch && result.placement === 1)
				.map((result) => result.champion);

			if (newFirstPlaceChampions.length > 0) {
				const currentProgress = getArenaProgress();
				const newProgress = {
					firstPlaceChampions: [
						...new Set([
							...currentProgress.firstPlaceChampions,
							...newFirstPlaceChampions,
						]),
					],
				};
				setArenaProgress(newProgress);
			}
		} catch (error) {
			console.error("Failed to update match history:", error);
			setError("Failed to update match history");
		} finally {
			setIsLoading(false);
		}
};

	return (
		<div className="space-y-6">
			<div className="flex flex-col sm:flex-row gap-4 sm:items-end">
				<div className="flex-1">
					<label
						htmlFor="gameName"
						className="block text-sm font-medium mb-1"
					>
						Game Name
					</label>
					<input
						type="text"
						id="gameName"
						value={gameName}
						onChange={(e) => setGameName(e.target.value)}
						className="w-full px-3 py-2 border rounded-md dark:bg-gray-800 dark:border-gray-700"
						placeholder="Enter game name"
					/>
				</div>
				<div className="flex-1">
					<label
						htmlFor="tagLine"
						className="block text-sm font-medium mb-1"
					>
						Tag Line
					</label>
					<div className="relative">
						<span
							className={`pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 ${
								tagLinePrefixActive
									? "text-gray-900 dark:text-gray-100"
									: "text-gray-400 dark:text-gray-500"
							}`}
							aria-hidden="true"
						>
							#
						</span>
						<input
							type="text"
							id="tagLine"
							value={tagLine}
							onChange={(e) => {
								const raw = e.target.value;
								setTagLinePrefixActive(raw.length > 0 || raw.includes("#"));
								const sanitized = raw.replaceAll("#", "");
								setTagLine(sanitized);
							}}
							className="w-full pl-7 pr-3 py-2 border rounded-md dark:bg-gray-800 dark:border-gray-700"
							placeholder="Enter tag line"
						/>
					</div>
				</div>
				<button
					onClick={handleUpdate}
					disabled={isLoading}
					className="h-[42px] px-4 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
				>
					{isLoading ? "Updating..." : "Update"}
				</button>
			</div>

			{error && (
				<div className="p-4 bg-red-100 text-red-700 rounded-md dark:bg-red-900 dark:text-red-100">
					{error}
				</div>
			)}

			<div className="space-y-4">
				<h2 className="text-xl font-semibold">Recent Matches</h2>
				<div className="grid gap-4">
					{matchHistory.map((match) => (
						<div
							key={match.matchId}
							className={`p-4 border rounded-lg dark:border-gray-700 transition-colors ${
								match.placement === 1
									? "bg-yellow-50 dark:bg-yellow-950/30 border-yellow-200 dark:border-yellow-800"
									: ""
							}`}
						>
							<div className="flex items-center gap-4">
								<div className="relative w-16 h-16 flex-shrink-0">
									<Image
										src={images.find((image) => image.name === match.champion)?.src || ""}
										alt={match.champion}
										fill
										priority
										className="object-cover rounded-lg"
										sizes="64px"
									/>
								</div>
								<div className="flex-1">
									<div className="flex items-center gap-2">
										<span className="font-medium text-lg">
											{match.champion}
										</span>
										<div
											className={`px-2 py-1 rounded-full text-white text-sm font-medium ${
												PLACEMENT_COLORS[
													match.placement as keyof typeof PLACEMENT_COLORS
												] ||
												"bg-gray-500 dark:bg-gray-600"
											}`}
										>
											#{match.placement}
										</div>
									</div>
									<div className="text-sm text-gray-500 dark:text-gray-400 mt-1">
										Match ID: {match.matchId}
									</div>
								</div>
							</div>
						</div>
					))}
				</div>
			</div>
		</div>
	);
}
