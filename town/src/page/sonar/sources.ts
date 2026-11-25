// What the map shows of the agents, as the Map gives its cards (PageMap of @sonar/extension): the town is built from
// this and nothing else.
import type { MapSession, PageMap } from "@sonar/extension";
import type { Agent, Topic } from "../render/kit";
import type { Wanted } from "../people/live-steps";
import { joined, seenOf, type Pull } from "./pulls";

// A card of the Map: its session, its node, and the block of its subject.
export type Card = ReturnType<PageMap["cards"]>[number];

const ACTS: Record<string, number> = { read: 1, edit: 2, shell: 3 };
// What an agent in `state` holds (../people/tools.ts): 1 a book, 2 a hammer, 3 a console, 0 its crate, or nothing when it is
// not at work. A session at rest still says the tool of its last turn. What its tool does is its agent's word for it.
const actOf = (state: number, tool: MapSession["tool"]): number => (state === 1 && tool ? (ACTS[tool.kind ?? ""] ?? 0) : 0);
// Waiting, working, finished to review, at rest.
const stateOf = (state: MapSession["state"]): number => (state === "wait" ? 2 : state === "work" ? 1 : state === "done" ? 3 : 0);

// `children`: the agent's subagents as the Map lists them, 1 for one at work: the town shows those, and no other.
// `pulls`: its open pull requests (./pulls.ts). `merges`: its subject's merges, as its session says them. `act`: what
// its last tool has it hold. `island`: the block of its subject on the Map.
export type Source = {
	handle: string;
	element: HTMLElement;
	island: HTMLElement | undefined;
	topic: string;
	state: number;
	name: string;
	children: number[];
	pulls: Pull[];
	merges: number;
	act: number;
};

// The map: a card per agent, in the island of its subject, as the Map says it.
export const readMap = (cards: readonly Card[]): Source[] =>
	cards.map(({ session, node, island }) => {
		const state = stateOf(session.state);
		return {
			handle: session.handle,
			element: node,
			island,
			topic: session.topic,
			state,
			name: session.name,
			children: session.tasks.map((working) => (working ? 1 : 0)),
			pulls: seenOf(session.pulls),
			merges: session.merges,
			act: actOf(state, session.tool),
		};
	});

// The same agents as the map would draw them now, while the town covers it (PageMap's `cover`): the town follows them
// (../people/live.ts). The Map says them as its cards say them: a difference between the two would show as a change no agent
// made.
export const wantedOf = (sessions: readonly MapSession[]): Wanted[] =>
	sessions.map((session) => {
		const state = stateOf(session.state);
		return {
			handle: session.handle,
			topic: session.topic,
			state,
			name: session.name,
			children: session.tasks.map((working) => (working ? 1 : 0)),
			pulls: seenOf(session.pulls),
			merges: session.merges,
			merged: session.pulls.filter((pr) => pr.state === "merged").map((pr) => pr.url),
			unfiled: session.unfiled,
			act: actOf(state, session.tool),
		};
	});

// A zone of the map, and the subject it holds.
export type Zone = { element: HTMLElement; topic: string };

// The top left of the first of a subject's cards, in the page's reading order.
const first = (list: Source[]): DOMRect =>
	list.map((each) => each.element.getBoundingClientRect()).reduce((a, b) => (b.top < a.top - 40 || (Math.abs(b.top - a.top) <= 40 && b.left < a.left) ? b : a));

// The subjects in the order the page shows them, top to bottom then left to right: the town keeps the page's order.
export function fleetOf(sources: Source[]): Topic[] {
	const groups = new Map<string, Source[]>();
	for (const source of sources) groups.set(source.topic, [...(groups.get(source.topic) ?? []), source]);
	const ordered = [...groups.entries()].toSorted(([, a], [, b]) => {
		const [ra, rb] = [first(a), first(b)];
		return Math.abs(ra.top - rb.top) > 80 ? ra.top - rb.top : ra.left - rb.left;
	});
	let seed = 7;
	const random = (): number => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;
	return ordered.map(([name, list]) => {
		const agents: Agent[] = list.map((source) => ({
			name: source.name,
			state: source.state,
			seed: random(),
			children: source.children,
			handle: source.handle,
			act: source.act,
		}));
		return {
			name,
			agents,
			working: agents.filter((a) => a.state === 1).length,
			waiting: agents.filter((a) => a.state === 2).length,
			reviewing: agents.filter((a) => a.state === 3).length,
			pulls: joined(list.map((source) => source.pulls)),
			// The same on each session of this PC; a linked computer's says what its own Sonar counted.
			merges: Math.max(...list.map((source) => source.merges)),
		};
	});
}
