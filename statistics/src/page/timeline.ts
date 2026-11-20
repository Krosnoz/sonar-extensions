// A project's sessions over the last 7 days, each on a strip: the agent works, it waits for the user, and the moments
// the user wrote to it. While Sonar does not measure the user's activity, a strip has no such moment (`touches` null):
// the legend says they are not measured.

import type { StatsTask } from "../shapes";
import { kit } from "./kit";
import { emptyCard } from "./look";

// A part of the strip, placed in percent of the session's span.
const placed = (node: HTMLElement, from: number, to: number, task: StatsTask) => {
	const span = Math.max(1, task.to - task.from);
	node.style.left = `${((from - task.from) / span) * 100}%`;
	node.style.width = `${((to - from) / span) * 100}%`;
	return node;
};

const lineOf = (task: StatsTask) => {
	const { texts, format } = kit();
	return texts.taskLine(format.duration(task.humanMs), format.duration(task.agentMs), format.duration(task.waitedMs));
};

function strip(task: StatsTask): HTMLElement {
	const { ui } = kit();
	const node = ui.el("div", "stats-strip");
	node.setAttribute("role", "img");
	node.setAttribute("aria-label", lineOf(task));
	for (const segment of task.segments) node.append(placed(ui.el("i", segment.kind), segment.from, segment.to, task));
	for (const at of task.touches ?? []) {
		const touch = ui.el("b");
		touch.style.left = `${((at - task.from) / Math.max(1, task.to - task.from)) * 100}%`;
		node.append(touch);
	}
	return node;
}

function line(task: StatsTask): HTMLElement {
	const { ui } = kit();
	const head = ui.el("div", "stats-task-head");
	const name = ui.el("strong", "", task.name);
	ui.tip(name, task.name);
	head.append(name, ui.el("span", "u-hint", lineOf(task)));
	const node = ui.el("div", "stats-task");
	node.append(head, strip(task));
	return node;
}

// The sessions, or what stands for them: being read, or why they could not be.
export type Tasks = readonly StatsTask[] | "reading" | { readonly failed: string };

// The strips being read: the skeleton's lines, a name and a strip each.
const WAITING = 3;
function waitingLines(): HTMLElement {
	const { ui } = kit();
	const lines = ui.el("div", "skeleton");
	for (let at = 0; at < WAITING; at += 1) {
		const bones = ui.el("div", "stats-task");
		bones.append(ui.el("i"), ui.el("i"));
		lines.append(bones);
	}
	return lines;
}

// `again`: reads the sessions again, after a reading that failed.
export function timelines(tasks: Tasks, again: () => void): HTMLElement {
	const { ui, texts } = kit();
	if (tasks === "reading" || "failed" in tasks) {
		const waiting = ui.el("section", "u-section stats-tasks");
		waiting.append(ui.el("h3", "", texts.tasks), tasks === "reading" ? waitingLines() : ui.failure(tasks.failed, again));
		if (tasks === "reading") waiting.setAttribute("aria-busy", "true");
		return waiting;
	}
	const unmeasured = tasks.some((task) => task.touches === null);
	const legend = ui.el("div", "stats-legend u-hint");
	for (const [kind, label] of [
		["work", texts.works],
		["wait", texts.waits],
		["touch", unmeasured ? texts.touchesUnmeasured : texts.touches],
	] as const) {
		const item = ui.el("span");
		item.append(ui.el("i", kind), label);
		legend.append(item);
	}
	const node = ui.el("section", "u-section stats-tasks");
	node.append(
		ui.el("h3", "", texts.tasks),
		...(tasks.length ? [legend, ...tasks.map(line)] : [emptyCard(texts.noTasksTitle, texts.noTasks)]),
	);
	return node;
}
