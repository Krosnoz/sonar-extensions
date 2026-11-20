// A tile of the statistics: its label, its value with its gap, and what it counts as its tip. Drawn as Sonar's page
// draws its own (its usage/tile.ts), with its classes, so that the extension's tiles sit beside the core's in one grid.

import { kit } from "./kit";

// A tile's frame: its label, its value with its gap, and what it counts as its tip. `missing`: why it has no value.
export function tileFrame(label: string, value: string, tip: string, gap: HTMLElement | null, missing: string): HTMLElement {
	const { ui } = kit();
	const node = ui.el("div", "u-tile stats-tile");
	const figure = ui.el("span", "stats-figure");
	figure.append(ui.el("strong", "u-value", value), ...(gap ? [gap] : []));
	node.append(ui.el("span", "u-label", label), figure, ...(missing ? [ui.el("span", "u-hint", missing)] : []));
	if (tip) {
		// A role, so that a screen reader reads the label the tip gives it.
		node.setAttribute("role", "group");
		ui.tip(node, tip, `${label} : ${value}`);
	}
	return node;
}

// A tile being read: the skeleton's lines (Sonar's class), a label, a value and the bars.
export function waitingTile(): HTMLElement {
	const { ui } = kit();
	const tile = ui.el("div", "u-tile stats-tile");
	const lines = ui.el("span", "skeleton");
	lines.append(ui.el("i"), ui.el("i"), ui.el("i"));
	tile.append(lines);
	return tile;
}

// A tile: its label and value, nothing compared (a level, a count). Without bars, it has Ping's cloud in its corner, as
// any figure.
export function plainTile(label: string, value: string, hint: string): HTMLElement {
	const missing = value === "—";
	const node = tileFrame(label, value, missing ? "" : hint, null, missing ? hint : "");
	kit().ui.cloud(node, `figure:${label}`);
	return node;
}
