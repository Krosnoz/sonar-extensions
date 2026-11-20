// A project's sessions of the last 7 days on a strip (./timelines.ts), with the user's minutes on each (presence).

import type { ServerApi } from "@sonar/extension";
import { DAY_MS } from "./calendar";
import type { StatsTask } from "./shapes";
import { timelinesOf } from "./timelines";

const DAYS = 7;
const MINUTE_MS = 60_000;

export async function strips(api: ServerApi, project: string): Promise<StatsTask[]> {
	const to = Date.now();
	const from = to - DAYS * DAY_MS;
	// Every day Sonar covers: a delegating session's folder may come from a day before the strip's.
	const [usage, tasks, presence] = await Promise.all([api.usage.days({ since: 0 }), api.tasks.list({ since: 0 }), api.presence.minutes({ since: from })]);
	// The first task delegated keeps its session, as Sonar finds it.
	const parents = new Map<string, string | null>();
	for (const task of tasks.lines) if (task.sessionId !== null && !parents.has(task.sessionId)) parents.set(task.sessionId, task.parentSessionId);
	const rows = await timelinesOf(api, { lines: usage.lines, parentOf: (session) => parents.get(session) ?? undefined }, project, from);
	const mine = new Map<string, number>();
	for (const minute of presence.lines) if (minute.sessionId !== null) mine.set(minute.sessionId, (mine.get(minute.sessionId) ?? 0) + MINUTE_MS);
	return rows.map((row) => ({
		session: row.session,
		name: row.name,
		cost: row.cost,
		agentMs: row.agentMs,
		waitedMs: row.waitedMs,
		humanMs: mine.get(row.session) ?? 0,
		interventions: row.interventions,
		from,
		to,
		segments: row.segments,
		touches: row.touches,
	}));
}
