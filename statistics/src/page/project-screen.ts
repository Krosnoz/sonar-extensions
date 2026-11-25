// A project's statistics, drawn whole in the screen Sonar keeps in each project's settings: does it go faster, do its
// agents work well, what it costs, how much of the user's time it takes; then its sessions on a strip. Read each time
// the screen shows (/project, then /tasks): its skeleton meanwhile, and a reading that fails says why, with a way to
// read again.

import type { PartSlot } from "@sonar/extension";
import type { ProjectStats, StatsTask } from "../shared/shapes";
import { compared } from "./figures";
import { reasonOf } from "./global-screen";
import { kit } from "./kit";
import { figures, shareOf } from "./measures";
import { modeHead, storedMode } from "./mode";
import { plainTile } from "./tile";
import { figureTile, question, waitingQuestion } from "./tiles";
import { type Tasks, timelines } from "./timeline";

// The trust read with the statistics: its level, its proofs, its verification.
function trustTiles(view: ProjectStats) {
	const { texts } = kit();
	const trust = view.trust;
	if (!trust)
		return [
			{ node: plainTile(texts.trust, "—", texts.noTrust), tone: "" as const },
			{ node: plainTile(texts.verification, "—", texts.noTrust), tone: "" as const },
		];
	const proofs = Object.values(trust.proofs).filter(Boolean).length;
	const { working, points } = trust.measures.verification;
	return [
		{ node: plainTile(texts.trust, texts.trustLevel[trust.level], texts.proofs(proofs)), tone: "" as const },
		{ node: plainTile(texts.verification, points ? texts.of(working, points) : "—", texts.verificationHint), tone: "" as const },
	];
}

function parts(project: string, view: ProjectStats, tasks: Tasks, redraw: () => void, readTasks: () => void): HTMLElement[] {
	const { texts, api } = kit();
	const all = figures();
	const { now, before } = compared(view.weeks, view.sonarSince, storedMode());
	const tile = (figure: Parameters<typeof figureTile>[0]) => figureTile(figure, view.weeks, now, before);
	return [
		modeHead(redraw),
		question(texts.faster, [tile(all.prs), tile(all.lead), tile(all.commits), tile(all.closed)]),
		question(texts.agentsWell, [...trustTiles(view), tile(all.firstPass), tile(all.sentBack)], {
			label: texts.seeTrust,
			go: () => api.open({ core: "trust", project }),
		}),
		question(texts.projectCost, [tile(all.cost), tile(all.costPerPr), tile(all.costPerClosed), tile(shareOf(view.weeks, view.allCost))]),
		question(texts.myTime, [tile(all.myTime), tile(all.agentTime), tile(all.perSession), tile(all.waited)]),
		timelines(tasks, readTasks),
	];
}

// The screen being read: its head, then each question's title over its skeleton.
function waiting(redraw: () => void): HTMLElement[] {
	const { texts } = kit();
	return [modeHead(redraw), ...[texts.faster, texts.agentsWell, texts.projectCost, texts.myTime].map((title) => waitingQuestion(title))];
}

function projectStatsPane(name: string): { node: HTMLElement; enter: () => void } {
	const { ui, api } = kit();
	const box = ui.el("div", "u-screen stats-screen");
	let view: ProjectStats | null = null;
	let tasks: Tasks = "reading";
	// The strips come after the figures: the transcripts may take seconds to read.
	const readTasks = async () => {
		try {
			tasks = (await api.http.get("/tasks", { project: name })) as unknown as StatsTask[];
		} catch (error) {
			if (tasks === "reading" || "failed" in tasks) tasks = { failed: reasonOf(error) };
		}
		draw();
	};
	const again = () => {
		tasks = "reading";
		draw();
		void readTasks();
	};
	// Why the figures could not be read: kept, so that the sessions arriving after do not draw the skeleton over it.
	let failure: string | null = null;
	const draw = () => {
		if (view) box.replaceChildren(...parts(name, view, tasks, draw, again));
		else if (failure === null) box.replaceChildren(...waiting(draw));
		else box.replaceChildren(ui.failure(failure, () => void read()));
	};
	const read = async () => {
		failure = null;
		draw();
		try {
			view = (await api.http.get("/project", { project: name })) as unknown as ProjectStats;
		} catch (error) {
			failure = reasonOf(error);
		}
		draw();
	};
	return {
		node: box,
		// From nothing each time: the pane outlives the settings, and what was read before would hide a reading that fails.
		enter: () => {
			view = null;
			tasks = "reading";
			void read();
			void readTasks();
		},
	};
}

// The whole screen, drawn in Sonar's project's statistics, once per project.
export const projectStatsPart: PartSlot = {
	screen: "project-statistics",
	place: "main",
	mount: (node, { project }) => {
		const pane = projectStatsPane(project ?? "");
		node.append(pane.node);
		return { enter: pane.enter };
	},
};
