"use client";

import { useState, useEffect } from "react";
import { ImageGrid } from "./image-grid";
import { MatchHistory } from "./match-history";
import { Stats } from "./stats";
import { LiveGame } from "./live-game";
import { Challenges } from "./challenges";
import { AccountBar, AccountProvider } from "./account";
import { ImageTile } from "../lib/images";
import { ChallengeGroup } from "../lib/challenges";
import { Locale, t } from "../lib/i18n";
import { checkStorageVersion } from "../lib/storage";

interface TabsProps {
	images: ImageTile[];
	challengeGroups: ChallengeGroup[];
	locale: Locale;
}

const TAB_IDS = ["tracker", "challenges", "history", "stats", "live"] as const;

export function Tabs({ images, challengeGroups, locale }: TabsProps) {
	const dict = t(locale);
	const [activeTab, setActiveTab] = useState("tracker");
	const [searchQuery, setSearchQuery] = useState("");
	const [showVersionModal, setShowVersionModal] = useState(false);

	useEffect(() => {
		if (checkStorageVersion()) {
			setShowVersionModal(true);
		}
	}, []);

	const lower = searchQuery.toLowerCase();
	const filteredImages = images.filter((image) =>
		image.name.toLowerCase().includes(lower) ||
		image.displayName.toLowerCase().includes(lower)
	);

	return (
		<AccountProvider>
		<div className="w-full max-w-7xl mx-auto px-4">
			{showVersionModal && (
				<div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowVersionModal(false)}>
					<div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full" onClick={(e) => e.stopPropagation()}>
						<h2 className="text-lg font-semibold mb-2">Data Reset</h2>
						<p className="text-gray-600 dark:text-gray-400 mb-4">
							Match history has been cleared due to a data format update. Please click Update in the Match History tab to re-fetch your matches.
						</p>
						<button
							onClick={() => {
								setShowVersionModal(false);
								setActiveTab("history");
							}}
							className="w-full px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"
						>
							Go to Match History
						</button>
					</div>
				</div>
			)}

			<div className="mb-6">
				<AccountBar locale={locale} />
			</div>

			<div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
				<div className="flex gap-2 flex-wrap" role="tablist">
					{TAB_IDS.map((id) => (
						<button
							key={id}
							role="tab"
							aria-selected={activeTab === id}
							onClick={() => setActiveTab(id)}
							className={`px-4 py-2 rounded-md transition-colors ${
								activeTab === id
									? "bg-blue-500 text-white"
									: "bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700"
							}`}
						>
							{dict.tabs[id]}
						</button>
					))}
				</div>
				{activeTab === "tracker" && (
					<div className="w-full sm:w-64">
						<input
							type="text"
							placeholder="Search champions..."
							value={searchQuery}
							onChange={(e) => setSearchQuery(e.target.value)}
							className="w-full px-3 py-2 border rounded-md bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
						/>
					</div>
				)}
			</div>

			<div className="mt-6">
				<div className={activeTab === "tracker" ? "" : "hidden"}>
					<ImageGrid images={images} displayImages={filteredImages} />
				</div>
				<div className={activeTab === "challenges" ? "" : "hidden"}>
					<Challenges groups={challengeGroups} locale={locale} />
				</div>
				<div className={activeTab === "history" ? "" : "hidden"}>
					<MatchHistory images={images} locale={locale} />
				</div>
				<div className={activeTab === "stats" ? "" : "hidden"}>
					<Stats images={images} />
				</div>
				{/* Mounted only when active so the 30s poll stops when you leave the tab. */}
				{activeTab === "live" && <LiveGame images={images} locale={locale} />}
			</div>
		</div>
		</AccountProvider>
	);
}
