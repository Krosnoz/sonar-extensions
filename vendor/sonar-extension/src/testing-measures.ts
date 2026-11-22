// What Sonar measures, on the testing kit's server in memory (./testing.ts): the test fills the lines, each read gives
// those its bound keeps, in the order Sonar promises (the oldest first), as Sonar does. Empty until filled; the velocity
// null until set.

import type { Manifest } from "./card";
import type { ServerApi } from "./contract";
import type {
	ClosedSession,
	Covered,
	LandedMerge,
	PresenceMinute,
	ProjectTrust,
	SessionTimeline,
	StoppedCommand,
	TaskLine,
	UsageLine,
	Velocity,
} from "./measures";
import { declaredOnly, isSince } from "./rules";

export type Measures = {
	// A session's usage by day: `usage.days` gives the lines from the day of its `from` on, in the user's time zone.
	readonly usage: UsageLine[];
	// A session's timeline by its session id, cut at `since`, or at `from.usage` when it is later; another session's is
	// empty.
	readonly timelines: SessionTimeline[];
	readonly trust: ProjectTrust[];
	readonly setVelocity: (velocity: Velocity | null) => void;
	// The tasks ended at `from` or after are read, and those not ended.
	readonly tasks: TaskLine[];
	// These are read from `from` on.
	readonly presence: PresenceMinute[];
	readonly closed: ClosedSession[];
	readonly merges: LandedMerge[];
	readonly stopped: StoppedCommand[];
	// The oldest instant the bench covers for each of these reads, as Sonar's `from` (Covered of ./measures.ts): 0,
	// everything, until the test sets it; null, not measured. `presence`, `closed` and `merges`, until set, as Sonar
	// covers them: from the first line noted, null while there is none. A read's `from` is never before its `since`.
	readonly from: Record<"usage" | "tasks" | "stopped", number | null> & Partial<Record<"presence" | "closed" | "merges", number | null>>;
};

type Reads = Pick<ServerApi, "usage" | "tasks" | "presence" | "merges" | "commands"> & {
	readonly trust: ServerApi["projects"]["trust"];
	readonly closed: ServerApi["sessions"]["closed"];
};

const BAD_SINCE = "A read's bound must be { since }: a number of milliseconds.";
// A read, or an event, of a family its card does not declare.
export const notDeclared = (family: string, call: string): string =>
	`Its card does not declare the read "${family}" (${call}): add "${family}" to its "reads".`;
const sinceOf = (bound: unknown): number => {
	if (!isSince(bound)) throw new Error(BAD_SINCE);
	return bound.since;
};

// The day of a time in the user's time zone, YYYY-MM-DD.
const dayOf = (at: number) => {
	const date = new Date(at);
	return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
};

// The oldest day first, then by session id, in the order JavaScript sorts strings.
const byText = (a: string, b: string) => (a < b ? -1 : Number(a > b));
const byDayThenSession = (a: UsageLine, b: UsageLine) => byText(a.day, b.day) || byText(a.sessionId, b.sessionId);

function cut(timeline: SessionTimeline, since: number): SessionTimeline {
	return {
		...timeline,
		segments: timeline.segments.filter((each) => each.to > since).map(({ kind, from, to }) => ({ kind, from: Math.max(from, since), to })),
		touches: timeline.touches?.filter((at) => at >= since) ?? null,
	};
}

// The read's `from`: the bench's, never before `since`; null, not measured.
const fromOf = (bound: unknown, covered: number | null) => {
	const since = sinceOf(bound);
	return covered === null ? null : Math.max(since, covered);
};

// Covered from the first line noted, as Sonar covers what it notes from its first line on; null without any.
const firstNoted = (lines: readonly { readonly at: number }[], set: number | null | undefined): number | null =>
	set !== undefined ? set : lines.reduce<number | null>((first, line) => (first === null ? line.at : Math.min(first, line.at)), null);

// The lines at `from` or after, the oldest first; none when not measured.
const coveredRead =
	<Line extends { readonly at: number }>(lines: readonly Line[], covered: () => number | null) =>
	async (bound: unknown): Promise<Covered<Line>> => {
		const from = fromOf(bound, covered());
		return { from, lines: from === null ? [] : lines.filter((line) => line.at >= from).toSorted((a, b) => a.at - b.at) };
	};

// The tasks ended at `from` or after, and those not ended, the first delegated first.
const tasksRead =
	(bench: Measures) =>
	async (bound: unknown): Promise<Covered<TaskLine>> => {
		const from = fromOf(bound, bench.from.tasks);
		const kept = from === null ? [] : bench.tasks.filter((task) => task.endedAt === null || task.endedAt >= from);
		return { from, lines: kept.toSorted((a, b) => a.startedAt - b.startedAt) };
	};

const emptyBench = (setVelocity: Measures["setVelocity"]): Measures => ({
	usage: [],
	timelines: [],
	trust: [],
	setVelocity,
	tasks: [],
	presence: [],
	closed: [],
	merges: [],
	stopped: [],
	from: { usage: 0, tasks: 0, stopped: 0 },
});

// `reads`: the families its card declares; another read throws, as in Sonar.
export function measuresOf(reads: Manifest["reads"]): { readonly bench: Measures; readonly api: Reads } {
	const declared = declaredOnly(reads, notDeclared);
	let velocity: Velocity | null = null;
	const bench = emptyBench((given) => void (velocity = given));
	const usage: ServerApi["usage"] = {
		days: declared("usage", "usage.days", async (bound): Promise<Covered<UsageLine>> => {
			const from = fromOf(bound, bench.from.usage);
			if (from === null) return { from, lines: [] };
			const day = dayOf(from);
			return { from, lines: bench.usage.filter((line) => line.day >= day).toSorted(byDayThenSession) };
		}),
		// Never before the oldest instant usage.days covers, as Sonar.
		timeline: declared("usage", "usage.timeline", async (sessionId: string, bound: unknown) => {
			const since = sinceOf(bound);
			const found = bench.timelines.find((each) => each.sessionId === sessionId) ?? { sessionId, name: null, segments: [], touches: [] };
			return cut(found, Math.max(since, bench.from.usage ?? since));
		}),
		velocity: declared("usage", "usage.velocity", async () => velocity),
	};
	const tasks = tasksRead(bench);
	return {
		bench,
		api: {
			usage,
			trust: declared("trust", "projects.trust", async () => [...bench.trust]),
			tasks: { list: declared("tasks", "tasks.list", tasks) },
			presence: {
				minutes: declared(
					"presence",
					"presence.minutes",
					coveredRead(bench.presence, () => firstNoted(bench.presence, bench.from.presence)),
				),
			},
			closed: declared(
				"sessions",
				"sessions.closed",
				coveredRead(bench.closed, () => firstNoted(bench.closed, bench.from.closed)),
			),
			merges: {
				landed: declared(
					"merges",
					"merges.landed",
					coveredRead(bench.merges, () => firstNoted(bench.merges, bench.from.merges)),
				),
			},
			commands: {
				stopped: declared(
					"commands",
					"commands.stopped",
					coveredRead(bench.stopped, () => bench.from.stopped),
				),
			},
		},
	};
}
