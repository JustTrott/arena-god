"use client";

import { useState, useEffect } from "react";
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
	getAllMatchIds,
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
	const [hasMore, setHasMore] = useState(false);
	const [currentStart, setCurrentStart] = useState(0);
	const [selectedMatch, setSelectedMatch] = useState<{
		matchId: string;
		matchInfo: MatchInfo | null;
	} | null>(null);
	const [isLoadingMatch, setIsLoadingMatch] = useState(false);
	const [fetchProgress, setFetchProgress] = useState({
		totalIds: 0,
		detailsFetched: 0,
		pending: 0,
	});

	useEffect(() => {
		const storedRiotId = getRiotId();
		if (storedRiotId) {
			setGameName(storedRiotId.gameName);
			setTagLine(storedRiotId.tagLine);
			setTagLinePrefixActive(Boolean(storedRiotId.tagLine));
		}
		// Load matches from localStorage and restore state
		const storedMatches = getMatchHistory();
		if (storedMatches.length > 0) {
			setMatchHistoryState(storedMatches);
			setCurrentStart(storedMatches.length);
		}
	}, []);

	const handleStreamMatches = async (start: number = 0, append: boolean = false) => {
		if (!gameName || !tagLine) {
			setError("Please enter both game name and tag line");
			return;
		}

		setIsLoading(true);
		setError(null);
		setStatusMessage("Connecting...");
		setFetchProgress({ totalIds: 0, detailsFetched: 0, pending: 0 });

		// Get known and cached match IDs
		const knownMatchIds = getAllMatchIds();
		const cachedMatchIds = Object.keys(getMatchCache());

		if (!append) {
			setMatchHistoryState([]);
			setCurrentStart(0);
			setHasMore(false);
		}

		const newMatches: MatchResult[] = [];
		const allNewMatchIds: string[] = []; // Track all match IDs received (even without details)
		let accountData: { gameName: string; tagLine: string; puuid: string } | null = null;
		let appendedCount = 0; // Track how many matches were appended in this batch

		try {
			const url = `/api/matches?gameName=${encodeURIComponent(gameName)}&tagLine=${encodeURIComponent(tagLine)}&start=${start}&count=100` +
				(knownMatchIds.length > 0 ? `&knownMatchIds=${knownMatchIds.join(",")}` : "") +
				(cachedMatchIds.length > 0 ? `&cachedMatchIds=${cachedMatchIds.join(",")}` : "");
			const response = await fetch(url);
			
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

			const processBuffer = (): boolean => {
				const lines = buffer.split("\n\n");
				buffer = lines.pop() || "";

				console.log(`[Frontend] Processing buffer, ${lines.length} complete events found`);

				for (const line of lines) {
					if (!line.trim()) {
						console.log("[Frontend] Skipping empty line");
						continue;
					}

					console.log("[Frontend] Raw line:", line.substring(0, 200));

					const [eventLine, dataLine] = line.split("\ndata: ");
					if (!eventLine || !dataLine) {
						console.log("[Frontend] Skipping malformed line:", line.substring(0, 100));
						continue;
					}

					const eventMatch = eventLine.match(/event: (\w+)/);
					if (!eventMatch) {
						console.log("[Frontend] No event match in line:", eventLine);
						continue;
					}

					const eventType = eventMatch[1];
					console.log(`[Frontend] Parsed event type: ${eventType}`);
					
					let data;
					try {
						data = JSON.parse(dataLine);
						console.log(`[Frontend] Parsed event data:`, data);
					} catch (e) {
						console.error("[Frontend] Failed to parse JSON:", dataLine, e);
						continue;
					}

					switch (eventType) {
						case "status":
							setStatusMessage(data.message);
							break;
						case "account":
							accountData = data.data;
							setRiotId({
								gameName: data.data.gameName,
								tagLine: data.data.tagLine,
							});
							setUserPuuid(data.data.puuid);
							break;
						case "matchIdBatch":
							// Track all match IDs received in this batch
							if (data.matchIds && Array.isArray(data.matchIds)) {
								allNewMatchIds.push(...data.matchIds);
								setFetchProgress(prev => ({
									...prev,
									totalIds: allNewMatchIds.length,
								}));
							}
							break;
						case "matchIds":
							setHasMore(false); // We're fetching all matches, so no more after this
							if (data.count > 0) {
								setStatusMessage(`Found ${data.count} match IDs. Fetching details...`);
							}
							break;
						case "progress":
							if (data.totalIds !== undefined) {
								setFetchProgress({
									totalIds: data.totalIds || 0,
									detailsFetched: data.detailsFetched || 0,
									pending: data.pending || 0,
								});
								if (data.pending > 0) {
									setStatusMessage(`Fetched ${data.totalIds} match IDs, ${data.detailsFetched} with details, ${data.pending} pending...`);
								}
							}
							break;
						case "match":
							console.log("[Frontend] Received match event:", data);
							if (data.matchInfo) {
								cacheMatch(data.matchId, data.matchInfo);
							}
							const matchResult: MatchResult = {
								matchId: data.matchId,
								champion: data.champion,
								placement: data.placement,
							};
							console.log("[Frontend] Created match result:", matchResult);
							
							if (append) {
								appendedCount++;
								setMatchHistoryState((prev) => {
									const updated = [...prev, matchResult];
									console.log("[Frontend] Appended match, new count:", updated.length);
									// Save to localStorage immediately when appending
									setMatchHistory(updated);
									return updated;
								});
							} else {
								newMatches.push(matchResult);
								const updated = [...newMatches];
								console.log("[Frontend] Added match to newMatches, count:", updated.length, "matchId:", matchResult.matchId);
								setMatchHistoryState(updated);
							}
							break;
						case "complete":
							console.log("[Frontend] Complete event received, newMatches count:", newMatches.length);
							setIsLoading(false);
							
							// Show completion message based on progress
							setFetchProgress(prev => {
								if (prev.totalIds > 0) {
									const finalMessage = prev.detailsFetched > 0
										? `Complete! Fetched ${prev.totalIds} match IDs, ${prev.detailsFetched} with details.`
										: `Complete! Found ${prev.totalIds} match IDs.`;
									setStatusMessage(finalMessage);
									// Clear status message after a delay
									setTimeout(() => setStatusMessage(null), 3000);
								} else {
									setStatusMessage(null);
								}
								return prev;
							});
							
							if (!append) {
								setMatchHistoryState([...newMatches]);
								setMatchHistory(newMatches);
								setCurrentStart(newMatches.length);
								console.log("[Frontend] Final state set with", newMatches.length, "matches");
								const newFirstPlaceChampions = newMatches
									.filter((result) => result.placement === 1)
									.map((result) => result.champion);
								if (newFirstPlaceChampions.length > 0 && accountData) {
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
							} else {
								// When appending, update currentStart based on how many matches were added
								setCurrentStart((prev) => prev + appendedCount);
								console.log("[Frontend] Appended", appendedCount, "matches, currentStart updated");
							}
							return true; // Signal to stop processing
						case "error":
							setError(data.error || "An error occurred");
							setIsLoading(false);
							setStatusMessage(null);
							return true; // Signal to stop processing
					}
				}
				return false; // Continue processing
			}

			// Read and process the stream
			let chunkCount = 0;
			while (true) {
				const { done, value } = await reader.read();
				chunkCount++;
				
				console.log(`[Frontend] Stream chunk ${chunkCount}, done: ${done}, value length: ${value?.length || 0}`);
				
				if (done) {
					console.log("[Frontend] Stream ended, processing remaining buffer");
					// Process any remaining buffer data
					if (buffer.trim()) {
						console.log("[Frontend] Remaining buffer:", buffer.substring(0, 500));
						processBuffer();
					}
					break;
				}

				const decoded = decoder.decode(value, { stream: true });
				console.log(`[Frontend] Decoded chunk (${decoded.length} chars):`, decoded.substring(0, 200));
				buffer += decoded;
				
				const shouldStop = processBuffer();
				if (shouldStop) {
					console.log("[Frontend] Early exit requested by processBuffer");
					// Early exit if complete or error event
					break;
				}
			}
			
			console.log(`[Frontend] Stream processing complete. Total chunks: ${chunkCount}, Final buffer length: ${buffer.length}`);
		} catch (error) {
			console.error("Failed to stream matches:", error);
			setError("Failed to stream matches");
			setIsLoading(false);
			setStatusMessage(null);
		}
	};

	const handleUpdate = () => {
		// Always start from 0, but pass known/cached IDs to skip refetching
		handleStreamMatches(0, false);
	};

	const handleLoadMore = () => {
		// This is now deprecated since we fetch all matches, but keeping for compatibility
		handleStreamMatches(currentStart, true);
	};

	const handleMatchClick = async (matchId: string) => {
		// Try to get from cache first
		const cachedMatch = getCachedMatch(matchId);
		if (cachedMatch) {
			setSelectedMatch({ matchId, matchInfo: cachedMatch });
			return;
		}

		// If not cached, fetch from API
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
				cacheMatch(matchId, data.matchInfo);
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

			{statusMessage && (
				<div className="p-4 bg-blue-100 text-blue-700 rounded-md dark:bg-blue-900 dark:text-blue-100">
					{statusMessage}
					{fetchProgress.totalIds > 0 && (
						<div className="mt-2 text-sm">
							<div className="flex items-center gap-4">
								<span>Total IDs: {fetchProgress.totalIds}</span>
								<span>Details: {fetchProgress.detailsFetched}</span>
								{fetchProgress.pending > 0 && (
									<span className="text-blue-600 dark:text-blue-400">
										Pending: {fetchProgress.pending}
									</span>
								)}
							</div>
						</div>
					)}
				</div>
			)}

			<div className="space-y-4">
				<h2 className="text-xl font-semibold">Recent Matches {matchHistory.length > 0 && `(${matchHistory.length})`}</h2>
				{matchHistory.length === 0 && !isLoading && (
					<div className="text-gray-500 dark:text-gray-400 text-center py-8">
						No matches found
					</div>
				)}
				{matchHistory.length > 0 && (
					<div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
						{matchHistory.map((match) => {
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
										{/* Dark overlay for better text readability */}
										<div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
									</div>
									{/* Placement badge */}
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
				{hasMore && !isLoading && (
					<div className="flex justify-center pt-6">
						<button
							onClick={handleLoadMore}
							className="px-6 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors font-medium"
						>
							Load More
						</button>
					</div>
				)}
			</div>

			{/* Match Details Modal */}
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

	// Group participants by placement (each team has 2 people with the same placement)
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

	// Sort teams by placement (1st place first, etc.)
	const sortedTeams = Array.from(teams.entries()).sort(([placementA], [placementB]) => {
		// User's team first if found
		const userPlacement = userParticipant?.placement;
		if (placementA === userPlacement) return -1;
		if (placementB === userPlacement) return 1;
		// Otherwise sort by placement (1, 2, 3, etc.)
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
