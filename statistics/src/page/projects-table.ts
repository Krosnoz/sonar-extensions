// Every project on a line, in the statistics of every project: its part of the user's time, its PRs, its cost, the
// user's time on it and its trust. A line opens the project's own statistics, a screen Sonar keeps.

import type { GlobalStats } from "../shared/shapes";
import { valueOf, type Week } from "./figures";
import { kit } from "./kit";
import { CHEVRON, emptyCard, fold } from "./look";
import { figures } from "./measures";

type Line = GlobalStats["projects"][number];

// The user's time on a project over the weeks compared; before it was measured, the messages written stand for it.
const timeOf = (weeks: readonly Week[]) => valueOf(figures().myTime, weeks);
const messagesOf = (weeks: readonly Week[]) => weeks.reduce((sum, week) => sum + week.interventions, 0);

// The lines shown before "show all".
const SHOWN = 8;
// The lines of the skeleton, while the statistics are read.
const WAITING = 6;

type Row = { line: Line; weeks: Week[]; time: number | null; cost: number };

// A project's line: `share`, its part of the user's time (or of the messages), from 0 to 1.
function lineOf(row: Row, share: number): HTMLElement {
	const { ui, api, texts, format } = kit();
	const line = ui.el("button", "stats-project") as HTMLButtonElement;
	line.type = "button";
	line.addEventListener("click", () => api.open({ core: "project-statistics", project: row.line.project }));
	const bar = ui.el("span", "stats-share");
	const fill = ui.el("i");
	fill.style.setProperty("--v", String(share));
	bar.append(fill);
	const level = row.line.level;
	const name = ui.el("strong");
	name.append(ui.el("span", "", row.line.project));
	name.insertAdjacentHTML("beforeend", CHEVRON);
	line.append(
		name,
		bar,
		ui.el("span", "", format.whole.format(valueOf(figures().prs, row.weeks) ?? 0)),
		ui.el("span", "", format.money.format(row.cost)),
		ui.el("span", "stats-mine", row.time === null ? "—" : format.duration(row.time)),
		ui.el("span", level === 3 ? "good" : level === 2 ? "bad" : "", level === null ? "—" : texts.trustLevel[level]),
	);
	return line;
}

function headOf(): HTMLElement {
	const { ui, texts } = kit();
	const head = ui.el("div", "stats-project head");
	for (const label of [texts.project, texts.timeShare, texts.prsShort, texts.costShort, texts.myTimeShort, texts.trustShort])
		head.append(ui.el("span", "u-label", label));
	return head;
}

export function projectsTable(lines: readonly Line[], now: (weeks: readonly Week[]) => Week[]): HTMLElement {
	const { ui, texts } = kit();
	const rows = lines.map((line) => {
		const weeks = now(line.weeks);
		return { line, weeks, time: timeOf(weeks), messages: messagesOf(weeks), cost: valueOf(figures().cost, weeks) ?? 0 };
	});
	const measured = rows.some((row) => row.time !== null);
	const shareOf = (row: (typeof rows)[number]) => (measured ? (row.time ?? 0) : row.messages);
	const total = rows.reduce((sum, row) => sum + shareOf(row), 0);
	rows.sort((a, b) => shareOf(b) - shareOf(a) || b.cost - a.cost);
	const table = ui.el("div", "stats-projects");
	table.append(headOf(), ...rows.slice(0, SHOWN).map((row) => lineOf(row, total > 0 ? shareOf(row) / total : 0)));
	// The projects past the first ones, often a few cents in a folder of trials, folded.
	const rest = rows.slice(SHOWN);
	if (rest.length) table.append(fold("stats-more", texts.moreProjects(rest.length), ...rest.map((row) => lineOf(row, total > 0 ? shareOf(row) / total : 0))));
	const node = ui.el("section", "u-section stats-block");
	node.append(ui.el("h3", "", texts.whereGoes), rows.length ? table : emptyCard(texts.noProjectTitle, texts.noProject));
	return node;
}

// The table being read: its title and its columns, then its lines as the skeleton's, a line of dots in each column.
export function waitingProjects(): HTMLElement {
	const { ui, texts } = kit();
	const table = ui.el("div", "stats-projects");
	const head = headOf();
	const lines = ui.el("div", "skeleton");
	for (let at = 0; at < WAITING; at += 1) {
		const line = ui.el("div", "stats-project");
		line.append(...Array.from(head.children, () => ui.el("i")));
		lines.append(line);
	}
	table.append(head, lines);
	const node = ui.el("section", "u-section stats-block");
	node.append(ui.el("h3", "", texts.whereGoes), table);
	node.setAttribute("aria-busy", "true");
	return node;
}
