// What an inhabitant's card says of its session (./notebook.ts), with what Sonar says of it (PageApi's `session`): the
// line of its state, its marks, what happened to it lately, drawn by Sonar. Nothing is made up: every line is the
// session's as the page holds it.
import type { PageSession } from "@sonar/extension";
import { el, iconButton } from "../sonar/dom";
import { arrive } from "../sonar/motion";
import { worldTexts as texts } from "../sonar/texts";

// How many lines of its past a notebook shows.
const PAST = 3;

// A session as its card says it: its name as the town holds it, and what Sonar says of it.
export type Said = { handle: string; name: string; session: PageSession };

// What the card says now changes with this, not at each frame: its seconds run by themselves.
export const keyOf = ({ name, session }: Said): string => `${name}\n${session.key}`;

// Its notebook's past changes with this.
export const pastKeyOf = ({ session }: Said): string => `${session.events.length} ${session.events.at(-1)?.at}`;

// What follows its name: its state and since when, what it asks or last said, its pull requests and ticket.
function lines({ session }: Said): HTMLElement[] {
	const marks = session.marks();
	return [session.state(), ...(session.says ? [el("p", "world-card-say", session.says)] : []), ...(marks ? [marks] : [])];
}

// What the card says now of a session, under its name. `shut`: its notebook's cross, while it is pinned.
export function nowOf(said: Said, shut: HTMLElement | null): HTMLElement {
	const now = el("div", "world-card-now");
	const head = el("div", "world-card-head");
	head.append(el("strong", "", said.name));
	if (shut) head.append(shut);
	now.append(head, ...lines(said));
	return now;
}

// The same card says what its session became. Its head stays the node it is: a press or the keyboard may be on its
// cross, and a cross made again would lose them.
export function renew(now: Element, said: Said): void {
	const head = now.firstElementChild;
	const name = head?.querySelector("strong");
	if (name) name.textContent = said.name;
	for (const line of [...now.children].slice(1)) line.remove();
	now.append(...lines(said));
}

// The last things that happened to it, the latest first. One of another day says its day.
export function pastOf({ session }: Said): HTMLElement {
	const past = el("ol", "world-card-past");
	for (const event of session.events.slice(-PAST).toReversed()) {
		const line = el("li");
		line.append(el("time", "", event.when), el("span", "", event.text));
		past.append(line);
	}
	if (!past.childElementCount) past.append(el("li", "world-card-none", texts.noteNone));
	return past;
}

// Its notebook: its past and the way to its session (`open`). Its lines come one after the other (../sonar/motion.ts#arrive).
export function moreOf(said: Said, open: () => void): HTMLElement {
	const more = el("div", "world-card-more");
	const past = pastOf(said);
	const button = el("button", "pill small world-card-open", texts.noteOpen);
	button.type = "button";
	button.addEventListener("click", open);
	more.append(past, button);
	for (const [order, node] of [...past.children, button].entries()) if (node instanceof HTMLElement) arrive(node, order + 1);
	return more;
}

// The cross of a pinned notebook.
export function shutOf(close: () => void): HTMLElement {
	const shut = iconButton("close", texts.noteClose, "icon sm ghost world-card-close");
	shut.addEventListener("click", close);
	return shut;
}
