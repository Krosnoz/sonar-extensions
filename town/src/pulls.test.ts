// What the town keeps of the pull requests of a subject's sessions (./pulls.ts): the open ones, each once, with the
// share of its checks that ended and the tone the map gives it. The Map says them (MapPull of @sonar/extension): its
// checks that ended, counted.
import type { MapPull } from "@sonar/extension";
import { expect, test } from "bun:test";
import { joined, keyOf, seenOf } from "./pulls";

const seen = (number: number, given: Partial<MapPull> = {}): MapPull => ({
	number,
	url: `https://example.test/pull/${number}`,
	state: "open",
	ci: "pending",
	done: 0,
	total: 0,
	...given,
});

test("an open pull request says how many of its checks ended, in the map's tone", () => {
	const [pull] = seenOf([seen(412, { done: 3, total: 6 })]);
	expect(pull).toEqual({ url: "https://example.test/pull/412", number: 412, tone: "tone-wait", red: false, done: 3, total: 6 });
});

test("a check that fails turns it red", () => {
	const [pull] = seenOf([seen(412, { ci: "failed", done: 2, total: 3 })]);
	expect(pull).toMatchObject({ tone: "tone-urgent", red: true, done: 2, total: 3 });
});

test("all its checks passed: green and full; without a check: no share", () => {
	expect(seenOf([seen(1, { ci: "passed", done: 2, total: 2 })])[0]).toMatchObject({ tone: "tone-done", red: false, done: 2, total: 2 });
	expect(seenOf([seen(2, { ci: "none" })])[0]).toMatchObject({ tone: "tone-neutral", red: false, done: 0, total: 0 });
});

test("a pull request merged or closed is not kept: only an open one stands a scaffold", () => {
	expect(seenOf([seen(1, { state: "merged" }), seen(2, { state: "closed" }), seen(3)]).map((pull) => pull.number)).toEqual([3]);
});

test("two sessions of one branch show the same pull request once, the subject's in the order of their numbers", () => {
	const [first, second] = [seenOf([seen(9), seen(4)]), seenOf([seen(4, { ci: "failed" }), seen(7)])];
	expect(joined([first, second]).map((pull) => [pull.number, pull.red])).toEqual([
		[4, true],
		[7, false],
		[9, false],
	]);
});

test("the key changes with anything the sign shows of them, and with nothing else", () => {
	const before = seenOf([seen(4, { done: 1, total: 2 })]);
	expect(keyOf(seenOf([seen(4, { done: 1, total: 2 })]))).toBe(keyOf(before));
	expect(keyOf(seenOf([seen(4, { done: 2, total: 2 })]))).not.toBe(keyOf(before));
	expect(keyOf(seenOf([seen(4, { ci: "failed", done: 1, total: 2 })]))).not.toBe(keyOf(before));
	expect(keyOf([])).not.toBe(keyOf(before));
});
