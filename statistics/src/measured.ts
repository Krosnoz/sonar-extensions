// The measures Sonar keeps by itself, week by week (./weekly.ts): the user's time, the worksites closed, the merges, the
// delegated tasks and the commands left behind. Each read gives `from`, the oldest instant Sonar covers for it (Covered
// of the contract); a week is read as Sonar's own statistics read it:
// - the user's time and the worksites closed: null ("not measured yet") before the week of `from`, every week null
//   when `from` is null;
// - the merges and the tasks: counted from the lines, 0 before `from` and when `from` is null, never null, as Sonar's
//   own statistics, which have no "not measured" for them;
// - the commands stopped: null for a week that ended before `from`, every week null when `from` is null.

import type { ServerApi } from "@sonar/extension";
import { DAY_MS, dayOf, nextTurn, startOfDay, weekOf } from "./calendar";
import { type Week, weekly } from "./weekly";

// A measure per week, the same length as the Mondays; none: not measured.
export type Series = readonly (number | null)[];
export type Measured = Partial<Record<"humanMs" | "closed" | "landed" | "firstPass" | "tasksEnded" | "tasksFailed" | "strays", Series>>;

const MINUTE_MS = 60_000;

// The weeks from the one of `from` on; none: nothing measured yet.
const fromWeek = (starts: readonly string[], from: number | null) => {
	const at = from === null ? starts.length : weekOf(starts, dayOf(from));
	return (values: readonly number[]) => values.map((value, index) => (index >= at ? value : null));
};

const pick = <T>(weeks: readonly Week<T>[], project: string | null, of: (count: T) => number, empty: T) =>
	weeks.map((week) => of(project === null ? week.total : (week.projects[project] ?? empty)));

// The user's minutes by week, every project's and each project's; a minute without a project counts in its week only.
function humanTime(minutes: readonly { readonly at: number; readonly project: string | null }[], starts: readonly string[]) {
	const weeks = starts.map(() => 0);
	const byProject: Record<string, number[]> = {};
	for (const minute of minutes) {
		const index = weekOf(starts, dayOf(minute.at));
		if (index < 0) continue;
		weeks[index] = (weeks[index] ?? 0) + MINUTE_MS;
		if (minute.project === null) continue;
		const ofProject = (byProject[minute.project] ??= starts.map(() => 0));
		ofProject[index] = (ofProject[index] ?? 0) + MINUTE_MS;
	}
	return { weeks, byProject };
}

// The measures, read once from the first Monday; `of` gives a project's (null: every project's).
export async function readMeasured(api: ServerApi, starts: readonly string[]): Promise<(project: string | null) => Measured> {
	const bound = { since: startOfDay(starts[0] ?? dayOf(Date.now())) };
	const [presence, closed, merges, tasks, stopped] = await Promise.all([
		api.presence.minutes(bound),
		api.sessions.closed(bound),
		api.merges.landed(bound),
		api.tasks.list(bound),
		api.commands.stopped(bound),
	]);
	const mergeWeeks = weekly(starts, merges.lines, (landed) => ({ landed: landed.length, firstPass: landed.filter((each) => each.firstPass).length }));
	const ended = tasks.lines.flatMap((task) => (task.endedAt === null ? [] : [{ at: task.endedAt, project: task.project, state: task.state }]));
	const taskWeeks = weekly(starts, ended, (list) => ({ ended: list.length, failed: list.filter((task) => task.state === "failed").length }));
	await nextTurn();
	const closedWeeks = weekly(
		starts,
		closed.lines.filter((each) => !each.task),
		(list) => list.length,
	);
	const strayWeeks = weekly(starts, stopped.lines, (list) => list.length);
	await nextTurn();
	const human = humanTime(presence.lines, starts);
	const sinceMarks = fromWeek(starts, presence.from);
	const sinceClosed = fromWeek(starts, closed.from);
	// As Sonar's own statistics: a week whose Monday, read in UTC, is more than 7 days before what is covered.
	const strayCovered = (values: readonly number[]) =>
		values.map((value, index) => (stopped.from !== null && Date.parse(starts[index] ?? "") + 7 * DAY_MS >= stopped.from ? value : null));
	const noMerge = { landed: 0, firstPass: 0 };
	const noTask = { ended: 0, failed: 0 };
	return (project) => ({
		humanMs: sinceMarks(project === null ? human.weeks : (human.byProject[project] ?? starts.map(() => 0))),
		closed: sinceClosed(pick(closedWeeks, project, (count) => count, 0)),
		landed: pick(mergeWeeks, project, (count) => count.landed, noMerge),
		firstPass: pick(mergeWeeks, project, (count) => count.firstPass, noMerge),
		tasksEnded: pick(taskWeeks, project, (count) => count.ended, noTask),
		tasksFailed: pick(taskWeeks, project, (count) => count.failed, noTask),
		strays: strayCovered(pick(strayWeeks, project, (count) => count, 0)),
	});
}
