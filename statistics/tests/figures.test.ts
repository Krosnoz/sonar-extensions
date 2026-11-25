// The page's figures (src/page/figures.ts), on the weeks the server computes (src/server/weeks.ts), as Sonar's
// tests/stats-figures.test.ts: the current week is never compared, a sum is a mean of the weeks that measured it, and a
// gap goes the good or the bad way. A measure a week did not take reads null: ./weeks.test.ts.

import { expect, test } from "bun:test";
import { compared, type Figure, gapOf, valueOf, type Week } from "../src/page/figures";
import { statsWeeks } from "../src/server/weeks";

const STARTS = ["2026-09-21", "2026-09-28", "2026-10-05", "2026-10-12"];
const work = STARTS.map((_, at) => ({ cost: at, sessions: 1, interventions: 2, agentMs: 1000, waitedMs: 0, ends: 4, sentBack: at }));
const weeks = statsWeeks(STARTS, null, work, { humanMs: [null, null, 500, 700], strays: [null, 1] });

const sum = (pick: (week: Week) => number | null, better: 1 | -1 | 0 = 1): Figure => ({ kind: "sum", label: "", hint: "", format: String, better, pick });
const ratio: Figure = {
	kind: "ratio",
	label: "",
	hint: "",
	format: String,
	better: -1,
	points: true,
	pick: (week) => (week.ends ? [week.sentBack, week.ends] : null),
};

test("the current week is left out of every comparison", () => {
	expect(compared(weeks, "", "week")).toEqual({ now: [weeks[2]], before: [weeks[1]] } as never);
	expect(compared(weeks, "", "four").now.map((week) => week.start)).toEqual(STARTS.slice(0, 3));
	expect(compared(weeks, "2026-09-28", "sonar")).toEqual({ now: weeks.slice(1, 3), before: weeks.slice(0, 1) } as never);
});

test("a sum is a mean of the weeks that measured it; a ratio sums its parts first", () => {
	const human = sum((week) => week.humanMs, -1);
	expect(valueOf(human, weeks.slice(0, 2))).toBeNull();
	expect(valueOf(human, weeks)).toBe(600);
	expect(valueOf(ratio, weeks.slice(0, 3))).toBe(3 / 12);
});

test("a gap under 3 % (or 1 point) has not moved; otherwise its tone follows the good way", () => {
	const cost = (better: 1 | -1 | 0 = 1) => sum((week) => week.cost, better);
	expect(gapOf(cost(), 102, 100).tone).toBe("");
	expect(gapOf(cost(), 120, 100)).toEqual({ gap: 0.2, tone: "good" });
	expect(gapOf(cost(-1), 120, 100).tone).toBe("bad");
	expect(gapOf(cost(0), 120, 100).tone).toBe("");
	expect(gapOf(ratio, 0.3, 0.1).tone).toBe("bad");
	expect(gapOf(ratio, 0.105, 0.1).tone).toBe("");
	expect(gapOf(cost(), 5, null)).toEqual({ gap: null, tone: "" });
});

test("a week whose wait is not measured counts nothing for the wait", () => {
	const unmeasured = weeks.map((week) => ({ ...week, waitedMs: null }));
	expect(valueOf(sum((week) => week.waitedMs, -1), unmeasured)).toBeNull();
});
