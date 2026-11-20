// The few parts of Sonar's look its contract does not give (PageUi), drawn with Sonar's own classes as its page draws
// them: a fold with its class (ui/fold.ts), an empty card (ui/empty.ts) and the chevron of a line that opens
// (ui/icons.ts).

import { kit } from "./kit";

export const CHEVRON =
	'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 5l7 7-7 7"/></svg>';

// A line that opens what is under it, with a chevron that turns (Sonar's .ui-fold). `className` only places it.
export function fold(className: string, label: string, ...nodes: readonly HTMLElement[]): HTMLElement {
	const { ui } = kit();
	const node = ui.el("details", `ui-fold ${className}`);
	const summary = ui.el("summary");
	summary.innerHTML = CHEVRON;
	summary.append(label);
	node.append(summary, ...nodes);
	return node;
}

// What is missing, and what will show here and when: a card without an edge.
export function emptyCard(title: string, body: string): HTMLElement {
	const { ui } = kit();
	const node = ui.el("div", "empty-card");
	node.append(ui.el("strong", "", title), ui.el("p", "", body));
	return node;
}
