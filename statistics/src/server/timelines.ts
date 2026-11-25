// The timelines of a project's sessions active since a time: when each agent worked, waited for the user, and when the
// user touched it. The usage (usage.days) says which sessions were active, in which folder, and what they cost; Sonar
// reads each session's timeline from its own files (usage.timeline). A task delegated within the project counts for the
// session that delegated it; one in another project is a row of its own.

import type { ServerApi, SessionTimeline, UsageLine } from "@sonar/extension";
import { dayOf } from "./calendar";
import type { Segment } from "../shared/shapes";

// `touches`: null, not measured (the contract gives them so while the user does not want their activity measured).
export type Timeline = {
	readonly segments: readonly Segment[];
	readonly touches: readonly number[] | null;
	readonly agentMs: number;
	readonly waitedMs: number;
	readonly interventions: number | null;
};
export type RowTimeline = Timeline & { readonly session: string; readonly name: string; readonly cost: number; readonly lastAt: number };

export function timelineFrom(segments: readonly Segment[], touches: readonly number[] | null): Timeline {
	const sum = (kind: Segment["kind"]) => segments.reduce((total, each) => (each.kind === kind ? total + each.to - each.from : total), 0);
	return { segments, touches, agentMs: sum("work"), waitedMs: sum("wait"), interventions: touches === null ? null : touches.length };
}

// Timelines laid over each other (a session and the tasks it delegated): the agents work when one of them works, and
// wait otherwise when one of them waits. The touches are the first's: a task's brief is its parent's, not the user's.
export function layered(first: Timeline, others: readonly Timeline[]): Timeline {
	const all = [first, ...others].flatMap(({ segments }) => segments);
	const cuts = [...new Set(all.flatMap(({ from, to }) => [from, to]))].toSorted((a, b) => a - b);
	const segments: { kind: Segment["kind"]; from: number; to: number }[] = [];
	for (let index = 1; index < cuts.length; index++) {
		const [from = 0, to = 0] = [cuts[index - 1], cuts[index]];
		const kinds = new Set(all.filter((each) => each.from <= from && each.to >= to).map((each) => each.kind));
		const kind = kinds.has("work") ? "work" : kinds.has("wait") ? "wait" : undefined;
		const last = segments.at(-1);
		if (!kind) continue;
		if (last?.kind === kind && last.to === from) last.to = to;
		else segments.push({ kind, from, to });
	}
	return timelineFrom(segments, first.touches);
}

const ROWS = 20;

type Row = { session: string; members: Set<string>; cost: number; lastAt: number };

export type RowSources = {
	// Each session's usage by day, as usage.days gives it.
	readonly lines: readonly UsageLine[];
	// The session that delegated this one, by session id.
	readonly parentOf: (session: string) => string | undefined;
};

// The folder of each session its lines name.
const foldersOf = (lines: readonly UsageLine[]) => new Map(lines.flatMap((line) => (line.folder === null ? [] : [[line.sessionId, line] as const])));

// The session a task's work counts for: the highest one that delegated it within the project.
function rowOf(sources: RowSources, folders: ReturnType<typeof foldersOf>, project: string, session: string): string {
	const seen = new Set<string>();
	let row = session;
	for (let parent = sources.parentOf(row); parent && !seen.has(parent); parent = sources.parentOf(row)) {
		if (folders.get(parent)?.project !== project) break;
		seen.add(row);
		row = parent;
	}
	return row;
}

export function rowsOf(sources: RowSources, project: string, since: number): Row[] {
	const folders = foldersOf(sources.lines);
	const rows = new Map<string, Row>();
	const first = dayOf(since);
	for (const line of sources.lines) {
		if (line.day < first || line.project !== project) continue;
		const key = rowOf(sources, folders, project, line.sessionId);
		const row = rows.get(key) ?? { session: key, members: new Set([key]), cost: 0, lastAt: 0 };
		row.members.add(line.sessionId);
		row.cost += line.cost;
		row.lastAt = Math.max(row.lastAt, line.lastAt);
		rows.set(key, row);
	}
	return [...rows.values()].filter((row) => row.lastAt >= since).toSorted((a, b) => b.lastAt - a.lastAt);
}

const lastFolder = (folder: string | null | undefined) => folder?.split("/").findLast(Boolean);

// The ROWS sessions of `project` last active since `since`, the latest first. Their timelines are read one after
// another: each one may read a transcript.
export async function timelinesOf(api: ServerApi, sources: RowSources, project: string, since: number): Promise<RowTimeline[]> {
	const folders = foldersOf(sources.lines);
	const found: RowTimeline[] = [];
	for (const row of rowsOf(sources, project, since).slice(0, ROWS)) {
		const read: SessionTimeline[] = [];
		for (const member of row.members) read.push(await api.usage.timeline(member, { since }));
		const [own, ...tasks] = read.map((each) => timelineFrom(each.segments, each.touches));
		const timeline = own && tasks.length ? layered(own, tasks) : (own ?? timelineFrom([], []));
		const name = read[0]?.name ?? lastFolder(folders.get(row.session)?.folder) ?? row.session;
		found.push({ ...timeline, session: row.session, name, cost: row.cost, lastAt: row.lastAt });
	}
	return found;
}
