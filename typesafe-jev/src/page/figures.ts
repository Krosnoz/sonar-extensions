// What the page shows of Jev's usage over a period, from GET /usage (../cost.ts): the tile's amount, its calls and
// tokens, and the chart by day, as Sonar's plugin computes them (its usage/jev.ts and usage/series-labels.ts).

import type { UsageReport } from "../cost";
import type { Kit } from "./kit";

export type Bar = { label: string; tick: string; value: number; amount: string; share: number };
export type Chart = { title: string; said: string; bars: Bar[]; rest: number };
export type Figures = { value: string; hint: string; chart: Chart | null };

// A bar's label and its tick under it: the weekday over 7 days at most, else the day of the month every 5 days.
function barOf(day: string, usd: number, count: number, kit: Kit): Omit<Bar, "share"> {
	const at = new Date(`${day}T12:00:00`);
	const tick = count <= 7 ? kit.shortWeekday(at).replace(".", "") : at.getDate() % 5 === 0 ? String(at.getDate()) : "";
	return { label: kit.fullDay(at), tick, value: usd, amount: kit.paid(usd) };
}

export function figuresOf(report: UsageReport, kit: Kit): Figures {
	const { days } = report;
	const usd = days.reduce((sum, day) => sum + day.usd, 0);
	const calls = days.reduce((sum, day) => sum + day.calls, 0);
	const tokens = days.reduce((sum, day) => sum + day.tokens, 0);
	const hint = kit.texts.costHint(kit.whole(calls), kit.compact(tokens), days.some((day) => day.estimated));
	const most = Math.max(...days.map((day) => day.usd), 0);
	// No chart for today alone, nor when no day shows a cost: its bars would all be flat.
	if (days.length <= 1 || kit.paid(most) === kit.paid(0)) return { value: kit.paid(usd), hint, chart: null };
	// A bar's height is its share of the highest; a day that cost something shows at least a sliver.
	const highest = Math.max(most, 0.01);
	const bars = days.map((day) => ({ ...barOf(day.day, day.usd, days.length, kit), share: Math.max(day.usd > 0 ? 0.03 : 0, day.usd / highest) }));
	const said = bars.map((bar) => kit.texts.barSaid(bar.label, bar.amount)).join(", ");
	return { value: kit.paid(usd), hint, chart: { title: kit.texts.perDay(kit.paid(most)), said, bars, rest: bars.length - 1 } };
}
