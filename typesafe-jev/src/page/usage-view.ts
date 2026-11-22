// What Jev's part of Services (./services.ts) draws of its usage, as Sonar's plugin's (its usage/jev.ts): the period's
// choice, then the tile of what it cost, the chart by day when a day shows a cost, and the price.

import type { PageUi } from "@sonar/extension";
import type { UsageReport } from "../cost";
import { chartOf } from "./chart";
import { figuresOf } from "./figures";
import type { Kit } from "./kit";
import { PERIODS, type UsageReading } from "./usage-reading";

export const usageFigures =
	(ui: PageUi, kit: Kit) =>
	(report: UsageReport): HTMLElement[] => {
		const shown = figuresOf(report, kit);
		const tile = ui.el("div", "u-tile wide");
		tile.append(ui.el("span", "u-label", kit.texts.cost), ui.el("strong", "u-value", shown.value), ui.el("span", "u-hint", shown.hint));
		// The seed of Sonar's plugin: the same cloud in its corner.
		ui.cloud(tile, `figure:${kit.texts.cost}`);
		const tiles = ui.el("div", "u-tiles");
		tiles.append(tile);
		return [tiles, ...(shown.chart ? [chartOf(ui, shown.chart)] : []), ui.el("p", "u-note", kit.texts.price)];
	};

// The period's choice over the figures of `report`; a period chosen reads its days.
export function usageView(ui: PageUi, kit: Kit, reading: UsageReading, report: UsageReport): HTMLElement {
	const place = ui.el("div", "jev-figures");
	place.append(...reading.drawIn(place, report));
	const choose = (id: string) => {
		reading.choose(id);
		void ui.load(place, reading.read, (next) => reading.drawIn(place, next));
	};
	const block = ui.el("div", "jev-usage");
	block.append(ui.segmented(PERIODS.map((id) => ({ id, label: kit.texts.periods[id] })), reading.period(), choose), place);
	return block;
}
