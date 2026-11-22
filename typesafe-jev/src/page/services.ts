// Jev's part of Services, under its TypeSafe key in the group Sonar draws for it, as Sonar's plugin's: its switch
// (./switch-row.ts), then its usage over the period chosen (./usage-view.ts), read again while the part shows
// (./usage-reading.ts). Sonar draws the part again once the key is given or changed: it reads the key's state anew.

import type { PageApi, PartSlot } from "@sonar/extension";
import type { Kit } from "./kit";
import type { SettingsHub } from "./settings";
import { switchRow } from "./switch-row";
import { usageReading } from "./usage-reading";
import { usageFigures, usageView } from "./usage-view";

export function servicesPart(api: PageApi, kit: Kit, settings: SettingsHub): PartSlot {
	const reading = usageReading(api, kit, usageFigures(api.ui, kit));
	return {
		screen: "services",
		place: "section",
		mount: (node) => {
			const part = api.ui.el("div", "jev-part");
			node.append(part);
			// The switch shown, while the screen shows: Jev off by itself moves it (../page.ts).
			let row: HTMLElement | null = null;
			settings.hear((jev) => {
				if (!row) return;
				const next = switchRow(api, kit, part, jev);
				row.replaceWith(next);
				row = next;
			});
			const again = reading.again(part);
			return {
				enter: () => {
					void api.ui.load(
						part,
						() => Promise.all([settings.read(), reading.read()]),
						([jev, report]) => {
							row = switchRow(api, kit, part, jev);
							return [row, usageView(api.ui, kit, reading, report)];
						},
					);
					again.start();
				},
				leave: () => {
					row = null;
					again.stop();
				},
			};
		},
	};
}
