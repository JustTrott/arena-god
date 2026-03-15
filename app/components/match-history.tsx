"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import { MatchResult, MatchInfo } from "../types";
import {
	getRiotId,
	setRiotId,
	getMatchHistory,
	setMatchHistory,
	cacheMatch,
	getArenaProgress,
	setArenaProgress,
	getCachedMatch,
	getUserPuuid,
	setUserPuuid,
	getMatchCache,
} from "../lib/storage";
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

function formatEta(ms: number): string {
	if (ms <= 0) return "";
	const seconds = Math.ceil(ms / 1000);
	if (seconds < 60) return `~${seconds}s remaining`;
	const minutes = Math.floor(seconds / 60);
	const remainingSeconds = seconds % 60;
	return `~${minutes}m ${remainingSeconds}s remaining`;
}

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
	const [statusMessage, setStatusMessage] = useState<string | null>(null);
	const [selectedMatch, setSelectedMatch] = useState<{
		matchId: string;
		matchInfo: MatchInfo | null;
	} | null>(null);
	const [isLoadingMatch, setIsLoadingMatch] = useState(false);
	const [firstPlaceOnly, setFirstPlaceOnly] = useState(false);
	const [fetchProgress, setFetchProgress] = useState({
		totalIds: 0,
		detailsFetched: 0,
		pending: 0,
		etaMs: 0,
	});
	const [activePuuid, setActivePuuidState] = useState<string | null>(null);
	const activePuuidRef = useRef<string | null>(null);
	const setActivePuuid = (puuid: string | null) => {
		setActivePuuidState(puuid);
		activePuuidRef.current = puuid;
	};
	const abortControllerRef = useRef<AbortController | null>(null);
	const tagLineInputRef = useRef<HTMLInputElement>(null);

	useEffect(() => {
		const storedRiotId = getRiotId();
		if (storedRiotId) {
			setGameName(storedRiotId.gameName);
			setTagLine(storedRiotId.tagLine);
			setTagLinePrefixActive(Boolean(storedRiotId.tagLine));
		}
		const puuid = getUserPuuid();
		setActivePuuid(puuid);
		const storedMatches = getMatchHistory(puuid);
		if (storedMatches.length > 0) {
			setMatchHistoryState(storedMatches);
		}
	}, []);

	const handleStreamMatches = async () => {
		if (!gameName || !tagLine) {
			setError("Please enter both game name and tag line");
			return;
		}

		// Abort any in-flight fetch
		if (abortControllerRef.current) {
			abortControllerRef.current.abort();
		}
		const abortController = new AbortController();
		abortControllerRef.current = abortController;

		setIsLoading(true);
		setError(null);
		setStatusMessage("Connecting...");
		setFetchProgress({ totalIds: 0, detailsFetched: 0, pending: 0, etaMs: 0 });

		const cachedMatchIds = Object.keys(getMatchCache(activePuuid));

		try {
			const url = `/api/matches?gameName=${encodeURIComponent(gameName)}&tagLine=${encodeURIComponent(tagLine)}&start=0&count=100` +
				(cachedMatchIds.length > 0 ? `&cachedMatchIds=${cachedMatchIds.join(",")}` : "");
			const response = await fetch(url, { signal: abortController.signal });

			if (!response.ok) {
				const errorData = await response.json();
				setError(errorData.error || "Failed to fetch matches");
				setIsLoading(false);
				setStatusMessage(null);
				return;
			}

			const reader = response.body?.getReader();
			const decoder = new TextDecoder();
			let buffer = "";

			if (!reader) {
				setError("Failed to read stream");
				setIsLoading(false);
				setStatusMessage(null);
				return;
			}

			// We'll track all match IDs from the server to build the correct order
			const allMatchIdsFromServer: string[] = [];

			const processBuffer = (): boolean => {
				const lines = buffer.split("\n\n");
				buffer = lines.pop() || "";

				for (const line of lines) {
					if (!line.trim()) continue;

					const [eventLine, dataLine] = line.split("\ndata: ");
					if (!eventLine || !dataLine) continue;

					const eventMatch = eventLine.match(/event: (\w+)/);
					if (!eventMatch) continue;

					const eventType = eventMatch[1];

					let data;
					try {
						data = JSON.parse(dataLine);
					} catch {
						continue;
					}

					switch (eventType) {
						case "status":
							setStatusMessage(data.message);
							break;
						case "account": {
							const newPuuid = data.data.puuid;
							setRiotId({
								gameName: data.data.gameName,
								tagLine: data.data.tagLine,
							});
							setUserPuuid(newPuuid);
							setActivePuuid(newPuuid);
							// Load this user's existing history
							const existingHistory = getMatchHistory(newPuuid);
							if (existingHistory.length > 0) {
								setMatchHistoryState(existingHistory);
							}
							break;
						}
						case "matchIdBatch":
							if (data.matchIds && Array.isArray(data.matchIds)) {
								allMatchIdsFromServer.push(...data.matchIds);
								setFetchProgress(prev => ({
									...prev,
									totalIds: allMatchIdsFromServer.length,
								}));
							}
							break;
						case "matchIds":
							if (data.count > 0) {
								setStatusMessage(`Found ${data.count} matches. Fetching details...`);
							}
							break;
						case "progress":
							if (data.totalIds !== undefined) {
								setFetchProgress({
									totalIds: data.totalIds || 0,
									detailsFetched: data.detailsFetched || 0,
									pending: data.pending || 0,
									etaMs: data.etaMs || 0,
								});
								if (data.pending > 0) {
									const done = (data.totalIds || 0) - (data.pending || 0);
									const eta = formatEta(data.etaMs || 0);
									setStatusMessage(`Fetching match details... ${done} of ${data.totalIds}${eta ? ` (${eta})` : ""}`);
								}
							}
							break;
						case "match": {
							if (data.matchInfo) {
								cacheMatch(data.matchId, data.matchInfo, activePuuidRef.current);
							}
							const matchResult: MatchResult = {
								matchId: data.matchId,
								champion: data.champion,
								placement: data.placement,
							};
							// Sync win to tracker immediately
							if (matchResult.placement === 1) {
								const progress = getArenaProgress();
								if (!progress.firstPlaceChampions.includes(matchResult.champion)) {
									setArenaProgress({
										firstPlaceChampions: [...progress.firstPlaceChampions, matchResult.champion],
									});
								}
							}
							// Incrementally add to state, maintaining order from server
							setMatchHistoryState(prev => {
								const existingIds = new Set(prev.map(m => m.matchId));
								if (existingIds.has(matchResult.matchId)) {
									// Update existing match in place
									return prev.map(m => m.matchId === matchResult.matchId ? matchResult : m);
								}
								// Insert in correct position based on server order
								const serverIndex = allMatchIdsFromServer.indexOf(matchResult.matchId);
								// Find the right insertion point
								let insertAt = 0;
								for (let i = 0; i < prev.length; i++) {
									const prevServerIndex = allMatchIdsFromServer.indexOf(prev[i].matchId);
									if (prevServerIndex === -1 || serverIndex < prevServerIndex) {
										break;
									}
									insertAt = i + 1;
								}
								const updated = [...prev];
								updated.splice(insertAt, 0, matchResult);
								setMatchHistory(updated, activePuuidRef.current);
								return updated;
							});
							break;
						}
						case "complete":
							setIsLoading(false);

							setFetchProgress(prev => {
								if (prev.totalIds > 0) {
									setStatusMessage(`Complete! ${prev.detailsFetched} new matches fetched.`);
									setTimeout(() => setStatusMessage(null), 3000);
								} else {
									setStatusMessage(null);
								}
								return { ...prev, etaMs: 0 };
							});

							return true;
						case "error":
							setError(data.error || "An error occurred");
							setIsLoading(false);
							setStatusMessage(null);
							return true;
					}
				}
				return false;
			};

			while (true) {
				const { done, value } = await reader.read();

				if (done) {
					if (buffer.trim()) processBuffer();
					break;
				}

				buffer += decoder.decode(value, { stream: true });

				if (processBuffer()) break;
			}
		} catch (error) {
			if (error instanceof DOMException && error.name === "AbortError") {
				return;
			}
			console.error("Failed to stream matches:", error);
			setError("Failed to stream matches");
			setIsLoading(false);
			setStatusMessage(null);
		}
	};

	const handleMatchClick = async (matchId: string) => {
		const cachedMatch = getCachedMatch(matchId, activePuuid);
		if (cachedMatch) {
			setSelectedMatch({ matchId, matchInfo: cachedMatch });
			return;
		}

		setIsLoadingMatch(true);
		try {
			const response = await fetch(`/api/match/${matchId}`);

			if (!response.ok) {
				setError("Failed to fetch match details");
				setIsLoadingMatch(false);
				return;
			}

			const data = await response.json();
			if (data.matchInfo) {
				cacheMatch(matchId, data.matchInfo, activePuuid);
				setSelectedMatch({ matchId, matchInfo: data.matchInfo });
			} else {
				setError("Match details not found");
			}
		} catch (error) {
			console.error("Failed to fetch match:", error);
			setError("Failed to fetch match details");
		} finally {
			setIsLoadingMatch(false);
		}
	};

	const progressPercent = fetchProgress.totalIds > 0
		? Math.round(((fetchProgress.totalIds - fetchProgress.pending) / fetchProgress.totalIds) * 100)
		: 0;

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
							ref={tagLineInputRef}
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
					onClick={handleStreamMatches}
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

			{statusMessage && (
				<div className="p-4 bg-blue-100 text-blue-700 rounded-md dark:bg-blue-900 dark:text-blue-100">
					<div>{statusMessage}</div>
					{isLoading && fetchProgress.totalIds > 0 && fetchProgress.pending > 0 && (
						<div className="mt-2">
							<div className="h-2 bg-blue-200 dark:bg-blue-800 rounded-full overflow-hidden">
								<div
									className="h-full bg-blue-500 transition-all duration-300"
									style={{ width: `${progressPercent}%` }}
								/>
							</div>
							<div className="mt-1 text-xs text-blue-600 dark:text-blue-400 flex justify-between">
								<span>{fetchProgress.totalIds - fetchProgress.pending} of {fetchProgress.totalIds} matches</span>
								<span>{formatEta(fetchProgress.etaMs)}</span>
							</div>
						</div>
					)}
				</div>
			)}

			<div className="space-y-4">
				<div className="flex items-center justify-between">
					<h2 className="text-xl font-semibold">Recent Matches {matchHistory.length > 0 && `(${firstPlaceOnly ? matchHistory.filter(m => m.placement === 1).length + " wins / " : ""}${matchHistory.length})`}</h2>
					{matchHistory.length > 0 && (
						<div className="flex items-center gap-2">
							<button
								onClick={() => {
									const wins = matchHistory
										.filter(m => m.placement === 1)
										.map(m => m.champion);
									const progress = getArenaProgress();
									setArenaProgress({
										firstPlaceChampions: [
											...new Set([...progress.firstPlaceChampions, ...wins]),
										],
									});
									setStatusMessage("Synced wins to tracker!");
									setTimeout(() => setStatusMessage(null), 2000);
								}}
								className="px-3 py-1.5 text-sm rounded-md bg-green-500 text-white hover:bg-green-600 transition-colors"
							>
								Sync to Tracker
							</button>
							<button
								onClick={() => setFirstPlaceOnly(prev => !prev)}
								className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
									firstPlaceOnly
										? "bg-yellow-500 text-white"
										: "bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700"
								}`}
							>
								#1 Only
							</button>
						</div>
					)}
				</div>
				{matchHistory.length === 0 && !isLoading && (
					<div className="text-gray-500 dark:text-gray-400 text-center py-8">
						No matches found
					</div>
				)}
				{matchHistory.length > 0 && (
					<div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
						{matchHistory.filter(m => !firstPlaceOnly || m.placement === 1).map((match) => {
							const isFirstPlace = match.placement === 1;
							const championImage = images.find((image) => image.name.toLowerCase() === match.champion.toLowerCase())?.src;
							return (
								<button
									key={match.matchId}
									onClick={() => handleMatchClick(match.matchId)}
									className={`relative aspect-square rounded-lg overflow-hidden transition-all hover:scale-105 cursor-pointer ${
										isFirstPlace
											? "ring-4 ring-yellow-400 dark:ring-yellow-500 shadow-lg shadow-yellow-500/50 dark:shadow-yellow-600/50"
											: "border-2 border-gray-300 dark:border-gray-700 hover:border-gray-400 dark:hover:border-gray-600"
									}`}
								>
									<div className="relative w-full h-full">
										{championImage && (
											<Image
												src={championImage}
												alt={match.champion}
												fill
												className="object-cover"
												sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, (max-width: 1024px) 25vw, (max-width: 1280px) 20vw, 16vw"
											/>
										)}
										<div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
									</div>
									<div className="absolute bottom-0 left-0 right-0 p-2">
										<div
											className={`px-2 py-1 rounded-full text-white text-xs font-bold text-center ${
												PLACEMENT_COLORS[
													match.placement as keyof typeof PLACEMENT_COLORS
												] ||
												"bg-gray-500 dark:bg-gray-600"
											}`}
										>
											#{match.placement}
										</div>
									</div>
								</button>
							);
						})}
					</div>
				)}
			</div>

			{selectedMatch && (
				<MatchDetailsModal
					matchInfo={selectedMatch.matchInfo}
					images={images}
					onClose={() => setSelectedMatch(null)}
					isLoading={isLoadingMatch}
				/>
			)}
		</div>
	);
}

interface MatchDetailsModalProps {
	matchInfo: MatchInfo | null;
	images: ImageTile[];
	onClose: () => void;
	isLoading: boolean;
}

function MatchDetailsModal({
	matchInfo,
	images,
	onClose,
	isLoading,
}: MatchDetailsModalProps) {
	const userPuuid = getUserPuuid();

	useEffect(() => {
		const handleEscape = (e: KeyboardEvent) => {
			if (e.key === "Escape") {
				onClose();
			}
		};
		window.addEventListener("keydown", handleEscape);
		return () => window.removeEventListener("keydown", handleEscape);
	}, [onClose]);

	if (isLoading) {
		return (
			<div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
				<div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4" onClick={(e) => e.stopPropagation()}>
					<div className="text-center">Loading match details...</div>
				</div>
			</div>
		);
	}

	if (!matchInfo) {
		return (
			<div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
				<div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4" onClick={(e) => e.stopPropagation()}>
					<div className="text-center text-red-500">Match details not available</div>
					<button
						onClick={onClose}
						className="mt-4 w-full px-4 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600"
					>
						Close
					</button>
				</div>
			</div>
		);
	}

	const participants = matchInfo.info?.participants || [];
	const gameStartTimestamp = matchInfo.info?.gameStartTimestamp;

	const teams = new Map<number, typeof participants>();
	const userParticipant = userPuuid
		? participants.find((p) => p.puuid === userPuuid)
		: undefined;

	participants.forEach((participant) => {
		const placement = participant.placement;
		if (!teams.has(placement)) {
			teams.set(placement, []);
		}
		teams.get(placement)!.push(participant);
	});

	const sortedTeams = Array.from(teams.entries()).sort(([placementA], [placementB]) => {
		const userPlacement = userParticipant?.placement;
		if (placementA === userPlacement) return -1;
		if (placementB === userPlacement) return 1;
		return placementA - placementB;
	});

	const formatDate = (timestamp?: number) => {
		if (!timestamp) return "Unknown";
		const date = new Date(timestamp);
		return date.toLocaleDateString(undefined, {
			month: "short",
			day: "numeric",
			year: "numeric",
			hour: "numeric",
			minute: "2-digit",
		});
	};

	return (
		<div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
			<div
				className="bg-white dark:bg-gray-800 rounded-lg max-w-3xl w-full max-h-[85vh] overflow-y-auto"
				onClick={(e) => e.stopPropagation()}
			>
				<div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-2 flex justify-between items-center">
					<h2 className="text-lg font-semibold">Match Details</h2>
					{gameStartTimestamp && (
						<div className="text-xs text-gray-600 dark:text-gray-400">
							{formatDate(gameStartTimestamp)}
						</div>
					)}
					<button
						onClick={onClose}
						className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 text-2xl leading-none"
					>
						×
					</button>
				</div>
				<div className="p-3">
					<div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
						{sortedTeams.map(([placement, teamParticipants]) => {
							const isUserTeam = placement === userParticipant?.placement;
							return (
								<div
									key={placement}
									className={`p-2 rounded border ${
										isUserTeam
											? "border-blue-500 bg-blue-50 dark:bg-blue-950/30"
											: "border-gray-200 dark:border-gray-700"
									}`}
								>
									<div className="flex items-center gap-1 mb-1.5">
										<div
											className={`px-1.5 py-0.5 rounded text-white text-xs font-bold ${
												PLACEMENT_COLORS[
													placement as keyof typeof PLACEMENT_COLORS
												] || "bg-gray-500 dark:bg-gray-600"
											}`}
										>
											#{placement}
										</div>
									</div>
									<div className="flex gap-1">
										{teamParticipants.map((participant) => {
											const isUser = userParticipant?.puuid === participant.puuid;
											const championImage = images.find((img) => img.name.toLowerCase() === participant.championName.toLowerCase())?.src;
											return (
												<div
													key={participant.puuid}
													className="flex-1 flex flex-col items-center"
													title={participant.championName}
												>
													<div className="relative w-14 h-14 mb-1">
														{championImage && (
															<Image
																src={championImage}
																alt={participant.championName}
																fill
																className="object-cover rounded"
																sizes="56px"
															/>
														)}
													</div>
													<div className={`text-[10px] text-center truncate w-full ${
														isUser ? "font-semibold text-blue-600 dark:text-blue-400" : "text-gray-700 dark:text-gray-300"
													}`}>
														{participant.championName}
													</div>
												</div>
											);
										})}
									</div>
								</div>
							);
						})}
					</div>
				</div>
			</div>
		</div>
	);
}
