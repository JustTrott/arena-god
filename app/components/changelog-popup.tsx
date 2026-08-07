"use client";

import { useEffect, useState } from "react";
import { getChangelogSeen, setChangelogSeen } from "../lib/storage";

const CHANGELOG_VERSION = 2;

const CHANGES = [
	{
		title: "Now called God Tracker",
		body: "Same tracker, wider scope: Arena and ARAM. Your saved progress and match history are untouched.",
	},
	{
		title: "Challenges tab",
		body: "Every Arena and ARAM challenge on your account — level, value, next threshold, percentile and leaderboard rank.",
	},
	{
		title: "Arena God vs. Riot's counter",
		body: "The Arena God card compares what this tracker found with Riot's own challenge value, so you can see how many wins your match history no longer reaches.",
	},
	{
		title: "ARAM God clarified",
		body: "ARAM's per-champion challenge needs an S- grade, not a win — and grades are not in the match API, so that number is read from the challenge directly.",
	},
];

export function ChangelogPopup() {
	const [open, setOpen] = useState(false);

	useEffect(() => {
		if (getChangelogSeen() < CHANGELOG_VERSION) {
			setOpen(true);
		}
	}, []);

	useEffect(() => {
		if (!open) return;
		const onKey = (e: KeyboardEvent) => {
			if (e.key === "Escape") dismiss();
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [open]);

	const dismiss = () => {
		setChangelogSeen(CHANGELOG_VERSION);
		setOpen(false);
	};

	if (!open) return null;

	return (
		<div
			className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4"
			onClick={dismiss}
		>
			<div
				className="bg-white dark:bg-gray-900 rounded-2xl max-w-md w-full p-6 shadow-2xl border border-gray-200 dark:border-gray-800"
				onClick={(e) => e.stopPropagation()}
			>
				<div className="flex items-start justify-between mb-4">
					<div>
						<h2 className="text-xl font-bold">What&apos;s new</h2>
						<p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
							Recent improvements to God Tracker
						</p>
					</div>
					<button
						onClick={dismiss}
						aria-label="Close"
						className="text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 text-2xl leading-none -mt-1"
					>
						×
					</button>
				</div>

				<ul className="space-y-3 mb-6">
					{CHANGES.map((c) => (
						<li key={c.title} className="flex gap-3">
							<span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-blue-500 flex-shrink-0" />
							<div>
								<div className="font-semibold text-sm">{c.title}</div>
								<div className="text-sm text-gray-600 dark:text-gray-400">
									{c.body}
								</div>
							</div>
						</li>
					))}
				</ul>

				<button
					onClick={dismiss}
					className="w-full px-4 py-2.5 bg-blue-500 hover:bg-blue-600 text-white rounded-md font-medium transition-colors"
				>
					Got it
				</button>
			</div>
		</div>
	);
}
