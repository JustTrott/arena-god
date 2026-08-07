"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import { Pencil, UserRound } from "lucide-react";
import { Locale, t } from "../lib/i18n";
import { getPlatform, getRiotId, setPlatform, setRiotId } from "../lib/storage";

export const PLATFORMS = [
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

export interface Account {
	gameName: string;
	tagLine: string;
	platform: string;
}

interface AccountContextValue {
	account: Account;
	/** False until localStorage has been read, so nothing auto-fetches with an empty Riot ID. */
	ready: boolean;
	isSet: boolean;
	/** Writes through to localStorage; every tab sees the change immediately. */
	save: (next: Partial<Account>) => void;
	forget: () => void;
}

const EMPTY: Account = { gameName: "", tagLine: "", platform: "euw1" };

const AccountContext = createContext<AccountContextValue | null>(null);

export function useAccount(): AccountContextValue {
	const value = useContext(AccountContext);
	if (!value) throw new Error("useAccount must be used inside <AccountProvider>");
	return value;
}

export function AccountProvider({ children }: { children: React.ReactNode }) {
	const [account, setAccount] = useState<Account>(EMPTY);
	const [ready, setReady] = useState(false);

	useEffect(() => {
		const stored = getRiotId();
		setAccount({
			gameName: stored?.gameName || "",
			tagLine: stored?.tagLine || "",
			platform: getPlatform(),
		});
		setReady(true);
	}, []);

	const save = (next: Partial<Account>) => {
		setAccount((current) => {
			const merged = { ...current, ...next };
			if (merged.gameName && merged.tagLine) {
				setRiotId({ gameName: merged.gameName, tagLine: merged.tagLine });
			}
			if (merged.platform) setPlatform(merged.platform);
			return merged;
		});
	};

	const forget = () => {
		setAccount((current) => ({ ...EMPTY, platform: current.platform }));
		setRiotId({ gameName: "", tagLine: "" });
	};

	return (
		<AccountContext.Provider
			value={{
				account,
				ready,
				isSet: Boolean(account.gameName && account.tagLine),
				save,
				forget,
			}}
		>
			{children}
		</AccountContext.Provider>
	);
}

/** The one place a Riot ID is entered. Collapses to a summary once it is set. */
export function AccountBar({ locale }: { locale: Locale }) {
	const dict = t(locale).account;
	const { account, ready, isSet, save, forget } = useAccount();
	const [editing, setEditing] = useState(false);
	const [gameName, setGameName] = useState("");
	const [tagLine, setTagLine] = useState("");
	const [platform, setPlatformState] = useState("euw1");
	const tagLineRef = useRef<HTMLInputElement>(null);

	// Mirror the stored account into the form whenever it changes underneath (initial load, or a
	// canonical spelling coming back from Riot).
	useEffect(() => {
		setGameName(account.gameName);
		setTagLine(account.tagLine);
		setPlatformState(account.platform);
	}, [account.gameName, account.tagLine, account.platform]);

	const submit = () => {
		if (!gameName || !tagLine) return;
		save({ gameName, tagLine, platform });
		setEditing(false);
	};

	// Render nothing until storage is read, otherwise the form flashes over a saved account.
	if (!ready) return <div className="h-[74px]" aria-hidden="true" />;

	if (isSet && !editing) {
		return (
			<div className="flex items-center gap-3 flex-wrap rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-white/[0.02] px-4 py-3">
				<UserRound className="w-4 h-4 text-blue-400 shrink-0" />
				<span className="text-sm text-gray-500 dark:text-gray-400">{dict.signedInAs}</span>
				<span className="font-medium">
					{account.gameName}
					<span className="text-gray-500">#{account.tagLine}</span>
				</span>
				<select
					aria-label={dict.region}
					value={account.platform}
					onChange={(e) => save({ platform: e.target.value })}
					className="h-8 px-2 text-xs border rounded-md bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700"
				>
					{PLATFORMS.map((p) => (
						<option key={p.value} value={p.value}>
							{p.label}
						</option>
					))}
				</select>
				<button
					onClick={() => setEditing(true)}
					className="ml-auto inline-flex items-center gap-1 text-xs text-blue-400 hover:underline"
				>
					<Pencil className="w-3 h-3" />
					{dict.change}
				</button>
				<button
					onClick={forget}
					className="text-xs text-gray-500 hover:text-red-400 transition-colors"
				>
					{dict.clear}
				</button>
			</div>
		);
	}

	return (
		<div className="rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-white/[0.02] px-4 py-3">
			<div className="flex flex-col sm:flex-row gap-3 sm:items-end">
				<div className="flex-1 min-w-0">
					<label htmlFor="accountGameName" className="block text-xs font-medium mb-1">
						{dict.gameName}
					</label>
					<input
						id="accountGameName"
						type="text"
						value={gameName}
						onChange={(e) => {
							const value = e.target.value;
							// Pasting "Name#TAG" fills both fields instead of failing validation.
							if (value.includes("#")) {
								const [name, tag = ""] = value.split("#");
								setGameName(name);
								if (tag) setTagLine(tag.replaceAll("#", ""));
								tagLineRef.current?.focus();
							} else {
								setGameName(value);
							}
						}}
						onKeyDown={(e) => e.key === "Enter" && submit()}
						placeholder="Faker"
						className="w-full h-[38px] px-3 border rounded-md bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
					/>
				</div>
				<div className="w-full sm:w-28">
					<label htmlFor="accountTagLine" className="block text-xs font-medium mb-1">
						{dict.tagLine}
					</label>
					<div className="relative">
						<span
							className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
							aria-hidden="true"
						>
							#
						</span>
						<input
							ref={tagLineRef}
							id="accountTagLine"
							type="text"
							value={tagLine}
							onChange={(e) => setTagLine(e.target.value.replaceAll("#", ""))}
							onKeyDown={(e) => e.key === "Enter" && submit()}
							placeholder="EUW"
							className="w-full h-[38px] pl-7 pr-3 border rounded-md bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
						/>
					</div>
				</div>
				<div>
					<label htmlFor="accountPlatform" className="block text-xs font-medium mb-1">
						{dict.region}
					</label>
					<select
						id="accountPlatform"
						value={platform}
						onChange={(e) => setPlatformState(e.target.value)}
						className="h-[38px] px-3 border rounded-md bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700"
					>
						{PLATFORMS.map((p) => (
							<option key={p.value} value={p.value}>
								{p.label}
							</option>
						))}
					</select>
				</div>
				<button
					onClick={submit}
					disabled={!gameName || !tagLine}
					className="h-[38px] px-5 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:opacity-50 whitespace-nowrap"
				>
					{dict.save}
				</button>
			</div>
			<p className="text-[11px] text-gray-500 mt-2">{dict.hint}</p>
		</div>
	);
}
