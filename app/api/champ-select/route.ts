import { readFile } from "node:fs/promises";
import https from "node:https";

// The League client writes host/port/password here while it runs. Override with LEAGUE_LOCKFILE
// if League is installed somewhere else.
const LOCKFILE =
	process.env.LEAGUE_LOCKFILE || "C:\\Riot Games\\League of Legends\\lockfile";

function json(body: unknown, status = 200) {
	return new Response(JSON.stringify(body), {
		status,
		headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
	});
}

function lcuGet(port: number, password: string, path: string) {
	return new Promise<{ status: number; body: string }>((resolve, reject) => {
		const request = https.request(
			{
				host: "127.0.0.1",
				port,
				path,
				method: "GET",
				// The client serves a self-signed cert and is only ever reached over loopback.
				rejectUnauthorized: false,
				headers: {
					Authorization: "Basic " + Buffer.from(`riot:${password}`).toString("base64"),
				},
				timeout: 3000,
			},
			(response) => {
				let body = "";
				response.on("data", (chunk) => (body += chunk));
				response.on("end", () => resolve({ status: response.statusCode || 0, body }));
			}
		);
		request.on("timeout", () => request.destroy(new Error("LCU timeout")));
		request.on("error", reject);
		request.end();
	});
}

interface ChampSelectAction {
	championId: number;
	completed: boolean;
	type: string;
}

interface ChampSelectPlayer {
	cellId: number;
	championId: number;
	championPickIntent?: number;
}

export async function GET() {
	let port: number;
	let password: string;

	try {
		// LeagueClient:pid:port:password:protocol
		const parts = (await readFile(LOCKFILE, "utf8")).trim().split(":");
		port = Number(parts[2]);
		password = parts[3];
		if (!port || !password) throw new Error("malformed lockfile");
	} catch {
		return json({ active: false, reason: "League client not running" });
	}

	try {
		const [sessionResponse, phase] = await Promise.all([
			lcuGet(port, password, "/lol-champ-select/v1/session"),
			lcuGet(port, password, "/lol-gameflow/v1/gameflow-phase"),
		]);

		// None | Lobby | Matchmaking | ReadyCheck | ChampSelect | InProgress | WaitingForStats |
		// PreEndOfGame | EndOfGame. This is the only honest answer to "is the player in a game",
		// because Arena keeps a match alive in spectator long after you were knocked out of it.
		const clientPhase: string | null =
			phase.status === 200 ? JSON.parse(phase.body) : null;

		const { status, body } = sessionResponse;

		// 404 is the client's way of saying "not in champ select right now".
		if (status === 404) return json({ active: false, clientPhase, reason: "Not in champ select" });
		if (status !== 200) {
			return json({ active: false, clientPhase, reason: `Client returned ${status}` });
		}

		const session = JSON.parse(body);
		const actions: ChampSelectAction[] = (session.actions || []).flat();
		const players: ChampSelectPlayer[] = [
			...(session.myTeam || []),
			...(session.theirTeam || []),
		];

		const bannedChampionIds = [
			...actions.filter((a) => a.type === "ban" && a.completed).map((a) => a.championId),
			...(session.bans?.myTeamBans || []),
			...(session.bans?.theirTeamBans || []),
		].filter((id: number) => id > 0);

		// Hovered picks count as taken too — no point suggesting a champion a teammate is locking in.
		const pickedChampionIds = [
			...actions.filter((a) => a.type === "pick").map((a) => a.championId),
			...players.map((p) => p.championId),
			...players.map((p) => p.championPickIntent || 0),
		].filter((id: number) => id > 0);

		const me = (session.myTeam || []).find(
			(p: ChampSelectPlayer) => p.cellId === session.localPlayerCellId
		);

		return json({
			active: true,
			clientPhase,
			bannedChampionIds: [...new Set(bannedChampionIds)],
			pickedChampionIds: [...new Set(pickedChampionIds)],
			myChampionId: me?.championId || me?.championPickIntent || 0,
			timeLeftMs: session.timer?.adjustedTimeLeftInPhase ?? null,
			phase: session.timer?.phase ?? null,
		});
	} catch (error) {
		console.error("Error reading champ select:", error);
		return json({ active: false, reason: "Could not reach League client" });
	}
}
