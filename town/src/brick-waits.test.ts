// A subject's block waits for the cubes of its cards (./brick-waits.ts): no cube lands on a place laid before it.

import { expect, test } from "bun:test";
import type { Cell } from "./cells";
import type { Mounted } from "./kit";
import type { Place } from "./places";

await import("./test-page");
const { SHORTEST, laid, waits } = await import("./brick-waits");
const { delays } = await import("./delays");
const { pace } = await import("./pace");

// The front starts this long after the cubes' clock (./flights.ts#HOLD).
const HOLD = 1.4;
// A town 100 metres deep, the front along x; a subject's building in the block at x 33.
const HOUSE = { at: [30.9, -3.3] as [number, number] };

function town(): Mounted {
	const world = { range: [0, 100], base: -1, top: 20 };
	const time = pace(world as unknown as Mounted["world"], (x) => x);
	return { world, band: time.band, when: time.when, frontAt: time.front, delays: delays() } as unknown as Mounted;
}
const cell = (t0: number): Cell => ({ x: 0, y: 0, colour: [0, 0, 0], text: false, t0, flies: true });
// The bricks of the building, bottom-up, and the points of its ground, as the front lays them.
function places(mounted: Mounted): { bricks: Place[]; points: Place[] } {
	const origin: [number, number, number] = [HOUSE.at[0], 0, HOUSE.at[1]];
	const brick = (y: number): Place => ({
		at: [origin[0], y, origin[2]],
		origin,
		size: 0.2,
		t1: mounted.when([origin[0], y, origin[2]], origin),
		colour: "#fff",
	});
	const point = (x: number): Place => ({ at: [x, 0.12, 0], origin: [x, 0.12, 0], size: 0.1, t1: mounted.when([x, 0.12, 0]), colour: "#fff" });
	return { bricks: Array.from({ length: 12 }, (_, at) => brick(0.3 + at * 0.5)), points: Array.from({ length: 10 }, (_, at) => point(28.5 + at)) };
}
// Each place with a cell: the first to leave on the first laid, the cells leaving from `from` to `to`.
const dealt = (list: Place[], from: number, to: number) => list.map((place, at) => ({ cell: cell(from + ((to - from) * at) / (list.length - 1)), place }));
// How late a cube is: over 0, its place is laid before it can land there.
const late = (mounted: Mounted, pairs: { cell: Cell; place: Place }[], house?: typeof HOUSE): number =>
	Math.max(...pairs.map(({ cell, place }) => cell.t0 + SHORTEST - (laid(mounted, place, house) + HOLD)));

test("town: a block whose cards leave after the front has passed it waits for its cubes", () => {
	const mounted = town();
	const { bricks, points } = places(mounted);
	// The cards stand right of the block on the page: they leave a second after the front has laid it.
	const [walls, ground] = [dealt(bricks, 4.2, 5.2), dealt(points, 4, 5.4)];
	// Without a wait, the building and its ground stand before their cubes: the defect seen on 18/11.
	expect(late(mounted, walls, HOUSE)).toBeGreaterThan(0.5);
	expect(late(mounted, ground)).toBeGreaterThan(0.5);
	waits(mounted, HOUSE, walls, ground, HOLD);
	expect(late(mounted, walls, HOUSE)).toBeLessThanOrEqual(1e-9);
	expect(late(mounted, ground)).toBeLessThanOrEqual(1e-9);
	// The ground is laid as its last point lands, not later.
	expect(late(mounted, ground)).toBeGreaterThan(-0.05);
	// The building rises once its ground is there, bottom-up.
	const [foot, roof] = [laid(mounted, bricks[0]!, HOUSE), laid(mounted, bricks.at(-1)!, HOUSE)];
	expect(mounted.delays.read(...HOUSE.at, 0)).toBeGreaterThanOrEqual(mounted.delays.ground(...HOUSE.at));
	expect(roof).toBeGreaterThan(foot + 0.3);
});

test("town: a block whose cards left early does not wait, and a town opened again forgets its wait", () => {
	const mounted = town();
	const { bricks, points } = places(mounted);
	waits(mounted, HOUSE, dealt(bricks, 4.2, 5.2), dealt(points, 4, 5.4), HOLD);
	expect(laid(mounted, bricks[0]!, HOUSE)).toBeGreaterThan(bricks[0]!.t1);
	// The cards now stand left of the block: their cubes are in the air when the front comes.
	waits(mounted, HOUSE, dealt(bricks, 0.4, 1.2), dealt(points, 0.2, 1.4), HOLD);
	expect(bricks.map((brick) => laid(mounted, brick, HOUSE))).toEqual(bricks.map((brick) => brick.t1));
	expect(points.map((point) => laid(mounted, point))).toEqual(points.map((point) => point.t1));
});

test("town: a wait never leaves a block unbuilt when the front stops", () => {
	const mounted = town();
	const { bricks, points } = places(mounted);
	// Cards that would leave after the town is there: the block is laid before the front stops, its cubes late.
	waits(mounted, HOUSE, dealt(bricks, 30, 31), dealt(points, 30, 31), HOLD);
	const end = mounted.frontAt(Infinity);
	for (const place of [...bricks, ...points]) expect(mounted.frontAt(laid(mounted, place, place.at[1] > 0.2 ? HOUSE : undefined))).toBeLessThan(end);
});
