// The points of a group's ring of points (./mark-cloud.ts): their number says each state's share, and every state
// present keeps one (./mark-share.ts).
import { expect, test } from "bun:test";
import { pointsOf } from "./mark-share";

const sum = (list: { points: number }[]): number => list.reduce((total, each) => total + each.points, 0);

test("the points of a ring always add up to the ring's points, in the states' order", () => {
	const shares = pointsOf([10, 30, 40, 20], 100, 22);
	expect(sum(shares)).toBe(22);
	// Most urgent first: waiting (2), to review (3), at work (1), idle (0).
	expect(shares.map((each) => each.state)).toEqual([2, 3, 1, 0]);
	expect(shares[0]!.points).toBeGreaterThan(shares[3]!.points);
});

test("a state with one agent among a thousand keeps a point", () => {
	const shares = pointsOf([0, 999, 1, 0], 1000, 24);
	expect(sum(shares)).toBe(24);
	expect(shares.find((each) => each.state === 2)!.points).toBe(1);
});
