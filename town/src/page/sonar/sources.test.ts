// What the town reads of the Map's cards, as the Map gives them (PageMap of @sonar/extension): the town opened on the
// Map (readMap) and the town that follows it (wantedOf) say the same of each session. No browser: a card's node is a
// small stand-in that answers where it stands.

import { expect, test } from "bun:test";
import type { MapPull, MapSession } from "@sonar/extension";
import { type Card, fleetOf, readMap, wantedOf } from "./sources";

const standing = (top = 0, left = 0) => ({ getBoundingClientRect: () => ({ top, left }) }) as unknown as HTMLElement;

const session = (handle: string, given: Partial<MapSession> = {}): MapSession => ({
	handle,
	name: `Name of ${handle}`,
	topic: "Subject",
	unfiled: false,
	state: "rest",
	tasks: [],
	pulls: [],
	merges: 0,
	tool: null,
	...given,
});
const card = (each: MapSession, node = standing()): Card => ({ session: each, node });
const pull = (number: number, state: MapPull["state"]): MapPull => ({
	url: `https://example.test/pull/${number}`,
	number,
	state,
	ci: "pending",
	done: 0,
	total: 0,
});

test("sources: a card's open pull requests are its session's", () => {
	const sessions = [session("a", { pulls: [pull(412, "open"), pull(400, "merged")] }), session("m-2/a", { pulls: [pull(7, "open")] }), session("b")];
	expect(readMap(sessions.map((each) => card(each))).map((each) => each.pulls.map((seen) => seen.number))).toEqual([[412], [7], []]);
});

test("sources: the town opened on the map and the town that follows it say the same pull requests", () => {
	const said = session("a", { state: "work", pulls: [pull(412, "open"), pull(9, "closed")] });
	const [source] = readMap([card(said)]);
	const [wanted] = wantedOf([said]);
	expect(wanted?.pulls).toEqual(source!.pulls);
	expect(fleetOf([source!])[0]?.pulls).toEqual(source!.pulls);
});

// The Map says a subject's merges on each of its sessions. A session of a linked computer says what its own Sonar
// counted, and one of an older Sonar says none: the subject keeps the most said.
test("sources: a subject's merges are the most its sessions say, none when no session says any", () => {
	const sessions = [session("a", { merges: 12 }), session("b", { merges: 12 }), session("m-2/a")];
	const sources = readMap(sessions.map((each) => card(each)));
	expect(sources.map((each) => each.merges)).toEqual([12, 12, 0]);
	expect(fleetOf(sources)[0]?.merges).toBe(12);
	expect(fleetOf(readMap([card(session("c"))]))[0]?.merges).toBe(0);
	// The town that follows the map says the same merges as the town opened on it.
	expect(wantedOf([sessions[0]!, sessions[2]!]).map((each) => each.merges)).toEqual([12, 0]);
});

// The town holds the block of a session not filed yet for the subject it is then filed under (../sites/plot.ts).
test("sources: a session the page has not filed yet is said unfiled", () => {
	expect(wantedOf([session("s0", { unfiled: true }), session("s1")]).map((each) => each.unfiled)).toEqual([true, false]);
});

// What one at work holds (../people/tools.ts): 1 a book, 2 a hammer, 3 a console, 0 its crate.
test("sources: an agent at work says what its last tool does; one that does not work, or with a tool of no kind, says nothing", () => {
	const kinds: (string | null)[] = ["read", "read", "edit", "shell", null, "question"];
	const tools = kinds.map((kind, index) => ({ name: `Tool${index}`, kind }));
	const sessions = [...tools, null].map((tool, index) => session(`s${index}`, { state: "work", tool }));
	// The last one is at rest, with the tool of its last turn.
	sessions.push(session("rest", { tool: tools[2]! }));
	const expected = [1, 1, 2, 3, 0, 0, 0, 0];
	expect(wantedOf(sessions).map((each) => each.act)).toEqual(expected);
	// The town opened on the map says the same as the town that follows it.
	const sources = readMap(sessions.map((each) => card(each)));
	expect(sources.map((each) => each.act)).toEqual(expected);
	expect(fleetOf(sources)[0]?.agents.map((agent) => agent.act)).toEqual(expected);
});

test("sources: a session's subagents are those the Map lists, 1 for one at work", () => {
	const said = session("m-2/a", { state: "work", tasks: [true, false, false, true, false] });
	const [source] = readMap([card(said)]);
	expect([source?.children, source?.state]).toEqual([[1, 0, 0, 1, 0], 1]);
	expect(wantedOf([said])[0]?.children).toEqual([1, 0, 0, 1, 0]);
	expect(readMap([card(session("b"))])[0]?.children).toEqual([]);
});
