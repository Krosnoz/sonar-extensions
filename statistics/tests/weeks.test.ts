// The statistics' weeks: the agents' work read from the usage, the velocity's counts in the statistics' units, a measure
// a week did not take read "not measured" (as Sonar's tests/stats-figures.test.ts), and each project's line with its
// trust.

import { expect, test } from "bun:test";
import type { Velocity, VelocityWeek } from "@sonar/extension";
import { statsWeeks } from "../src/server/weeks";
import { at, bodyOf, startOf, started, usageLine, weekStarting } from "./support";

const STARTS = ["2026-09-21", "2026-09-28", "2026-10-05", "2026-10-12"];

test("a week a measure did not take reads null; one with no velocity counts no PR", () => {
	const work = STARTS.map((_, at) => ({ cost: at, sessions: 1, interventions: 2, agentMs: 1000, waitedMs: 0, ends: 4, sentBack: at }));
	const weeks = statsWeeks(STARTS, null, work, { humanMs: [null, null, 500, 700], strays: [null, 1] });
	expect(weeks.map((week) => week.humanMs)).toEqual([null, null, 500, 700]);
	expect(weeks.map((week) => week.strays)).toEqual([null, 1, null, null]);
	expect(weeks.map((week) => [week.prs, week.leadHours, week.closed])).toEqual(STARTS.map(() => [0, null, null]));
	expect(weeks[3]?.cost).toBe(3);
});

const velocityWeek = (start: string, fields: Partial<VelocityWeek> = {}): VelocityWeek => ({
	start,
	prs: null,
	leadMs: null,
	commits: 0,
	parallel: null,
	replyMs: null,
	...fields,
});

test("the velocity in the statistics' units: PRs GitHub did not give count 0, the lead time in hours, the reply in seconds", async () => {
	const starts = [0, 1, 2, 3, 4, 5, 6, 7, 8].map(startOf);
	const velocity: Velocity = {
		sonarSince: null,
		weeks: starts.map((start, index) => velocityWeek(start, index === 8 ? { prs: 3, leadMs: 7_200_000, commits: 12, parallel: 2.5, replyMs: 30_000 } : {})),
		projects: [{ project: "sonar", weeks: starts.map((start) => velocityWeek(start, { commits: 1 })) }],
	};
	const bench = started((each) => {
		each.measures.setVelocity(velocity);
		each.measures.usage.push(usageLine({ day: startOf(8), sessionId: "a", folder: "/work/sonar", project: "sonar", cost: 1 }));
	});
	const body = await bodyOf(bench, "/global");
	expect(body["sonarSince"]).toBe("");
	expect(weekStarting(body, 8)).toMatchObject({ prs: 3, leadHours: 2, commits: 12, parallel: 2.5, reply: 30 });
	expect(weekStarting(body, 7)).toMatchObject({ prs: 0, leadHours: null, commits: 0, parallel: null, reply: null });
	const sonar = (body["projects"] as { project: string; weeks: never[] }[])[0];
	expect(sonar && weekStarting(sonar, 7)).toMatchObject({ prs: 0, leadHours: null, commits: 1 });
	// The weeks are the velocity's.
	expect((body["weeks"] as { start: string }[]).map((week) => week.start)).toEqual(starts);
});

test("the agents' work by week: every project's and each project's; a session without a folder only in the whole", async () => {
	const bench = started((each) => {
		each.measures.usage.push(
			usageLine({ day: startOf(8), sessionId: "a", folder: "/work/sonar", project: "sonar", cost: 2, messages: 3, activeMs: 60_000, ends: 4, sentBack: 1, repliesMs: [5000, 7000] }),
			usageLine({ day: startOf(8), sessionId: "b", folder: "/work/acme", project: "acme", cost: 0.004, messages: 1 }),
			usageLine({ day: startOf(8), sessionId: "c", cost: 1, activeMs: 1000 }),
			// Neither a cost nor a message: no session worked in.
			usageLine({ day: startOf(7), sessionId: "d", folder: "/work/sonar", project: "sonar", activeMs: 5 }),
			usageLine({ day: startOf(7), sessionId: "a", folder: "/work/sonar", project: "sonar", cost: 0.5, lastAt: at(7, 0) }),
		);
	});
	const body = await bodyOf(bench, "/global");
	expect(weekStarting(body, 8)).toMatchObject({ cost: 3.004, sessions: 3, interventions: 4, agentMs: 61_000, waitedMs: 12_000, ends: 4, sentBack: 1 });
	expect(weekStarting(body, 7)).toMatchObject({ cost: 0.5, sessions: 1, agentMs: 5 });
	// A project with less than a cent over the weeks is left out of the lines.
	const lines = body["projects"] as { project: string; level: number | null; weeks: never[] }[];
	expect(lines.map((line) => [line.project, line.level])).toEqual([["sonar", null]]);
	expect(weekStarting(lines[0] ?? { weeks: [] }, 8)).toMatchObject({ cost: 2, sessions: 1, interventions: 3, waitedMs: 12_000 });
});

test("a project's statistics: its weeks, every project's cost, and its trust as the contract gives it", async () => {
	const bench = started((each) => {
		each.measures.usage.push(
			usageLine({ day: startOf(8), sessionId: "a", folder: "/work/sonar", project: "sonar", cost: 2 }),
			usageLine({ day: startOf(8), sessionId: "b", folder: "/work/acme", project: "acme", cost: 1 }),
		);
		each.measures.trust.push({ project: "sonar", level: 2, proofs: ["verification", "reverts"], points: 12, working: 10 });
	});
	const body = await bodyOf(bench, "/project", { project: "sonar" });
	expect(body).toMatchObject({ project: "sonar", sonarSince: "", updatedAt: expect.any(Number) });
	expect((body["allCost"] as number[]).at(-1)).toBe(3);
	expect(weekStarting(body, 8).cost).toBe(2);
	expect(body["trust"]).toEqual({
		level: 2,
		proofs: { verification: true, corrections: false, sentBack: false, reverts: true },
		measures: { verification: { points: 12, working: 10 } },
	});
	expect((await bodyOf(bench, "/project", { project: "acme" }))["trust"]).toBeNull();
	const levels = ((await bodyOf(bench, "/global"))["projects"] as { project: string; level: number | null }[]).map((line) => [line.project, line.level]);
	expect(levels).toEqual([
		["sonar", 2],
		["acme", null],
	]);
});

test("a trust level a later contract adds is read as unknown", async () => {
	const bench = started((each) => {
		each.measures.usage.push(usageLine({ day: startOf(8), sessionId: "a", folder: "/work/sonar", project: "sonar", cost: 2 }));
		each.measures.trust.push({ project: "sonar", level: 4 as never, proofs: [], points: 0, working: 0 });
	});
	expect((await bodyOf(bench, "/project", { project: "sonar" }))["trust"]).toBeNull();
	expect(((await bodyOf(bench, "/global"))["projects"] as { level: number | null }[])[0]?.level).toBeNull();
});

test("before Sonar has read its agents' files (usage `from` null): no work counted, no project's line", async () => {
	const bench = started((each) => {
		each.measures.from.usage = null;
		each.measures.usage.push(usageLine({ day: startOf(8), sessionId: "a", folder: "/work/sonar", project: "sonar", cost: 2 }));
	});
	const body = await bodyOf(bench, "/global");
	expect(weekStarting(body, 8)).toMatchObject({ cost: 0, sessions: 0, waitedMs: 0 });
	expect(body["projects"]).toEqual([]);
});

test("a project's route without its project answers 400", async () => {
	const bench = started();
	for (const path of ["/project", "/tasks"]) expect(await bench.get(path)).toEqual({ status: 400, body: { error: "Name the project: ?project=<name>." } });
});
