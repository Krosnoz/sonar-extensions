// What Jev costs, computed from its usage (./usage.ts) as Sonar computed it: the month's spending its cap is checked
// against, and the cost of each day the page shows.

import { dayOf, daysAgo } from "./calendar";
import type { Days } from "./usage";

// Jev's public price (September 2026): per million input tokens, output is free.
export const JEV_PER_MTOK = 0.042;
// Calls counted before their tokens were read: estimated at the average measured since (or this value).
const TOKENS_FALLBACK = 3000;

const usdOf = (tokens: number) => (tokens * JEV_PER_MTOK) / 1e6;

function averageTokens(days: Readonly<Days>): number {
	const all = Object.values(days);
	const tokens = all.reduce((sum, day) => sum + day.tokens, 0);
	const calls = all.reduce((sum, day) => sum + day.metered, 0);
	return calls ? tokens / calls : TOKENS_FALLBACK;
}

// A day's cost, the calls without their tokens estimated at the average.
export function dayCost(days: Readonly<Days>, day: string): { usd: number; estimated: boolean } {
	const { tokens = 0, calls = 0, metered = 0 } = days[day] ?? {};
	const unmetered = Math.max(0, calls - metered);
	return { usd: usdOf(tokens + unmetered * averageTokens(days)), estimated: unmetered > 0 };
}

// What Jev cost since the start of the month, from the tokens TypeSafe gave only: its monthly cap is checked against
// it. A call without its tokens failed, and is not billed: estimating it at the average cut Jev off days too early.
export function spentThisMonth(days: Readonly<Days>, now: number): number {
	const month = dayOf(now).slice(0, 7);
	return Object.entries(days)
		.filter(([day]) => day.startsWith(month))
		.reduce((sum, [, counted]) => sum + usdOf(counted.tokens), 0);
}

export type UsageDay = { day: string; calls: number; tokens: number; usd: number; estimated: boolean };
// `monthlyUsd`: null without a cap.
export type UsageReport = { days: UsageDay[]; month: { usd: number; monthlyUsd: number | null } };

// The last `count` days, the oldest first, today included; and the month's spending against its cap.
export function usageReport(days: Readonly<Days>, now: number, count: number, monthlyUsd: number | null): UsageReport {
	const listed = Array.from({ length: count }, (_, i) => daysAgo(now, count - 1 - i)).map((day) => ({
		day,
		calls: days[day]?.calls ?? 0,
		tokens: days[day]?.tokens ?? 0,
		...dayCost(days, day),
	}));
	return { days: listed, month: { usd: spentThisMonth(days, now), monthlyUsd } };
}
