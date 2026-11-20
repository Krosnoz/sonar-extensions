// The statistics run in Sonar's server: they hold its loop a bounded share at a time, and serve a long computation from
// its last value (as Sonar's own, its apps/server/src/stats/loop.test.ts and tests/server-stats-plugin.test.ts). On
// usage as large as a real one, the computation counts at most 7 days of it within one turn of the loop.

import { expect, test } from "bun:test";
import type { UsageLine } from "@sonar/extension";
import { DAY_MS, dayOf } from "../src/calendar";
import { bodyOf, started, usageLine } from "./support";

// As on real data (08/11/2026): 16 000 sessions over 60 days, in 600 projects.
const [SESSIONS, DAYS, PROJECTS] = [16_000, 60, 600];
const SESSIONS_AT_ONCE = 7 * Math.ceil(SESSIONS / DAYS);
const now = Date.now();

// Each line counts once in the turn of the loop its cost is read in.
function counted(): { lines: UsageLine[]; most: () => number; stop: () => void } {
	let [turn, last, most] = [0, -1, 0];
	let read = new Set<string>();
	let ticking = true;
	const tick = () => {
		turn += 1;
		if (ticking) setImmediate(tick);
	};
	setImmediate(tick);
	const lines = Array.from({ length: SESSIONS }, (_, at) => {
		const line = usageLine({ day: dayOf(now - (at % DAYS) * DAY_MS), sessionId: `session-${at}`, folder: `/work/project-${at % PROJECTS}`, project: `project-${at % PROJECTS}` });
		return Object.defineProperty({ ...line }, "cost", {
			enumerable: true,
			get: () => {
				if (last !== turn) [last, read] = [turn, new Set()];
				read.add(line.sessionId);
				most = Math.max(most, read.size);
				return 0.5;
			},
		});
	});
	return { lines, most: () => most, stop: () => void (ticking = false) };
}

test("the computation counts a bounded share of the usage within one turn of the loop", async () => {
	const usage = counted();
	const bench = started((each) => each.measures.usage.push(...usage.lines));
	try {
		const body = await bodyOf(bench, "/global");
		expect(usage.most()).toBeGreaterThan(0);
		expect(usage.most()).toBeLessThanOrEqual(SESSIONS_AT_ONCE);
		expect((body["projects"] as unknown[]).length).toBeGreaterThan(0);
	} finally {
		usage.stop();
	}
}, 60_000);

// `updatedAt`: when they were computed. The second reading has the first's, then a reading has the one made meanwhile.
for (const [path, query] of [
	["/global", undefined],
	["/project", { project: "sonar" }],
] as const) {
	test(`${path}: the second reading is served at once from the first, then computed again apart`, async () => {
		const bench = started();
		const computedAt = async () => (await bodyOf(bench, path, query))["updatedAt"] as number;
		const first = await computedAt();
		expect(await computedAt()).toBe(first);
		let again = first;
		while (again === first) {
			await new Promise((resolve) => setImmediate(resolve));
			again = await computedAt();
		}
		expect(again).toBeGreaterThan(first);
	});
}
