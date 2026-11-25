// The weeks of the statistics: the velocity's counts (PRs, commits, sessions in parallel, reply delay), the agents' work
// (./work.ts) and the measures Sonar keeps (./measured.ts), each aligned on the velocity's Mondays.

import type { VelocityWeek } from "@sonar/extension";
import type { Measured, Series } from "./measured";
import type { StatsWeek } from "../shared/shapes";
import { noWork, type Work } from "./work";

// A velocity week in the units of the statistics: hours of lead time, seconds of reply.
export type CountedWeek = {
	readonly start: string;
	readonly prs: number;
	readonly leadHours: number | null;
	readonly commits: number;
	readonly parallel: number | null;
	readonly reply: number | null;
};

const HOUR_MS = 3_600_000;
const SECOND_MS = 1000;

// The contract gives `prs` null for PRs GitHub did not give (no repository, no key, GitHub failed): Sonar's own
// statistics count them 0, and so do these. Its durations are in milliseconds.
export const countedOf = (weeks: readonly VelocityWeek[]): CountedWeek[] =>
	weeks.map(({ start, prs, leadMs, commits, parallel, replyMs }) => ({
		start,
		prs: prs ?? 0,
		leadHours: leadMs === null ? null : leadMs / HOUR_MS,
		commits,
		parallel,
		reply: replyMs === null ? null : replyMs / SECOND_MS,
	}));

const of = (series: Series | undefined, at: number) => series?.[at] ?? null;

// The weeks, from the velocity's (null: before its first computation, no PRs nor commits counted yet).
export function statsWeeks(starts: readonly string[], counted: readonly CountedWeek[] | null, work: readonly Work[], measured: Measured): StatsWeek[] {
	return starts.map((start, at) => {
		const velocity = counted?.find((week) => week.start === start);
		return {
			start,
			prs: velocity?.prs ?? 0,
			leadHours: velocity?.leadHours ?? null,
			commits: velocity?.commits ?? 0,
			parallel: velocity?.parallel ?? null,
			reply: velocity?.reply ?? null,
			...(work[at] ?? noWork()),
			humanMs: of(measured.humanMs, at),
			closed: of(measured.closed, at),
			landed: of(measured.landed, at),
			firstPass: of(measured.firstPass, at),
			tasksEnded: of(measured.tasksEnded, at),
			tasksFailed: of(measured.tasksFailed, at),
			strays: of(measured.strays, at),
		};
	});
}
