// The agents' work of each week, from the usage Sonar reads in its agents' files (usage.days): every project's
// (`whole`) and each project's (`of`), in one pass over the lines. A session counts for its project; a session without
// a folder counts only for the whole. The pass gives the server back its loop every 7 days of lines, as Sonar's own
// statistics do.

import type { UsageLine } from "@sonar/extension";
import { nextTurn, weekOf } from "./calendar";
import type { StatsWeek } from "./shapes";

export type Work = { -readonly [K in "cost" | "sessions" | "interventions" | "agentMs" | "waitedMs" | "ends" | "sentBack"]: StatsWeek[K] };

// `measured`: the reply delays are measured (the contract gives them null while the user does not want their activity
// measured): a week without them is not measured, rather than a wait of zero.
export const noWork = (measured = true): Work => ({ cost: 0, sessions: 0, interventions: 0, agentMs: 0, waitedMs: measured ? 0 : null, ends: 0, sentBack: 0 });

type Counting = { readonly weeks: Work[]; readonly seen: Set<string>[] };
const counting = (starts: readonly string[], measured: boolean): Counting => ({
	weeks: starts.map(() => noWork(measured)),
	seen: starts.map(() => new Set<string>()),
});

function sessionsCounted({ weeks, seen }: Counting): Work[] {
	for (const [at, week] of weeks.entries()) week.sessions = seen[at]?.size ?? 0;
	return weeks;
}

// A session's day added to week `at` of each count.
function countedIn(counts: readonly Counting[], at: number, line: UsageLine): void {
	for (const { weeks, seen } of counts) {
		const week = weeks[at];
		if (!week) continue;
		week.cost += line.cost;
		week.interventions += line.messages;
		week.agentMs += line.activeMs;
		week.ends += line.ends;
		week.sentBack += line.sentBack;
		if (week.waitedMs !== null) week.waitedMs += (line.repliesMs ?? []).reduce((sum, ms) => sum + ms, 0);
		if (line.cost > 0 || line.messages > 0) seen[at]?.add(line.sessionId);
	}
}

const DAYS_AT_ONCE = 7;

export async function workWeeksOf(lines: readonly UsageLine[], starts: readonly string[]) {
	const measured = lines.every((line) => line.repliesMs !== null);
	const whole = counting(starts, measured);
	const projects = new Map<string, Counting>();
	const projectCount = (project: string): Counting => {
		const made = projects.get(project) ?? counting(starts, measured);
		projects.set(project, made);
		return made;
	};
	let day = "";
	let days = 0;
	for (const line of lines) {
		const at = weekOf(starts, line.day);
		if (at < 0) continue;
		if (line.day !== day) {
			if (days > 0 && days % DAYS_AT_ONCE === 0) await nextTurn();
			[day, days] = [line.day, days + 1];
		}
		countedIn(line.project === null ? [whole] : [whole, projectCount(line.project)], at, line);
	}
	const weeks = new Map([...projects].map(([name, each]) => [name, sessionsCounted(each)]));
	return { whole: sessionsCounted(whole), of: (project: string): Work[] => weeks.get(project) ?? starts.map(() => noWork(measured)) };
}
