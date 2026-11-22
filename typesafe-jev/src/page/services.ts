// Jev's part of Services, under its TypeSafe key in the group Sonar draws for it, as Sonar's plugin's (its jev/switch.ts
// and usage/jev.ts): its switch, acting at once, then its usage over the period chosen (today, 7 or 30 days): what its
// judgments cost, and per day over 7 or 30 days. Without the key, both are greyed and the switch shows off, held, its tip
// saying why: Jev is not called, and the setting saved comes back with the key. Sonar draws the part again once the key
// is given or changed: it reads the key's state anew.
//
// While the part shows, its usage is read again every 10 s, as the plugin's is drawn again at each usage Sonar sends,
// and at once when Jev switches itself off: the cost changes in place, without the dots of a first reading. A step of
// its own rather than a message of the server at each judgment: nothing is sent while no page shows the part, and it
// stops once the part left, or once its node left the screen (its extension cut, without a leave). It waits while the
// page is hidden, and reads at once when it shows again; a step reads nothing while the group is folded.

import type { PageApi, PartSlot } from "@sonar/extension";
import type { UsageReport } from "../cost";
import { chartOf } from "./chart";
import { figuresOf } from "./figures";
import type { Kit } from "./kit";
import { stopText } from "./live";
import { newest } from "./newest";
import type { JevView, SettingsHub } from "./settings";

const PERIODS = ["1", "7", "30"] as const;
type Period = (typeof PERIODS)[number];
// The period shown, kept in this browser: 7 days unless another was chosen.
const PERIOD = "period";
const REREAD_MS = 10_000;

export function servicesPart(api: PageApi, kit: Kit, settings: SettingsHub): PartSlot {
	const { ui, http, storage } = api;
	const period = (): Period => {
		const kept = storage.read(PERIOD);
		return kept === "1" || kept === "30" ? kept : "7";
	};
	// The newest reading's answer: a period left quickly does not draw under the one chosen.
	const readUsage = newest(async () => (await http.get("/usage", { days: period() })) as UsageReport);

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

	// The figures shown, while the part shows, and the report they draw: one that did not change is not drawn again, so
	// that the bar being read keeps its reading.
	let shown: { readonly place: HTMLElement; drawn: string } | null = null;
	const drawFigures = (place: HTMLElement, report: UsageReport): HTMLElement[] => {
		shown = { place, drawn: JSON.stringify(report) };
		return figures(report);
	};

	const usage = (report: UsageReport): HTMLElement => {
		const place = ui.el("div", "jev-figures");
		place.append(...drawFigures(place, report));
		const choose = (id: string) => {
			storage.write(PERIOD, id);
			void ui.load(place, readUsage, (next) => drawFigures(place, next));
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

			// From enter to leave; the steps go on while the first reading is still on its way.
			let entered = false;
			let timer: ReturnType<typeof setTimeout> | undefined;
			const pause = () => {
				clearTimeout(timer);
				timer = undefined;
			};
			// The page hidden (another tab, the phone's screen off), no step waits; shown again, a reading at once.
			const pageShown = () => globalThis.document?.visibilityState !== "hidden";
			// Its own node not drawn: its group folded, or the settings closed. The contract does not tell a part its
			// group's fold; the browser says whether the part's own node is drawn, without a look at the core's.
			const drawn = () => typeof part.checkVisibility !== "function" || part.checkVisibility();
			const stop = () => {
				entered = false;
				pause();
				shown = null;
				globalThis.document?.removeEventListener("visibilitychange", onVisibility);
			};
			// Read again in place; a failure keeps what shows, and the next step tries again.
			const reread = async () => {
				if (!entered) return;
				if (!part.isConnected) return stop();
				if (!shown || !drawn()) return;
				const report = await readUsage().catch(() => null);
				const now = shown;
				if (!report || !now || !now.place.isConnected || JSON.stringify(report) === now.drawn) return;
				now.place.replaceChildren(...drawFigures(now.place, report));
			};
			const step = () => {
				pause();
				if (!pageShown()) return;
				timer = setTimeout(() => {
					void reread().then(() => entered && step());
				}, REREAD_MS);
			};
			function onVisibility() {
				if (!pageShown()) return pause();
				void reread();
				step();
			}
			api.live.on((data) => {
				if (stopText(data, kit.texts) !== null) void reread();
			});
			return {
				enter: () => {
					entered = true;
					globalThis.document?.addEventListener("visibilitychange", onVisibility);
					void ui.load(
						part,
						() => Promise.all([settings.read(), readUsage()]),
						([jev, report]) => {
							row = switchRow(jev);
							return [row, usage(report)];
						},
					);
					step();
				},
				leave: () => {
					row = null;
					stop();
				},
			};
		},
	};
}
