// The figures both screens show, from the weeks (./figures.ts): what each counts, how it reads, which way is good. Made
// once, in the page's language, the first time a screen draws.

import type { Figure, Week } from "./figures";
import { type Kit, kit } from "./kit";

const pair = (part: number | null, whole: number | null): readonly [number, number] | null => (part === null || whole === null ? null : [part, whole]);

function figuresOf({ texts, format }: Kit) {
	const decimal = (value: number) => format.one.format(value);
	const share = (value: number) => format.percent.format(value);
	const dollars = (value: number) => format.money.format(value);
	const hours = (value: number) => (value < 48 ? texts.inHours(decimal(value)) : texts.inDays(decimal(value / 24)));
	const seconds = (value: number) =>
		value < 90 ? texts.inSeconds(decimal(value)) : value < 5400 ? texts.inMinutes(decimal(value / 60)) : texts.inHours(decimal(value / 3600));
	const { duration } = format;
	return {
		prs: { kind: "sum", label: texts.prs, hint: texts.prsHint, format: decimal, better: 1, pick: (week: Week) => week.prs },
		lead: { kind: "mean", label: texts.lead, hint: texts.leadHint, format: hours, better: -1, pick: (week: Week) => week.leadHours },
		commits: { kind: "sum", label: texts.commits, hint: texts.commitsHint, format: decimal, better: 1, pick: (week: Week) => week.commits },
		closed: { kind: "sum", label: texts.closed, hint: texts.closedHint, format: decimal, better: 1, pick: (week: Week) => week.closed },
		firstPass: {
			kind: "ratio",
			label: texts.firstPass,
			hint: texts.firstPassHint,
			format: share,
			better: 1,
			points: true,
			pick: (week: Week) => (week.landed ? pair(week.firstPass, week.landed) : null),
		},
		sentBack: {
			kind: "ratio",
			label: texts.sentBack,
			hint: texts.sentBackHint,
			format: share,
			better: -1,
			points: true,
			pick: (week: Week) => (week.ends ? pair(week.sentBack, week.ends) : null),
		},
		cost: { kind: "sum", label: texts.cost, hint: texts.costHint, format: dollars, better: 0, pick: (week: Week) => week.cost },
		costPerPr: {
			kind: "ratio",
			label: texts.costPerPr,
			hint: "",
			format: dollars,
			better: -1,
			pick: (week: Week) => (week.prs ? pair(week.cost, week.prs) : null),
		},
		costPerClosed: {
			kind: "ratio",
			label: texts.costPerClosed,
			hint: "",
			format: dollars,
			better: -1,
			pick: (week: Week) => (week.closed ? pair(week.cost, week.closed) : null),
		},
		myTime: { kind: "sum", label: texts.myTimeTile, hint: texts.myTimeHint, format: duration, better: -1, pick: (week: Week) => week.humanMs },
		agentTime: { kind: "sum", label: texts.agentTime, hint: texts.agentTimeHint, format: duration, better: 1, pick: (week: Week) => week.agentMs },
		perSession: {
			kind: "ratio",
			label: texts.myTimePerSession,
			hint: texts.perSessionHint,
			format: duration,
			better: -1,
			pick: (week: Week) => (week.sessions && week.humanMs !== null ? pair(week.humanMs, week.sessions) : null),
		},
		// null while Sonar does not measure the user's activity: the tile says it is not measured.
		waited: { kind: "sum", label: texts.waited, hint: texts.waitedHint, format: duration, better: -1, pick: (week: Week) => week.waitedMs },
		leverage: {
			kind: "ratio",
			label: texts.leverage,
			hint: texts.leverageHint,
			format: (value: number) => texts.leverageValue(decimal(value)),
			better: 1,
			pick: (week: Week) => (week.humanMs ? pair(week.agentMs, week.humanMs) : null),
		},
		parallel: { kind: "mean", label: texts.parallel, hint: texts.parallelHint, format: decimal, better: 1, pick: (week: Week) => week.parallel },
		reply: { kind: "mean", label: texts.reply, hint: texts.replyHint, format: seconds, better: -1, pick: (week: Week) => week.reply },
		tasksFailed: {
			kind: "ratio",
			label: texts.tasksFailed,
			hint: texts.tasksFailedHint,
			format: share,
			better: -1,
			points: true,
			pick: (week: Week) => (week.tasksEnded ? pair(week.tasksFailed, week.tasksEnded) : null),
		},
		strays: { kind: "sum", label: texts.strays, hint: texts.straysHint, format: decimal, better: -1, pick: (week: Week) => week.strays },
	} satisfies Record<string, Figure>;
}

let made: ReturnType<typeof figuresOf> | null = null;
export const figures = () => (made ??= figuresOf(kit()));

// A project's share of every project's cost, week by week (`all`: every project's cost, aligned on the weeks).
export function shareOf(weeks: readonly Week[], all: readonly number[]): Figure {
	const { texts, format } = kit();
	return {
		kind: "ratio",
		label: texts.share,
		hint: texts.shareHint,
		format: (value) => format.percent.format(value),
		better: 0,
		points: true,
		pick: (week) => {
			const whole = all[weeks.indexOf(week)] ?? 0;
			return whole > 0 ? [week.cost, whole] : null;
		},
	};
}
