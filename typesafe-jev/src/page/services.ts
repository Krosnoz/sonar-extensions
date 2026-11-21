// Jev's part of Services, under its TypeSafe key in the group Sonar draws for it, as Sonar's plugin's (its jev/switch.ts
// and usage/jev.ts): its switch, acting at once, then its usage over the period chosen (today, 7 or 30 days): what its
// judgments cost, and per day over 7 or 30 days. Without the key, both are greyed and the switch shows off, held, its tip
// saying why: Jev is not called, and the setting saved comes back with the key. Sonar draws the part again once the key
// is given or changed: it reads the key's state anew.

import type { PageApi, PartSlot } from "@sonar/extension";
import type { UsageReport } from "../cost";
import { chartOf } from "./chart";
import { figuresOf } from "./figures";
import type { Kit } from "./kit";
import type { JevView, SettingsHub } from "./settings";

const PERIODS = ["1", "7", "30"] as const;
type Period = (typeof PERIODS)[number];
// The period shown, kept in this browser: 7 days unless another was chosen.
const PERIOD = "period";

export function servicesPart(api: PageApi, kit: Kit, settings: SettingsHub): PartSlot {
	const { ui, http, storage } = api;
	const period = (): Period => {
		const kept = storage.read(PERIOD);
		return kept === "1" || kept === "30" ? kept : "7";
	};
	const readUsage = async () => (await http.get("/usage", { days: period() })) as UsageReport;

	// The tile of what it cost, the chart by day when a day shows a cost, then the price.
	const figures = (report: UsageReport): HTMLElement[] => {
		const shown = figuresOf(report, kit);
		const tile = ui.el("div", "u-tile wide");
		tile.append(ui.el("span", "u-label", kit.texts.cost), ui.el("strong", "u-value", shown.value), ui.el("span", "u-hint", shown.hint));
		// The seed of Sonar's plugin: the same cloud in its corner.
		ui.cloud(tile, `figure:${kit.texts.cost}`);
		const tiles = ui.el("div", "u-tiles");
		tiles.append(tile);
		return [tiles, ...(shown.chart ? [chartOf(ui, shown.chart)] : []), ui.el("p", "u-note", kit.texts.price)];
	};

	const usage = (report: UsageReport): HTMLElement => {
		const place = ui.el("div", "jev-figures");
		place.append(...figures(report));
		const choose = (id: string) => {
			storage.write(PERIOD, id);
			void ui.load(place, readUsage, figures);
		};
		const block = ui.el("div", "jev-usage");
		block.append(ui.segmented(PERIODS.map((id) => ({ id, label: kit.texts.periods[id] })), period(), choose), place);
		return block;
	};

	return {
		screen: "services",
		place: "section",
		mount: (node) => {
			const part = ui.el("div", "jev-part");
			node.append(part);
			// The switch shown, while the screen shows: Jev off by itself moves it (../page.ts).
			let row: HTMLElement | null = null;
			const switchRow = (jev: JevView): HTMLElement => {
				const keyed = jev.key !== null;
				part.classList.toggle("no-key", !keyed);
				// A refusal says Sonar's own words ("Settings not saved."), as the plugin's switch.
				const change = (on: boolean) => http.post("/settings", { on }).catch(() => Promise.reject(new Error("")));
				return ui.toggle(kit.texts.jevOn, keyed && jev.on, change, keyed ? {} : { hint: kit.texts.jevNeedsKey, disabled: true });
			};
			settings.hear((jev) => {
				if (!row) return;
				const next = switchRow(jev);
				row.replaceWith(next);
				row = next;
			});
			return {
				enter: () =>
					void ui.load(
						part,
						() => Promise.all([settings.read(), readUsage()]),
						([jev, report]) => {
							row = switchRow(jev);
							return [row, usage(report)];
						},
					),
				leave: () => {
					row = null;
				},
			};
		},
	};
}
