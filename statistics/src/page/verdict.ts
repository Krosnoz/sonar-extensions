// A block's head: its title, then its verdict from the gaps of its tiles (./tile.ts): how many got worse, whether one
// got better, whether any was compared at all. Drawn as Sonar's page draws its own (its usage/verdict.ts).

import { kit } from "./kit";

export type Marks = { readonly bad: number; readonly good: boolean; readonly compared: boolean };

export function verdictHead(title: string, { bad, good, compared }: Marks): HTMLElement {
	const { ui, texts } = kit();
	const verdict = bad ? texts.worse(bad) : good ? texts.allGood : compared ? texts.still : texts.nothingToCompare;
	const head = ui.el("div", "stats-question");
	head.append(ui.el("h3", "", title), ui.el("span", `stats-verdict ${bad ? "bad" : good ? "good" : ""}`, verdict));
	return head;
}
