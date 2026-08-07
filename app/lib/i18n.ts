export const LOCALES = ["en", "de"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "en";

/** Riot ships every challenge string in these locales, so the detail pages need no translation. */
export const RIOT_LOCALE: Record<Locale, string> = { en: "en_US", de: "de_DE" };

/** `/` is English; German lives under `/de`. Keeps the existing URL as the canonical one. */
export function localePath(locale: Locale, path = ""): string {
	const clean = path.replace(/^\/+/, "");
	const prefix = locale === DEFAULT_LOCALE ? "" : `/${locale}`;
	return clean ? `${prefix}/${clean}` : prefix || "/";
}

export const HTML_LANG: Record<Locale, string> = { en: "en", de: "de" };

interface Dict {
	tagline: string;
	metaDescription: string;
	intro: (count: string) => string;
	keywords: string[];
	tabs: { tracker: string; challenges: string; history: string; stats: string; live: string };
	account: {
		prompt: string;
		hint: string;
		gameName: string;
		tagLine: string;
		region: string;
		save: string;
		change: string;
		clear: string;
		signedInAs: string;
		missing: string;
	};
	home: {
		explainTitle: string;
		explainParagraphs: string[];
		featuresTitle: string;
		features: string[];
		faqTitle: string;
		disclaimer: string;
		languageNote: string;
	};
	faq: { question: string; answer: string }[];
	challenges: {
		gameName: string;
		tagLine: string;
		region: string;
		load: string;
		loading: string;
		missingName: string;
		failed: string;
		unavailable: string;
		totalPoints: string;
		riotValue: string;
		trackedHere: string;
		unranked: string;
		maxLevel: string;
		forLevel: (level: string, target: string) => string;
		ofPlayers: (percentile: string) => string;
		rank: (position: string) => string;
		rankIn: (position: string, players: string, level: string) => string;
		points: string;
		maxed: string;
		arenaGod: string;
		arenaGodSub: string;
		aramGod: string;
		aramGodSub: string;
		aramNote: string;
		gap: (missing: number) => string;
		source: string;
		categoryLabels: Record<"Arena" | "ARAM" | "Seasonal", string>;
		categoryBlurbs: Record<"Arena" | "ARAM" | "Seasonal", string>;
		detailLink: string;
	};
	detail: {
		breadcrumbHome: string;
		breadcrumbList: string;
		allChallenges: string;
		levelTableTitle: string;
		levelColumn: string;
		requiredColumn: string;
		howToTitle: string;
		howToBody: string;
		openTracker: string;
		siblingsTitle: (group: string) => string;
		leaderboardNote: string;
		groupLabel: string;
		idLabel: string;
		maxLabel: string;
		metaDescription: (name: string, description: string) => string;
	};
}

const en: Dict = {
	tagline: "Arena God & ARAM challenge tracker for League of Legends",
	metaDescription:
		"Track your Arena God progress champion by champion, and every Arena and ARAM challenge on your account — levels, thresholds, percentiles and what's left to do. Free, no login.",
	intro: (count) =>
		`Tick off every champion you have placed 1st with in Arena, and read all ${count} Arena and ARAM challenges straight off your account — levels, thresholds and percentiles included. No login, nothing leaves your browser.`,
	keywords: [
		"arena god tracker",
		"arena god",
		"aram god",
		"all random all champions",
		"adapt to all situations",
		"league of legends challenges tracker",
		"arena challenges",
		"aram challenges",
		"lol arena tracker",
		"arena first place champions",
	],
	tabs: {
		tracker: "Arena Tracker",
		challenges: "Challenges",
		history: "Match History",
		stats: "Stats",
		live: "Live Game",
	},
	account: {
		prompt: "Your Riot ID",
		hint: "Entered once and used by every tab. Stored in this browser only.",
		gameName: "Game Name",
		tagLine: "Tag Line",
		region: "Region",
		save: "Save",
		change: "Change",
		clear: "Forget",
		signedInAs: "Signed in as",
		missing: "Enter your Riot ID above first",
	},
	home: {
		explainTitle: "Arena God and ARAM God, explained",
		explainParagraphs: [
			"Arena God is the League of Legends title behind the challenge “Adapt to All Situations”: place 1st in Arena with as many different champions as you can. It levels at 3, 6, 12, 20, 32, 45 and 60 champions, and the tracker's champion grid mirrors exactly that counter — one tile per champion, ticked the moment your match history shows a 1st place on it.",
			"ARAM has the same idea under a different rule: “All Random All Champions” counts champions you earned an S- grade or better with on the Howling Abyss, from 1 champion at Iron up to 150 at Master. Post-game grades are not part of Riot's public match data, so the Challenges tab reads that number from the official challenge rather than estimating it.",
		],
		featuresTitle: "What you get",
		features: [
			"Arena champion checklist — progress bar, search, sorting, and 1st-place rates so you know which champions are the easy ones left.",
			"Every Arena and ARAM challenge — Arena Brawler, Arena Champion, ARAM Authority, ARAM Warrior, ARAM Finesse, ARAM Champion and the retired seasonal splits, each with your level, next threshold, percentile and leaderboard rank.",
			"Match history import — Arena 2v2 and 3v3 games pulled from the Riot API and cached locally, so a re-sync only fetches what is new.",
			"Stats — wins and win rate per champion, first-try wins, champions you have never won on, and which duo partners actually carry you.",
			"Live game helper — during champ select it highlights the champions you still need, with builds and augments for the one you picked.",
		],
		faqTitle: "Frequently asked questions",
		disclaimer:
			"God Tracker is not endorsed by Riot Games and does not reflect the views or opinions of Riot Games or anyone officially involved in producing or managing Riot Games properties. Riot Games and all associated properties are trademarks or registered trademarks of Riot Games, Inc.",
		languageNote: "Auf Deutsch lesen",
	},
	faq: [
		{
			question: "What is the Arena God title in League of Legends?",
			answer:
				"Arena God is the title you unlock from the challenge “Adapt to All Situations” (id 602002), which counts how many different champions you have placed 1st with in Arena. The levels are Iron 3, Bronze 6, Silver 12, Gold 20, Platinum 32, Diamond 45 and Master 60 champions.",
		},
		{
			question: "What is ARAM God?",
			answer:
				"ARAM's per-champion challenge is “All Random All Champions” (id 101301): earn an S- grade or higher with different champions in ARAM. It goes Iron 1, Bronze 5, Silver 15, Gold 30, Platinum 50, Diamond 100 and Master 150 champions.",
		},
		{
			question: "Can a tracker calculate my ARAM God progress from match history?",
			answer:
				"No. The Riot match API returns no post-game grade for ARAM games, and champion mastery keeps no grade history, so the S- count can only be read from the challenge itself. God Tracker shows the official challenge value instead of guessing.",
		},
		{
			question: "How does God Tracker know which champions I have already won with?",
			answer:
				"It reads your Arena match history through the official Riot API and marks every champion you placed 1st with. Riot's match history does not go back forever, so you can also tick champions off by hand — the challenge value tells you how many wins are missing.",
		},
		{
			question: "Is my data stored anywhere?",
			answer:
				"No account and no server-side database. Your Riot ID, match history and champion progress live in your browser's local storage, so clearing site data resets the tracker.",
		},
		{
			question: "Which Arena and ARAM challenges does it show?",
			answer:
				"All of them: the Arena Brawler and Arena Champion groups, the full ARAM tree (ARAM Authority, ARAM Warrior, ARAM Finesse, ARAM Champion) and the retired seasonal ARAM split challenges — with your level, value, next threshold and percentile.",
		},
	],
	challenges: {
		gameName: "Game Name",
		tagLine: "Tag Line",
		region: "Region",
		load: "Load my progress",
		loading: "Loading...",
		missingName: "Please enter both game name and tag line",
		failed: "Failed to fetch challenges",
		unavailable: "Challenge definitions are unavailable right now (Riot API). Try again later.",
		totalPoints: "Total challenge points",
		riotValue: "Riot challenge",
		trackedHere: "tracked here",
		unranked: "Unranked",
		maxLevel: "max level",
		forLevel: (level, target) => `${target} for ${level}`,
		ofPlayers: (percentile) => `${percentile} of players`,
		rank: (position) => `rank #${position}`,
		rankIn: (position, players, level) => `rank #${position} of ${players} in ${level}`,
		points: "points",
		maxed: "maxed",
		arenaGod: "Arena God",
		arenaGodSub: "Adapt to All Situations — place 1st in Arena with different champions",
		aramGod: "ARAM God",
		aramGodSub: "All Random All Champions — earn an S- grade with different champions in ARAM",
		aramNote:
			"Match grades are not exposed by the Riot API, so this one can only be read from the challenge itself — it cannot be reconstructed per champion.",
		gap: (missing) =>
			`${missing} win${missing === 1 ? "" : "s"} Riot counts that your match history no longer reaches — tick those champions off by hand in the tracker.`,
		source: "Levels and thresholds come straight from Riot's challenge config.",
		categoryLabels: {
			Arena: "Arena Challenges",
			ARAM: "ARAM Challenges",
			Seasonal: "Retired Seasonal Challenges",
		},
		categoryBlurbs: {
			Arena:
				"The 2v2v2v2 / 3v3v3v3 game mode. “Adapt to All Situations” is the one behind the Arena God title.",
			ARAM:
				"All Random All Mid on Howling Abyss. “All Random All Champions” is the ARAM equivalent of Arena God.",
			Seasonal:
				"Split challenges from past seasons. They no longer progress, but your final value is kept on your account.",
		},
		detailLink: "details",
	},
	detail: {
		breadcrumbHome: "God Tracker",
		breadcrumbList: "Challenges",
		allChallenges: "All Arena and ARAM challenges",
		levelTableTitle: "Levels and thresholds",
		levelColumn: "Level",
		requiredColumn: "Required",
		howToTitle: "How to check your own progress",
		howToBody:
			"Open the Challenges tab, enter your Riot ID and region, and God Tracker reads this challenge straight from your account — current level, value, next threshold and where you sit against every other player.",
		openTracker: "Open the tracker",
		siblingsTitle: (group) => `Other challenges in ${group}`,
		leaderboardNote: "This challenge has a public leaderboard, so it also reports your rank.",
		groupLabel: "Group",
		idLabel: "Challenge ID",
		maxLabel: "Max level",
		metaDescription: (name, description) =>
			`${name}: ${description}. All levels and thresholds, plus how to check your own progress.`,
	},
};

const de: Dict = {
	tagline: "Arena-God- und ARAM-Challenge-Tracker für League of Legends",
	metaDescription:
		"Verfolge deinen Arena-God-Fortschritt Champion für Champion und lies jede Arena- und ARAM-Challenge direkt von deinem Account — Stufen, Schwellen, Perzentile und was noch fehlt. Kostenlos, ohne Login.",
	intro: (count) =>
		`Hake jeden Champion ab, mit dem du in der Arena Platz 1 geholt hast, und lies alle ${count} Arena- und ARAM-Challenges direkt von deinem Account — inklusive Stufen, Schwellen und Perzentilen. Kein Login, nichts verlässt deinen Browser.`,
	keywords: [
		"arena god tracker",
		"arena god deutsch",
		"aram god",
		"alle zufällig alle champions",
		"league of legends challenges tracker",
		"arena challenges",
		"aram challenges",
		"lol arena tracker deutsch",
		"arena erster platz champions",
	],
	tabs: {
		tracker: "Arena-Tracker",
		challenges: "Challenges",
		history: "Match-Verlauf",
		stats: "Statistiken",
		live: "Laufendes Spiel",
	},
	account: {
		prompt: "Deine Riot-ID",
		hint: "Einmal eingeben, jeder Tab benutzt sie. Wird nur in diesem Browser gespeichert.",
		gameName: "Spielname",
		tagLine: "Tag",
		region: "Region",
		save: "Speichern",
		change: "Ändern",
		clear: "Vergessen",
		signedInAs: "Angemeldet als",
		missing: "Gib oben zuerst deine Riot-ID ein",
	},
	home: {
		explainTitle: "Arena God und ARAM God erklärt",
		explainParagraphs: [
			"Arena God ist der Titel hinter der Challenge „Anpassung an alle Situationen“: hol in der Arena mit möglichst vielen verschiedenen Champions Platz 1. Die Stufen liegen bei 3, 6, 12, 20, 32, 45 und 60 Champions — und genau diesen Zähler spiegelt das Champion-Raster: ein Feld pro Champion, abgehakt sobald dein Match-Verlauf dort einen ersten Platz zeigt.",
			"ARAM hat die gleiche Idee mit anderer Regel: „Alle zufällig, alle Champions“ zählt Champions, mit denen du auf der Heulenden Schlucht mindestens eine Wertung von S- geholt hast — von 1 Champion in Eisen bis 150 in Meister. Die Wertung nach dem Spiel steckt nicht in Riots öffentlichen Match-Daten, deshalb liest der Challenges-Tab diese Zahl aus der offiziellen Challenge statt sie zu schätzen.",
		],
		featuresTitle: "Was du bekommst",
		features: [
			"Arena-Champion-Checkliste — Fortschrittsbalken, Suche, Sortierung und Platz-1-Raten, damit du siehst, welche Champions die leichten Restlichen sind.",
			"Jede Arena- und ARAM-Challenge — Arena Brawler, Arena Champion, ARAM Authority, ARAM Warrior, ARAM Finesse, ARAM Champion und die eingestellten Season-Splits, jeweils mit deiner Stufe, nächster Schwelle, Perzentil und Leaderboard-Platz.",
			"Match-Verlauf-Import — Arena-2v2- und -3v3-Spiele über die Riot-API, lokal zwischengespeichert, sodass ein erneuter Abgleich nur Neues lädt.",
			"Statistiken — Siege und Siegrate pro Champion, Siege im ersten Versuch, Champions ohne einen einzigen Sieg und welche Duo-Partner dich wirklich tragen.",
			"Hilfe im laufenden Spiel — in der Championauswahl werden die noch fehlenden Champions hervorgehoben, mit Builds und Augments für den gepickten.",
		],
		faqTitle: "Häufige Fragen",
		disclaimer:
			"God Tracker wird von Riot Games nicht unterstützt und spiegelt nicht die Ansichten oder Meinungen von Riot Games oder Personen wider, die offiziell an der Produktion oder Verwaltung von Riot Games-Eigentum beteiligt sind. Riot Games und alle zugehörigen Eigentumsrechte sind Marken oder eingetragene Marken von Riot Games, Inc.",
		languageNote: "Read in English",
	},
	faq: [
		{
			question: "Was ist der Arena-God-Titel in League of Legends?",
			answer:
				"Arena God ist der Titel aus der Challenge „Anpassung an alle Situationen“ (ID 602002). Sie zählt, mit wie vielen verschiedenen Champions du in der Arena Platz 1 geholt hast. Die Stufen: Eisen 3, Bronze 6, Silber 12, Gold 20, Platin 32, Diamant 45 und Meister 60 Champions.",
		},
		{
			question: "Was ist ARAM God?",
			answer:
				"Die Champion-Challenge in ARAM heißt „Alle zufällig, alle Champions“ (ID 101301): erziele mit verschiedenen Champions eine Wertung von mindestens S-. Die Stufen: Eisen 1, Bronze 5, Silber 15, Gold 30, Platin 50, Diamant 100 und Meister 150 Champions.",
		},
		{
			question: "Kann ein Tracker meinen ARAM-God-Fortschritt aus dem Match-Verlauf berechnen?",
			answer:
				"Nein. Die Riot-Match-API liefert für ARAM-Spiele keine Wertung, und die Champion-Meisterschaft speichert keine Wertungs-Historie. Die S--Zahl lässt sich also nur aus der Challenge selbst lesen. God Tracker zeigt deshalb den offiziellen Challenge-Wert statt zu raten.",
		},
		{
			question: "Woher weiß God Tracker, mit welchen Champions ich schon gewonnen habe?",
			answer:
				"Er liest deinen Arena-Match-Verlauf über die offizielle Riot-API und markiert jeden Champion, mit dem du Platz 1 geholt hast. Riots Match-Verlauf reicht nicht unbegrenzt zurück, deshalb kannst du Champions auch von Hand abhaken — der Challenge-Wert sagt dir, wie viele Siege fehlen.",
		},
		{
			question: "Werden meine Daten irgendwo gespeichert?",
			answer:
				"Kein Account und keine Datenbank auf dem Server. Deine Riot-ID, der Match-Verlauf und der Champion-Fortschritt liegen im Local Storage deines Browsers — wenn du die Websitedaten löschst, ist der Tracker zurückgesetzt.",
		},
		{
			question: "Welche Arena- und ARAM-Challenges werden angezeigt?",
			answer:
				"Alle: die Gruppen Arena Brawler und Arena Champion, der komplette ARAM-Baum (ARAM Authority, ARAM Warrior, ARAM Finesse, ARAM Champion) und die eingestellten ARAM-Split-Challenges — mit Stufe, Wert, nächster Schwelle und Perzentil.",
		},
	],
	challenges: {
		gameName: "Spielname",
		tagLine: "Tag",
		region: "Region",
		load: "Fortschritt laden",
		loading: "Lädt...",
		missingName: "Bitte Spielname und Tag eingeben",
		failed: "Challenges konnten nicht geladen werden",
		unavailable:
			"Die Challenge-Definitionen sind gerade nicht verfügbar (Riot-API). Versuch es später noch einmal.",
		totalPoints: "Challenge-Punkte insgesamt",
		riotValue: "Riot-Challenge",
		trackedHere: "hier getrackt",
		unranked: "Keine Stufe",
		maxLevel: "höchste Stufe",
		forLevel: (level, target) => `${target} für ${level}`,
		ofPlayers: (percentile) => `${percentile} der Spieler`,
		rank: (position) => `Platz #${position}`,
		rankIn: (position, players, level) => `Platz #${position} von ${players} in ${level}`,
		points: "Punkte",
		maxed: "voll",
		arenaGod: "Arena God",
		arenaGodSub: "Anpassung an alle Situationen — Platz 1 in der Arena mit verschiedenen Champions",
		aramGod: "ARAM God",
		aramGodSub:
			"Alle zufällig, alle Champions — Wertung von S- mit verschiedenen Champions in ARAM",
		aramNote:
			"Die Riot-API gibt keine Match-Wertungen heraus, deshalb ist dieser Wert nur aus der Challenge selbst ablesbar — pro Champion lässt er sich nicht rekonstruieren.",
		gap: (missing) =>
			`${missing} ${missing === 1 ? "Sieg" : "Siege"}, die Riot zählt und dein Match-Verlauf nicht mehr hergibt — hake diese Champions im Tracker von Hand ab.`,
		source: "Stufen und Schwellen kommen direkt aus Riots Challenge-Konfiguration.",
		categoryLabels: {
			Arena: "Arena-Challenges",
			ARAM: "ARAM-Challenges",
			Seasonal: "Eingestellte Season-Challenges",
		},
		categoryBlurbs: {
			Arena:
				"Der 2v2v2v2-/3v3v3v3-Modus. „Anpassung an alle Situationen“ ist die Challenge hinter dem Arena-God-Titel.",
			ARAM:
				"All Random All Mid auf der Heulenden Schlucht. „Alle zufällig, alle Champions“ ist das ARAM-Gegenstück zu Arena God.",
			Seasonal:
				"Split-Challenges aus vergangenen Seasons. Sie machen keinen Fortschritt mehr, dein Endwert bleibt aber auf dem Account.",
		},
		detailLink: "Details",
	},
	detail: {
		breadcrumbHome: "God Tracker",
		breadcrumbList: "Challenges",
		allChallenges: "Alle Arena- und ARAM-Challenges",
		levelTableTitle: "Stufen und Schwellen",
		levelColumn: "Stufe",
		requiredColumn: "Benötigt",
		howToTitle: "So prüfst du deinen eigenen Fortschritt",
		howToBody:
			"Öffne den Challenges-Tab, gib deine Riot-ID und Region ein — God Tracker liest diese Challenge dann direkt von deinem Account: aktuelle Stufe, Wert, nächste Schwelle und wo du im Vergleich zu allen anderen Spielern stehst.",
		openTracker: "Zum Tracker",
		siblingsTitle: (group) => `Weitere Challenges in ${group}`,
		leaderboardNote:
			"Diese Challenge hat ein öffentliches Leaderboard, deshalb wird auch dein Platz angezeigt.",
		groupLabel: "Gruppe",
		idLabel: "Challenge-ID",
		maxLabel: "Höchste Stufe",
		metaDescription: (name, description) =>
			`${name}: ${description}. Alle Stufen und Schwellen, plus wie du deinen eigenen Fortschritt prüfst.`,
	},
};

export const DICT: Record<Locale, Dict> = { en, de };

export function t(locale: Locale): Dict {
	return DICT[locale] || DICT[DEFAULT_LOCALE];
}
