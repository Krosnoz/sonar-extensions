// The agents' reliability week by week (GET /global), from what Sonar keeps: merges landed at the first try, delegated
// tasks that failed, commands left behind and stopped, worksites closed, the user's time. As Sonar's own statistics
// (its tests/stats-weeks.test.ts), with what the contract adds: each read's `from`.

import { expect, test } from "bun:test";
import type { TaskLine } from "@sonar/extension";
import { DAY_MS } from "../src/calendar";
import { at, bodyOf, startOf, started, weekStarting } from "./support";

const task = (state: TaskLine["state"], endedAt: number | null): TaskLine => ({
	sessionId: null,
	parentSessionId: null,
	project: "sonar",
	state,
	startedAt: at(7, 0),
	endedAt,
});
const closed = (when: number, extra: { project?: string; task?: boolean } = {}) => ({
	handle: "s-1",
	sessionId: "id-1",
	name: "Stats",
	project: extra.project ?? "sonar",
	at: when,
	task: extra.task ?? false,
});

// Merges the contract gives with their first pass already told (Sonar reads its queue's rounds and the merges announced).
const reliability = () =>
	started((bench) => {
		bench.measures.merges.push(
			{ at: at(6, 0), project: "sonar", firstPass: true },
			...[true, false, false].map((firstPass, day) => ({ at: at(7, day), project: "sonar", firstPass })),
			{ at: at(8, 0), project: "delta", firstPass: false },
			{ at: at(8, 1), project: "delta", firstPass: true },
			{ at: at(8, 1), project: "sonar", firstPass: true },
			{ at: at(8, 2), project: "sonar", firstPass: false },
		);
		bench.measures.tasks.push(task("done", at(7, 1)), task("failed", at(7, 2)), task("stopped", at(7, 3)), task("running", null));
		bench.measures.from.stopped = Date.now() - 7 * DAY_MS;
		for (const [index, when] of [at(8, 0), at(8, 2), at(8, 3)].entries())
			bench.measures.stopped.push({ at: Math.min(when, Date.now()), project: index === 1 ? "delta" : "sonar" });
		bench.measures.closed.push(closed(at(8, 1)), closed(at(8, 2), { task: true }), closed(at(8, 3), { project: "delta" }));
	});

test("merges by week: those landed at the first try among them", async () => {
	const body = await bodyOf(reliability(), "/global");
	expect(weekStarting(body, 6)).toMatchObject({ landed: 1, firstPass: 1 });
	expect(weekStarting(body, 7)).toMatchObject({ landed: 3, firstPass: 1 });
	expect(weekStarting(body, 8)).toMatchObject({ landed: 4, firstPass: 2 });
});

test("an empty week counts zero, not 'not measured'", async () => {
	expect(weekStarting(await bodyOf(reliability(), "/global"), 5)).toMatchObject({ landed: 0, firstPass: 0, tasksEnded: 0, tasksFailed: 0 });
});

test("tasks by week of their end: a failure, a stop by the user; one not ended is not counted", async () => {
	const body = await bodyOf(reliability(), "/global");
	expect(weekStarting(body, 7)).toMatchObject({ tasksEnded: 3, tasksFailed: 1 });
	expect(weekStarting(body, 8)).toMatchObject({ tasksEnded: 0, tasksFailed: 0 });
});

test("commands stopped by Sonar, by week; a week that ended before what Sonar keeps reads 'not measured'", async () => {
	const body = await bodyOf(reliability(), "/global");
	expect(weekStarting(body, 8).strays).toBe(3);
	expect(weekStarting(body, 7).strays).toBe(0);
	expect(weekStarting(body, 0).strays).toBeNull();
});

test("worksites closed: a task's session is no worksite; the weeks before the first one read 'not measured'", async () => {
	const body = await bodyOf(reliability(), "/global");
	expect(weekStarting(body, 8).closed).toBe(2);
	expect(weekStarting(body, 7).closed).toBeNull();
});

test("a project's line counts its own measures", async () => {
	const bench = reliability();
	bench.measures.usage.push(lineOf("delta"));
	const delta = ((await bodyOf(bench, "/global"))["projects"] as { project: string; weeks: never[] }[]).find((line) => line.project === "delta");
	expect(delta && weekStarting(delta, 8)).toMatchObject({ landed: 2, firstPass: 1, strays: 1, closed: 1, tasksEnded: 0 });
});

test("the merges before what Sonar keeps count 0, not 'not measured', as Sonar's own statistics have no 'not measured' for them", async () => {
	const from = at(7, 1, 0);
	const bench = started((each) => {
		each.measures.from.merges = from;
		each.measures.merges.push(...[0, 1, 2].map((day) => ({ at: at(7, day), project: "sonar", firstPass: true })));
	});
	const body = await bodyOf(bench, "/global");
	expect(weekStarting(body, 6)).toMatchObject({ landed: 0, firstPass: 0 });
	expect(weekStarting(body, 7)).toMatchObject({ landed: 2, firstPass: 2 });
});

test("a read Sonar does not measure (`from` null): time, worksites and commands 'not measured'; merges and tasks 0", async () => {
	const bench = started((each) => {
		Object.assign(each.measures.from, { presence: null, closed: null, merges: null, tasks: null, stopped: null });
		each.measures.tasks.push(task("done", at(8, 0)));
		each.measures.merges.push({ at: at(8, 0), project: "sonar", firstPass: true });
	});
	const weeks = (await bodyOf(bench, "/global"))["weeks"] as Record<string, unknown>[];
	for (const week of weeks) expect(week).toMatchObject({ humanMs: null, closed: null, strays: null, landed: 0, firstPass: 0, tasksEnded: 0, tasksFailed: 0 });
});

test("the user's time by week, from the week of the first minute Sonar keeps; a minute without a project counts in the whole", async () => {
	const bench = started((each) => {
		each.measures.presence.push(
			{ at: at(7, 1), project: "sonar", sessionId: "a" },
			{ at: at(7, 1) + 60_000, project: null, sessionId: null },
			{ at: at(8, 0), project: "sonar", sessionId: "a" },
		);
		each.measures.usage.push(lineOf("sonar"));
	});
	const body = await bodyOf(bench, "/global");
	expect([6, 7, 8].map((week) => weekStarting(body, week).humanMs)).toEqual([null, 120_000, 60_000]);
	const sonar = (body["projects"] as { project: string; weeks: never[] }[])[0];
	expect(sonar && [7, 8].map((week) => weekStarting(sonar, week).humanMs)).toEqual([60_000, 60_000]);
});

// A session's work this week in a project: its line among every project's.
const lineOf = (project: string) => ({
	day: startOf(8),
	sessionId: `session-${project}`,
	folder: `/work/${project}`,
	project,
	cost: 1,
	messages: 1,
	activeMs: 1000,
	lastAt: at(8, 0),
	ends: 1,
	sentBack: 0,
	repliesMs: [],
});
