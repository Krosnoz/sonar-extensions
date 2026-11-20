// The weeks the statistics compare (./figures.ts), chosen once for both screens and kept in this browser.

import type { Mode } from "./figures";
import { kit } from "./kit";

const KEY = "mode";
// Where Sonar's own statistics kept the choice: taken once (./page.ts), so that the user keeps it.
const SONAR_KEY = "sonar:stats-mode";

const isMode = (value: string | null): value is Mode => value === "week" || value === "four" || value === "sonar";

export function storedMode(): Mode {
	const kept = kit().api.storage.read(KEY);
	return isMode(kept) ? kept : "four";
}

// The choice Sonar's own statistics kept, while the extension keeps none. The browser may refuse its storage: then
// nothing is taken.
export function takeSonarMode(): void {
	const { storage } = kit().api;
	if (storage.read(KEY) !== null) return;
	let kept: string | null = null;
	try {
		kept = localStorage.getItem(SONAR_KEY);
	} catch {
		return;
	}
	if (isMode(kept)) storage.write(KEY, kept);
}

// The head of both screens: the switch, then what its choice compares, in a few words. Choosing draws the screen again.
export function modeHead(redraw: () => void): HTMLElement {
	const { ui, texts, api } = kit();
	const bar = ui.segmented(
		texts.modes.map((mode) => ({ id: mode.key, label: mode.label })),
		storedMode(),
		(id) => {
			api.storage.write(KEY, id);
			redraw();
		},
	);
	bar.classList.add("stats-modes");
	const head = ui.el("div", "stats-head");
	head.append(bar, ui.el("span", "u-note", texts.modeNote[storedMode()]));
	return head;
}
