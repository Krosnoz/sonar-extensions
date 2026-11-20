// The statistics of every project, drawn as parts of Sonar's statistics' screen, at its three places: at its top, where
// the user's time and the money go, project by project, and how the user works; in its accounts' block, what the
// agents' work costs; at its bottom, whether Sonar holds its agents. One reading (/global) feeds the three: while it
// reads, each place's skeleton (`aria-busy`), its titles over lines and tiles; a reading that fails says why at the top,
// with a way to read again. Sonar's own blocks follow both states.

import type { PartSlot } from "@sonar/extension";
import type { GlobalStats } from "../shapes";
import { compared, type Week } from "./figures";
import { kit } from "./kit";
import { figures } from "./measures";
import { modeHead, storedMode } from "./mode";
import { projectsTable, waitingProjects } from "./projects-table";
import { plainTile, waitingTile } from "./tile";
import { figureTile, question, waitingQuestion } from "./tiles";

type Place = "top" | "accounts" | "bottom";
type Drawn = Record<Place, HTMLElement[]>;

export const reasonOf = (error: unknown): string => (error instanceof Error ? error.message : String(error));

function parts(view: GlobalStats, redraw: () => void): Drawn {
	const { texts } = kit();
	const all = figures();
	const { now, before } = compared(view.weeks, view.sonarSince, storedMode());
	const tile = (figure: Parameters<typeof figureTile>[0]) => figureTile(figure, view.weeks, now, before);
	const starts = new Set(now.map((week) => week.start));
	const nowOf = (weeks: readonly Week[]) => weeks.filter((week) => starts.has(week.start));
	const levels = view.projects.flatMap((line) => (line.level === null ? [] : [line.level]));
	return {
		top: [
			modeHead(redraw),
			projectsTable(view.projects, nowOf),
			question(texts.howYouWork, [tile(all.myTime), tile(all.leverage), tile(all.parallel), tile(all.reply)]),
		],
		accounts: [tile(all.cost).node, tile(all.costPerPr).node],
		bottom: [
			question(texts.sonarHolds, [
				tile(all.firstPass),
				tile(all.tasksFailed),
				{
					node: plainTile(texts.trusted, levels.length ? texts.trustedOf(levels.filter((level) => level === 3).length, levels.length) : "—", texts.trustedHint),
					tone: "",
				},
				tile(all.strays),
			]),
		],
	};
}

// The screen being read: its head, then each block's title over its skeleton; two tiles' in the accounts' block.
const waiting = (redraw: () => void): Drawn => ({
	top: [modeHead(redraw), waitingProjects(), waitingQuestion(kit().texts.howYouWork)],
	accounts: [waitingTile(), waitingTile()],
	bottom: [waitingQuestion(kit().texts.sonarHolds)],
});

export function globalStatsParts(): PartSlot[] {
	const nodes: Partial<Record<Place, HTMLElement>> = {};
	let view: GlobalStats | null = null;
	// Why the statistics could not be read: kept, so that a later drawing does not put the skeleton over it.
	let failure: string | null = null;
	const draw = () => {
		const drawn = view
			? parts(view, draw)
			: failure === null
				? waiting(draw)
				: { top: [kit().ui.failure(failure, () => void read())], accounts: [], bottom: [] };
		for (const place of ["top", "accounts", "bottom"] as const) nodes[place]?.replaceChildren(...drawn[place]);
	};
	const read = async () => {
		failure = null;
		draw();
		try {
			view = (await kit().api.http.get("/global")) as unknown as GlobalStats;
		} catch (error) {
			failure = reasonOf(error);
		}
		draw();
	};
	// Each place drawn as it is mounted; the top reads each time the screen shows, from nothing: the parts outlive the
	// settings, and the figures of the opening before would hide a reading that fails.
	const enter = () => {
		view = null;
		void read();
	};
	const part = (place: Place): PartSlot => ({
		screen: "statistics",
		place,
		mount: (node) => {
			nodes[place] = node;
			draw();
			return place === "top" ? { enter } : undefined;
		},
	});
	return [part("top"), part("accounts"), part("bottom")];
}
