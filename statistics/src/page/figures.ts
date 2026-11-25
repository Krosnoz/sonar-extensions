// The figures of the statistics, from the weeks (../shared/shapes.ts): the weeks compared (the last full one, the last 4, or
// those since Sonar, against as many before), a figure's value over them, and whether it went the good way. The current
// week is never compared: it is not over.

import type { StatsWeek } from "../shared/shapes";

export type Week = StatsWeek;
export type Mode = "week" | "four" | "sonar";

// sum: a total per week, shown as the mean of the weeks; ratio: a part over a whole, summed over the weeks first;
// mean: a value of each week (a median), averaged. `pick` gives null for a week that did not measure it.
export type Figure = {
	readonly label: string;
	readonly hint: string;
	readonly format: (value: number) => string;
	// 1: a rise is good; -1: a fall is good; 0: neither.
	readonly better: 1 | -1 | 0;
	// A ratio shown in percent: its gap is in points.
	readonly points?: boolean;
} & (
	| { readonly kind: "sum" | "mean"; readonly pick: (week: Week) => number | null }
	| { readonly kind: "ratio"; readonly pick: (week: Week) => readonly [number, number] | null }
);

// Under this relative change (or 1 point), a figure has not moved.
const STILL = 0.03;
const STILL_POINTS = 0.01;

export function compared(weeks: readonly Week[], sonarSince: string, mode: Mode): { now: Week[]; before: Week[] } {
	const full = weeks.slice(0, -1);
	if (mode === "week") return { now: full.slice(-1), before: full.slice(-2, -1) };
	if (mode === "four") return { now: full.slice(-4), before: full.slice(-8, -4) };
	const since = sonarSince ? full.findIndex((week) => week.start >= sonarSince) : -1;
	return since < 0 ? { now: full, before: [] } : { now: full.slice(since), before: full.slice(0, since) };
}

export function valueOf(figure: Figure, weeks: readonly Week[]): number | null {
	if (figure.kind === "ratio") {
		const pairs = weeks.map(figure.pick).filter((each) => each !== null);
		const [part, whole] = pairs.reduce(([a, b], [x, y]) => [a + x, b + y], [0, 0]);
		return pairs.length && whole > 0 ? part / whole : null;
	}
	const values = weeks.flatMap((week) => figure.pick(week) ?? []);
	return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
}

// Each week's value, for the small chart under the figure.
export const seriesOf = (figure: Figure, weeks: readonly Week[]): (number | null)[] => weeks.map((week) => valueOf(figure, [week]));

// The gap, and its tone: "good", "bad", or "" (no move, or no good way).
export function gapOf(figure: Figure, now: number | null, before: number | null): { gap: number | null; tone: "good" | "bad" | "" } {
	if (now === null || before === null) return { gap: null, tone: "" };
	const gap = figure.points ? now - before : before === 0 ? (now === 0 ? 0 : null) : (now - before) / before;
	if (gap === null) return { gap: null, tone: "" };
	const still = Math.abs(gap) < (figure.points ? STILL_POINTS : STILL);
	return { gap, tone: still || figure.better === 0 ? "" : Math.sign(gap) === figure.better ? "good" : "bad" };
}
