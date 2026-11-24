// The bar of a pull request merged while the town is open stays on its subject's sign while its storey is laid
// (./landing.ts). Before, it left with the merge: the crane worked for a pull request the sign no longer said.

import { expect, test } from "bun:test";
import type { Topic } from "./kit";
import { landing } from "./landing";
import type { Stage, Wanted } from "./live-steps";
import type { Pull } from "./pulls";

const pull = (number: number): Pull => ({ url: `pr-${number}`, number, tone: "tone-wait", red: false, done: 4, total: 6 });
// A subject with the pull request 412 open on its sign, and its session as the fleet says it: `open` its open pull
// requests, `merged` the addresses of its merged ones.
function subject(moves = true) {
	const topic: Topic = { name: "Voice", agents: [], working: 1, waiting: 0, reviewing: 0, pulls: [pull(412)] };
	let pending = false;
	const bars = landing([topic], () => pending);
	const stage = { moves: () => moves } as Stage;
	const told = (open: Pull[], merged: string[], now = false): void => {
		// The town's life sets the subject's open pull requests first (./live.ts#pulled).
		topic.pulls = open;
		const wanted: Wanted[] = [{ handle: "s-1", topic: "Voice", state: 1, name: "Agent", children: [], pulls: open, merged }];
		bars.follow(wanted, stage, now);
	};
	return { topic, bars, told, lays: (on: boolean): void => void (pending = on) };
}

test("landing: a pull request merged keeps its bar, full, until its storey is laid", () => {
	const { topic, bars, told, lays } = subject();
	told([pull(412)], []);
	bars.tick(1);
	expect(topic.landing ?? []).toEqual([]);
	// Its session says it merged: it leaves the open ones, and its bar stays, full, in the tone of a merged one.
	told([], ["pr-412"]);
	expect(topic.landing).toEqual([{ ...pull(412), tone: "tone-done", done: 6 }]);
	expect(bars.revision()).toBe(1);
	// Its merge is counted a moment later, and its storey is laid for 20 s: the bar stays.
	bars.tick(2);
	lays(true);
	for (let second = 3; second < 24; second++) bars.tick(second);
	expect(topic.landing).toHaveLength(1);
	// Laid: the bar goes, and the sign says it.
	lays(false);
	bars.tick(24);
	expect(topic.landing).toEqual([]);
	expect(bars.revision()).toBe(2);
});

test("landing: a merged pull request whose merge is not counted keeps its bar 3 s, not more", () => {
	const { topic, bars, told } = subject();
	told([], ["pr-412"]);
	bars.tick(10);
	bars.tick(12.9);
	expect(topic.landing).toHaveLength(1);
	bars.tick(13.1);
	expect(topic.landing).toEqual([]);
});

test("landing: no bar for a pull request closed without a merge, nor for one merged before the town opened", () => {
	const closed = subject();
	closed.told([], []);
	expect(closed.topic.landing ?? []).toEqual([]);
	const before = subject();
	before.told([pull(412)], ["pr-300"]);
	expect(before.topic.landing ?? []).toEqual([]);
	expect(before.bars.revision()).toBe(0);
});

test("landing: with motion reduced, or for what changed while the town was not looked at, the bar goes at once", () => {
	const reduced = subject(false);
	reduced.told([], ["pr-412"]);
	expect(reduced.topic.landing ?? []).toEqual([]);
	const late = subject();
	late.told([], ["pr-412"], true);
	expect(late.topic.landing ?? []).toEqual([]);
});

test("landing: two merges in a row keep both bars until the last storey is laid", () => {
	const { topic, bars, told, lays } = subject();
	told([pull(412), pull(415)], []);
	told([pull(415)], ["pr-412"]);
	lays(true);
	bars.tick(1);
	told([], ["pr-412", "pr-415"]);
	bars.tick(2);
	expect((topic.landing ?? []).map((each) => each.number)).toEqual([412, 415]);
	lays(false);
	bars.tick(30);
	expect(topic.landing).toEqual([]);
});
