// When the cells of a sheet leave the page as the town comes, and how they fly (./flights.ts).

import { expect, test } from "bun:test";
import type { Cell } from "./cells";
import { TEXT, edgeOf } from "./edge";

await import("../test-page");
const { timed, lookOf } = await import("./flights");

// The front that builds the town crosses the screen from left to right, 300 pixels a second.
const edge = edgeOf({ left: 0, top: 0, width: 1440, height: 900, right: 1440, bottom: 900 } as DOMRect, (x) => x / 300);

test("town: a cell leaves as the page's edge reaches it, a text just after", () => {
	const cells: Cell[] = [150, 450, 900].map((x, at) => ({ x, y: 300, colour: [0, 0, 0], text: at === 1, t0: 0, flies: true }));
	timed(cells, edge);
	// A card, a zone and the ground leave as one sheet, at the same instant: a card that left after the page round it
	// read as a card kept whole (18/11).
	expect(cells.map((cell) => cell.t0)).toEqual(cells.map((cell) => edge(cell.x, cell.y) + (cell.text ? TEXT : 0)));
});

test("town: what builds flies as a brick, several times the dust's size, and what lands on the ground as dust", () => {
	const [dot, unit] = [0.02, 0.01];
	// A card's cell, 9 pixels a side, that lands on its building.
	const brick = lookOf(9, true, dot, unit);
	// A zone's cell, 3 pixels a side, that lands on the ground of its block.
	const dust = lookOf(3, false, dot, unit);
	expect(dust).toEqual({ brick: false, from: dot, to: dot });
	expect(brick.brick).toBe(true);
	// Two dissolves the eye tells apart: a brick leaves three times a point's size or more, and lands smaller, never
	// under a point.
	expect(brick.from).toBeGreaterThanOrEqual(dot * 3);
	expect(brick.to).toBeLessThan(brick.from);
	expect(brick.to).toBeGreaterThanOrEqual(dot);
	// A brick is smaller than its cell: a gap shows between two bricks, which read as bricks and not as the card.
	expect(brick.from).toBeLessThan(9 * unit);
});
