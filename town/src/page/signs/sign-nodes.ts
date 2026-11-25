// The elements laid over the town (./signs.ts): a subject's sign (its button with its pictogram, its count and its label,
// its line and its anchor's dot), and a figure's name. Names are the user's and the agents' own words: written as text,
// never as markup.
import { el } from "../sonar/dom";
import type { Topic, World } from "../render/kit";
import { keyOf } from "../sonar/pulls";
import { sprite } from "./sprites";
import { worldTexts as texts } from "../sonar/texts";

const STATE_CLASS = ["tone-neutral", "tone-work", "tone-wait", "tone-done"];
// The most bars a sign's gauge shows; past them, a count.
const BARS = 5;

const kindOf = (topic: Topic): [string, number] | null =>
	topic.waiting ? ["wait", topic.waiting] : topic.reviewing ? ["done", topic.reviewing] : topic.working ? ["work", topic.working] : null;

// What a subject's sign says: its pictogram, its count and its label, as its counts are now. Written again when they
// change while the town is open (../people/live.ts).
function said(node: HTMLElement, pixel: number, topic: Topic) {
	const kind = kindOf(topic);
	// Small: from afar the pictogram is the whole sign.
	const icon = kind ? sprite(kind[0], Math.max(2, pixel)) : null;
	node.replaceChildren();
	if (icon) node.append(icon);
	// Its count, written as the label's text, where the label's counts do not show (world.css). A count of one shows only
	// beside the name alone: the sign that dropped its counts for room kept no number of them ("1 to review").
	if (kind) {
		const count = el("span", "world-count", String(kind[1]));
		count.dataset["kind"] = kind[0];
		if (kind[1] === 1) count.dataset["one"] = "";
		node.append(count);
	}
	const label = el("span", "world-label");
	label.append(el("strong", "", topic.name));
	if (topic.working) label.append(el("span", "", texts.working(topic.working)));
	if (topic.waiting) label.append(el("b", "", texts.waiting(topic.waiting)));
	if (topic.reviewing) label.append(el("em", "", texts.reviewing(topic.reviewing)));
	node.append(label);
	// Those just merged come first, while their storey is laid (../sites/landing.ts).
	const landing = topic.landing ?? [];
	const pulls = [...landing, ...(topic.pulls ?? [])];
	// Its open pull requests: a bar each, filled as its checks end, in the tone the map gives its mark.
	if (pulls.length) {
		const gauge = el("span", "world-pulls");
		for (const pull of pulls.slice(0, BARS)) {
			const bar = el("i", pull.tone);
			bar.style.setProperty("--done", String(pull.total ? pull.done / pull.total : 0));
			gauge.append(bar);
		}
		if (pulls.length > BARS) gauge.append(el("small", "", `+${pulls.length - BARS}`));
		node.append(gauge);
	}
	// Its name for a screen reader, at every level: the label's parts would read glued ("agents3 au travail"), and far
	// out only the sprite shows.
	const read = pulls.map((pull, at) =>
		at < landing.length ? texts.pullMerged(pull.number) : pull.red ? texts.pullFails(pull.number) : texts.pull(pull.number, pull.done, pull.total),
	);
	node.setAttribute("aria-label", [topic.name, ...[...label.children].slice(1).map((part) => part.textContent), ...read].join(", "));
	return { priority: topic.waiting * 100 + topic.reviewing * 10 + topic.working, kind, urgent: topic.waiting > 0, counts: countsOf(topic) };
}
// Its name too, and whether it is still to come: a subject that comes while the town is open takes its name then, and
// its sign shows once its building is built (../sites/plot.ts).
const countsOf = (topic: Topic): string =>
	`${topic.name}\n${topic.held ? 1 : 0}\n${topic.working} ${topic.waiting} ${topic.reviewing}\n${keyOf(topic.landing ?? [])}\n\n${keyOf(topic.pulls ?? [])}`;

// A subject's sign, laid in `layer`. `pick`: a touch on a sign.
export function signOf(layer: HTMLElement, pixel: number, pick: (index: number) => void, { topic, index }: World["anchors"][number]) {
	const node = el("button", "world-sign");
	node.type = "button";
	const says = said(node, pixel, topic);
	// The line that joins a sign off its roof to the roof: its own element, as the sign moves by whole steps of its size.
	const lead = el("i", "world-lead");
	// Its anchor on the roof, at the line's end.
	const dot = el("i", "world-dot");
	// The whole name, when the label cut it.
	node.title = topic.name;
	node.addEventListener("click", () => pick(index));
	// The sign of a subject to come joins the page once its building is built (../sites/plot.ts): nothing of it is there before.
	if (!topic.held) layer.append(lead, dot, node);
	// `spot`: the place it holds, an index of SPOTS; `since`: when its own place (the first) became free, while it is not there;
	// `look`: its form (whole, short, pictogram); `shown`: whether it shows; `at`: where it stands (../camera/steady.ts).
	// `place`: the spot it shows at, which `spot` leaves first when its own place frees. `anchor`: its roof's point it
	// stands over; `under`: what its height is read from (./sign-motion.ts#lift), `slip` how far it still glides to it.
	const state = {
		spot: 0,
		since: 0,
		place: 0,
		look: "",
		shown: false,
		at: [null, null] as [number | null, number | null],
		anchor: -1,
		under: -1,
		slip: 0,
		height: 0,
	};
	const mark = { node, lead, dot, index, ...says, state };
	// Says its subject's counts as they are now; false when they have not changed.
	const again = (): boolean => {
		if (countsOf(topic) === mark.counts) return false;
		node.title = topic.name;
		if (!topic.held && !node.isConnected) layer.append(lead, dot, node);
		Object.assign(mark, said(node, pixel, topic));
		return true;
	};
	return Object.assign(mark, { again });
}

// A figure's name, laid in `layer`, hidden and out of the page's layout until it first shows (./name-places.ts).
// `agent`: whose name and state it says.
export function nameOf(layer: HTMLElement, figure: World["figures"][number]) {
	const node = el("span", "world-name world-off world-unplaced");
	const name = { node, figure, agent: figure.agent, shown: false, cut: false, at: [null, null] as [number | null, number | null] };
	const says = (): void => {
		name.agent = figure.agent;
		node.replaceChildren(el("i", `ui-dot ${STATE_CLASS[figure.agent.state] ?? "tone-neutral"}`), el("span", "", figure.agent.name));
		node.title = figure.agent.name;
		// Whose name it is: its card hides it while it says the name itself (../people/notebook.ts).
		node.dataset["handle"] = figure.agent.handle ?? "";
	};
	says();
	layer.append(node);
	// Says its figure's agent as it is now; false when it has not changed.
	const again = (): boolean => {
		if (name.agent === figure.agent) return false;
		says();
		return true;
	};
	return Object.assign(name, { again });
}
