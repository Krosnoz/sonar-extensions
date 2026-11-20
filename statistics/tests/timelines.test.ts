// The strips of a project's sessions (GET /tasks), as Sonar's own (its tests/stats-timelines.test.ts): which sessions,
// under which name, with what cost, a delegated task counted for its parent when both are in the project, and the
// user's minutes on each. Which transcript Sonar reads for a session (its own, never a subagent's; the next copy when
// one is gone) is Sonar's: usage.timeline gives the timeline it read.

import { expect, test } from "bun:test";
import type { SessionTimeline, TaskLine } from "@sonar/extension";
import type { Bench } from "@sonar/extension/testing";
import { DAY_MS, dayOf } from "../src/calendar";
import { layered, timelineFrom } from "../src/timelines";
import { bodyOf, started, usageLine } from "./support";

const NOW = Date.now();
const SINCE = NOW - 7 * DAY_MS;

type Fake = { session: string; folder: string; cost: number; lastAt: number; day?: string };
type Strip = { session: string; name: string; cost: number; agentMs: number; interventions: number; humanMs: number; touches: number[]; from: number; to: number };

// A session's project: the folder under /w; its timeline: a second of work, and the user's message at its last activity.
function pose(bench: Bench, sessions: readonly Fake[], names: Record<string, string> = {}): void {
	for (const { session, folder, cost, lastAt, day = dayOf(lastAt) } of sessions) {
		bench.measures.usage.push(usageLine({ day, sessionId: session, folder, project: folder.split("/")[2] ?? null, cost, lastAt }));
		const timeline: SessionTimeline = { sessionId: session, name: names[session] ?? null, segments: [{ kind: "work", from: NOW - 3000, to: NOW - 2000 }], touches: [lastAt] };
		bench.measures.timelines.push(timeline);
	}
}
const stripsOf = async (bench: Bench, project: string) => (await bodyOf(bench, "/tasks", { project })) as unknown as Strip[];

test("a project's sessions active in the window, the latest first, each under its name or its folder", async () => {
	const bench = started((each) =>
		pose(
			each,
			[
				{ session: "a", folder: "/w/sonar/main", cost: 2, lastAt: NOW - 5000 },
				{ session: "b", folder: "/w/sonar/wt-b", cost: 1, lastAt: NOW - 1000 },
				{ session: "other", folder: "/w/acme/main", cost: 9, lastAt: NOW },
				{ session: "old", folder: "/w/sonar/main", cost: 4, lastAt: SINCE - DAY_MS },
			],
			{ a: "Frise" },
		),
	);
	const rows = await stripsOf(bench, "sonar");
	expect(rows.map(({ session, name, cost }) => [session, name, cost])).toEqual([
		["b", "wt-b", 1],
		["a", "Frise", 2],
	]);
	expect(rows[0]).toMatchObject({ agentMs: 1000, interventions: 1, humanMs: 0 });
	expect((rows[0]?.to ?? 0) - (rows[0]?.from ?? 0)).toBe(7 * DAY_MS);
});

test("a task delegated within the project counts for its parent; one in another project is its own row", async () => {
	const task = (sessionId: string, parentSessionId: string): TaskLine => ({ sessionId, parentSessionId, project: "", state: "done", startedAt: NOW, endedAt: NOW });
	const bench = started((each) => {
		pose(each, [
			{ session: "parent", folder: "/w/sonar/main", cost: 1, lastAt: NOW - 9000 },
			{ session: "child", folder: "/w/sonar/wt-child", cost: 2, lastAt: NOW - 100 },
			{ session: "grandchild", folder: "/w/sonar/wt-gc", cost: 4, lastAt: NOW - 50 },
			{ session: "away", folder: "/w/acme/wt", cost: 8, lastAt: NOW },
		]);
		each.measures.tasks.push(task("child", "parent"), task("grandchild", "child"), task("away", "parent"));
	});
	const rows = await stripsOf(bench, "sonar");
	expect(rows.map(({ session, cost }) => [session, cost])).toEqual([["parent", 7]]);
	// The touches stay the parent's: a task's brief is not the user's.
	expect(rows[0]?.touches).toEqual([NOW - 9000]);
	expect((await stripsOf(bench, "acme")).map(({ session }) => session)).toEqual(["away"]);
});

test("the user's minutes on a session of the strip's window", async () => {
	const bench = started((each) => {
		pose(each, [{ session: "a", folder: "/w/sonar/main", cost: 1, lastAt: NOW }]);
		each.measures.presence.push(
			{ at: SINCE - 60_000, project: "sonar", sessionId: "a" },
			{ at: NOW - 120_000, project: "sonar", sessionId: "a" },
			{ at: NOW - 60_000, project: "sonar", sessionId: "a" },
		);
	});
	expect((await stripsOf(bench, "sonar"))[0]?.humanMs).toBe(120_000);
});

test("at most 20 rows", async () => {
	const many = Array.from({ length: 25 }, (_, index) => ({ session: `s${index}`, folder: "/w/sonar/main", cost: 1, lastAt: NOW - index }));
	const rows = await stripsOf(
		started((each) => pose(each, many)),
		"sonar",
	);
	expect(rows).toHaveLength(20);
	expect(rows[0]?.session).toBe("s0");
});

test("timelines laid over each other: work wins over a wait, the touches are the first's", () => {
	const own = timelineFrom(
		[
			{ kind: "work", from: 0, to: 10 },
			{ kind: "wait", from: 10, to: 40 },
		],
		[0],
	);
	const task = timelineFrom([{ kind: "work", from: 20, to: 30 }], [20]);
	expect(layered(own, [task])).toEqual({
		segments: [
			{ kind: "work", from: 0, to: 10 },
			{ kind: "wait", from: 10, to: 20 },
			{ kind: "work", from: 20, to: 30 },
			{ kind: "wait", from: 30, to: 40 },
		],
		touches: [0],
		agentMs: 20,
		waitedMs: 20,
		interventions: 1,
	});
});
