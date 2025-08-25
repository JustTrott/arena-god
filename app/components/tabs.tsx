"use client";

import { useState } from "react";
import { ImageGrid } from "./image-grid";
import { MatchHistory } from "./match-history";
import { ImageTile } from "../lib/images";

interface TabsProps {
	images: ImageTile[];
}

export function Tabs({ images }: TabsProps) {
	const [activeTab, setActiveTab] = useState("tracker");
	const [searchQuery, setSearchQuery] = useState("");

	const lower = searchQuery.toLowerCase();
	const filteredImages = images.filter((image) =>
		image.name.toLowerCase().includes(lower) ||
		image.displayName.toLowerCase().includes(lower)
	);

	return (
		<div className="w-full max-w-7xl mx-auto px-4">
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
				{activeTab === "tracker" ? (
					<ImageGrid images={images} displayImages={filteredImages} />
				) : (
					<MatchHistory images={images} />
				)}
			</div>
		</div>
	);
}
