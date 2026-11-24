// The page's edge as the town comes (./edge.ts): one edge for the whole page, which follows the front in tongues.

import { expect, test } from "bun:test";
import { SOONEST, edgeOf } from "./edge";

const boxOf = (left: number, top: number, width: number, height: number): DOMRect =>
	({ left, top, width, height, right: left + width, bottom: top + height }) as DOMRect;
// The front that builds the town crosses the screen from left to right, 300 pixels a second.
const reach = (x: number): number => x / 300;
const SCREEN = boxOf(0, 0, 1440, 900);

test("town: the page leaves as the front comes, in tongues, and answers the click at once", () => {
	const edge = edgeOf(SCREEN, reach);
	const gaps: number[] = [];
	let first = Infinity;
	for (let y = 1; y < 900; y += 37)
		for (let x = 1; x < 1440; x += 37) {
			const leaves = edge(x, y);
			first = Math.min(first, leaves);
			if (reach(x) > 1.5) gaps.push(leaves - reach(x));
		}
	// No wait before the first point leaves: a plate's cracks and its lift held the page 0.9 s (17/11).
	expect(first).toBe(SOONEST);
	expect(SOONEST).toBeLessThan(0.2);
	// A tongue is 230 pixels deep at most, about 0.4 s each way at this pace; a straight edge would show no gap at all.
	expect(Math.max(...gaps.map(Math.abs))).toBeLessThan(0.5);
	expect(Math.max(...gaps) - Math.min(...gaps)).toBeGreaterThan(0.2);
});
