"use client";

import { useState, useEffect } from "react";
import { ImageGrid } from "./image-grid";
import { MatchHistory } from "./match-history";
import { Stats } from "./stats";
import { ImageTile } from "../lib/images";
import { checkStorageVersion } from "../lib/storage";

interface TabsProps {
	images: ImageTile[];
}

export function Tabs({ images }: TabsProps) {
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

			<div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
				<div className="flex gap-2">
					<button
						onClick={() => setActiveTab("tracker")}
						className={`px-4 py-2 rounded-md transition-colors ${
							activeTab === "tracker"
								? "bg-blue-500 text-white"
								: "bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700"
						}`}
					>
						Arena God Tracker
					</button>
					<button
						onClick={() => setActiveTab("history")}
						className={`px-4 py-2 rounded-md transition-colors ${
							activeTab === "history"
								? "bg-blue-500 text-white"
								: "bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700"
						}`}
					>
						Match History
					</button>
					<button
						onClick={() => setActiveTab("stats")}
						className={`px-4 py-2 rounded-md transition-colors ${
							activeTab === "stats"
								? "bg-blue-500 text-white"
								: "bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700"
						}`}
					>
						Stats
					</button>
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
				<div className={activeTab === "history" ? "" : "hidden"}>
					<MatchHistory images={images} />
				</div>
				<div className={activeTab === "stats" ? "" : "hidden"}>
					<Stats images={images} />
				</div>
			</div>
		</div>
	);
}
