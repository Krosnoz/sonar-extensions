// The place of the labels and of their leads: pure functions of signs.ts.
import { expect, test } from "bun:test";
import "./signs-test-page";

const signs = { ...(await import("./signs.ts")), ...(await import("./sign-geometry.ts")), ...(await import("./sign-names.ts")) };
const { fits, SPOTS } = signs;

test("a label in the way goes up above its roof, then tries the left and the right", () => {
	const [w, h, x, y] = [100, 20, 500, 300];
	const taken = [[x - w / 2, y - h, x + w / 2, y]];
	const room = (spot: number): boolean => {
		const [column, row] = SPOTS[spot]!;
		return fits(taken, x + column * w - w / 2, y + row * h - h, w, h);
	};
	expect(SPOTS[0]).toEqual([0, 0]);
	expect(room(0)).toBe(false);
	expect(SPOTS[[...SPOTS.keys()].find(room)!]).toEqual([0, -1]);
	// Above taken too: the left, then the right.
	taken.push([x - w / 2, y - 2 * h, x + w / 2, y - h]);
	expect(SPOTS[[...SPOTS.keys()].find(room)!]).toEqual([-1, 0]);
	taken.push([x - 1.5 * w, y - h, x - 0.5 * w, y]);
	expect(SPOTS[[...SPOTS.keys()].find(room)!]).toEqual([1, 0]);
});

test("a whole name in the way on one side slides to the other, its roof still under it, before it is cut", () => {
	// The case seen (computer, 10 agents, overview): « Ancienne applicati… » cut, a neighbour on its left, the room free on
	// its right. At a width aside, the label was too far from its roof for its lead.
	const { stays } = signs;
	const [w, h, x, y] = [260, 32, 500, 300];
	const neighbour = [x - w / 2 - 40, y - 2 * h, x - w / 2 + 30, y];
	const room = (spot: number): boolean => {
		const [column, row] = SPOTS[spot]!;
		const [cx, top] = [x + column * w, y + row * h - h];
		return fits([neighbour], cx - w / 2, top, w, h) && stays(x, y + 6, cx, w, top, h);
	};
	const [column, row] = SPOTS[[...SPOTS.keys()].find(room)!]!;
	expect(row).toBe(0);
	expect(column).toBeGreaterThan(0);
	expect(column).toBeLessThan(0.5);
});

test("a label stands under its roof's point only as a last resort, every place above taken", () => {
	// The case seen: near the screen's top, the label went down under its anchor and hid the roof and its chimney.
	const under = SPOTS.findIndex(([, row]) => row > 0);
	expect(under).toBeGreaterThan(0);
	expect(SPOTS.slice(0, under).every(([, row]) => row <= 0)).toBe(true);
	// On the phone, near, a building filled the top without its sign: under the anchor, on the façade, a stem from the
	// anchor, the line going up to it.
	expect(SPOTS.slice(under).every(([, row]) => row === 1)).toBe(true);
	const { leadFrom, joins, STEM, GAP } = signs;
	const [x, roof, w, h] = [200, 150, 120, 32];
	const top = roof + STEM - GAP;
	const [, ny, length] = leadFrom(x, roof, x, w, top, h);
	expect(ny).toBeGreaterThan(roof);
	expect(joins(length, h - GAP, true, STEM)).toBe(true);
	expect(SPOTS.slice(0, 2)).toEqual([
		[0, 0],
		[0, -1],
	]);
	expect(new Set(SPOTS.map((spot) => spot.join())).size).toBe(SPOTS.length);
});

test("a lead does not cross another lead; a lead that passes under a pin goes through it", async () => {
	const { crosses, through } = await import("./crossing.ts");
	expect(crosses([0, 0, 10, 10], [0, 10, 10, 0])).toBe(true);
	// Parallel, or touching at one end (two leads of the same roof): no crossing.
	expect(crosses([0, 0, 10, 0], [0, 5, 10, 5])).toBe(false);
	expect(crosses([0, 0, 10, 10], [10, 10, 20, 0])).toBe(false);
	// The case seen: the lead of the pin « ≡ » passed under the next pin to reach its roof.
	expect(through([0, 50, 100, 50], [40, 40, 60, 60])).toBe(true);
	expect(through([0, 50, 30, 50], [40, 40, 60, 60])).toBe(false);
	// One end in the box.
	expect(through([50, 50, 100, 100], [40, 40, 60, 60])).toBe(true);
});

test("a name is written whole first, cut only short of room; a phone keeps the counts while it has room", async () => {
	// Seen: « Échanges Septeo et… » cut at 20 letters with room to spare.
	const { looksFor } = await import("./sign-looks.ts");
	// The name alone keeps a count of one while it has room (« 1 API publique… »), then drops it before it is cut.
	expect(looksFor(1, false, false)).toEqual(["", "world-cut", "world-short", "world-short world-bare", "world-short world-cut"]);
	expect(looksFor(1, false, true).at(-1)).toBe("world-mini");
	// Seen: on a phone, near, « API publique et intégrations » without its « 1 à revoir », which the computer showed. Short
	// of room, the name stays whole and drops its counts before it is cut.
	expect(looksFor(1, true, true)).toEqual(["", "world-short", "world-short world-bare", "world-cut", "world-short world-cut", "world-mini"]);
	// Every subject that has a pictogram keeps it as a last resort, not only the one that waits.
	expect(looksFor(2, true, true).at(-1)).toBe("world-mini");
	expect(looksFor(2, true, false)).not.toContain("world-mini");
	// From afar, the pictogram is the whole label.
	expect(looksFor(0, true, true)).toEqual([""]);
});

test("the lead is capped at 1.5 times the pill's height plus the stem, and missing when the anchor is out of frame", () => {
	const { joins } = signs;
	expect(joins(20, 20, true)).toBe(true);
	expect(joins(36, 20, true)).toBe(true);
	expect(joins(36.5, 20, true)).toBe(false);
	// The leads seen 617–680 px and 215 px long went across the town.
	expect(joins(215, 20, true)).toBe(false);
	expect(joins(20, 20, false)).toBe(false);
	// A label on its roof has its lead too: the 6 px stem.
	expect(joins(6, 20, true)).toBe(true);
	expect(joins(3, 20, true)).toBe(false);
	// Above a water tower, the stem grows longer: the lead stays.
	expect(joins(50, 20, true, 40)).toBe(true);
	expect(signs.attached(0, true, 300, 400, 300, 110, 360 - 32, 32, 40)).toBe(true);
});

test("a flat roof's anchor is on its bare surface, and its huts are raised for the label to pass above them", async () => {
	const { crownOf } = await import("./roofs.ts");
	// The flat roof 0 carries the water tower, the stair's hut and the aerial (v13jour-c-d10-securite).
	const { surface, tops, bare } = crownOf(1, 0);
	expect(surface).toBe(0.08);
	expect(Math.max(...tops.map(([, y]) => y))).toBeGreaterThan(surface + 0.5);
	expect(bare.length).toBeGreaterThan(0);
	for (const [x, z] of bare) expect(tops.some(([tx, , tz]) => Math.abs(tx - x) < 0.6 && Math.abs(tz - z) < 0.6)).toBe(false);
});

test("the lead starts under the pill, on its middle line: the pill covers it up to its own edge", () => {
	const { leadStart } = signs;
	// A pill of 200 × 22 (210 × 32 with its margin), centred at 300, its box's top at 100: radius 11.
	expect(leadStart(500, 300, 210, 100, 32)).toEqual([389, 121]);
	expect(leadStart(0, 300, 210, 100, 32)).toEqual([211, 121]);
	expect(leadStart(320, 300, 210, 100, 32)).toEqual([320, 121]);
	// A square pictogram (diamond, bubble): the lead starts from its centre.
	expect(leadStart(500, 300, 28, 100, 28)).toEqual([300, 119]);
});

test("nothing under the top bar: the blocked zone refuses a label that touches it", () => {
	const bar = [[-Infinity, -Infinity, Infinity, 64]];
	expect(fits(bar, 600, 50, 100, 20)).toBe(false);
	expect(fits(bar, 600, 64, 100, 20)).toBe(true);
});

test("a subject's label stays near its roof, never at the other end of the screen", () => {
	const { stays } = signs;
	// The case seen: a roof 345 px from the left edge, a label 250 px wide. A width to the left, the box was pushed to the
	// screen's edge, 95 px from the roof and 180 px from the island: refused, as two widths to the left.
	const [x, y, w, h] = [345, 470, 250, 32];
	expect(stays(x, y, w / 2, w, y - h, h)).toBe(false);
	expect(stays(x, y, x - w, w, y - h, h)).toBe(false);
	expect(stays(x, y, x - 2 * w, w, y - h, h)).toBe(false);
	// On its roof, a height above or below: accepted; three heights higher: refused.
	expect(stays(x, y, x, w, y - h, h)).toBe(true);
	expect(stays(x, y, x, w, y, h)).toBe(true);
	expect(stays(x, y, x, w, y - 3 * h, h)).toBe(false);
	// A pill of 18 px (28 with its margin) beside its roof: accepted; three pills farther: refused.
	expect(stays(x, y, x + 28, 28, y - 28, 28)).toBe(true);
	expect(stays(x, y, x + 3 * 28, 28, y - 28, 28)).toBe(false);
});

test("the lead starts from the pill's edge, not from the margin round it", () => {
	const { leadFrom } = signs;
	// A pill of 18 px (28 with its margin) left of the roof: the 5 px margin does not count in the length.
	const [x, y, cx, w, h] = [200, 100, 172, 28, 28];
	const [nx, ny, length] = leadFrom(x, y, cx, w, y - h, h);
	expect(nx).toBe(cx + 9);
	expect(ny).toBe(y);
	expect(length).toBe(x - (cx + 9));
});

test("after a turn, a label whose roof leaves the screen hides instead of sticking to the edge", () => {
	const { attached, leadFrom } = signs;
	// The case seen (phone, quarter turn): a roof left of the screen (x -60), a label of 200 px pushed to the edge (centre
	// 100).
	const [x, y, w, h] = [-60, 610, 200, 32];
	expect(leadFrom(x, y, 100, w, y - h, h)[2]).toBeGreaterThan(3);
	expect(attached(0, false, x, y, 100, w, y - h, h)).toBe(false);
	// On its roof, whole in the screen, or pushed by the edge but still above its roof: kept.
	expect(attached(0, true, 150, y, 150, w, y - h, h)).toBe(true);
	expect(attached(0, true, 20, y, 100, w, y - h, h)).toBe(true);
	// Beside its roof: only when the roof is on the screen (else no lead, and the label would name another building).
	expect(attached(1, true, 150, y, 260, w, y - h, h)).toBe(true);
	expect(attached(1, false, 150, y, 260, w, y - h, h)).toBe(false);
});

test("during a turn, a label does not come back a pixel when the camera snaps back", async () => {
	const { steady } = await import("./steady.ts");
	// The case seen (phone, density 2, « Ancienne application »): the roof moves on by 0.1 px a frame, then back by a
	// camera step (0.5 px). Rounded at each frame, the label went from 84 to 84.5 px and back.
	const roof = [84.2, 84.3, 84.4, 84.5, 84.6, 84.2, 84.3, 84.4, 84.5, 84.6, 84.7, 84.2, 84.3, 84.5, 84.7, 84.3];
	let held: number | null = null;
	const places = roof.map((raw) => (held = steady(held, raw, 2, 0.5)));
	const moves = places.filter((place, at) => at > 0 && place !== places[at - 1]);
	expect(moves.length).toBeLessThanOrEqual(1);
	// When the roof really goes, the label follows it, within a camera step and a pixel of the screen.
	for (const raw of [85, 86, 87.3, 90]) {
		held = steady(held, raw, 2, 0.5);
		expect(Math.abs(held - raw)).toBeLessThan(0.5 + 0.75 + 1e-9);
	}
	// A slow turn (computer, density 1): the roof moves on by 0.8 px a frame. The label never moves on two frames in a
	// row: a sharp text that moves by a pixel twice in a row flickers at the edge of its strokes.
	let slow: number | null = null;
	const steps = Array.from({ length: 40 }, (_, at) => 300 + at * 0.8).map((raw) => (slow = steady(slow, raw, 1, 0.5)));
	const moved = steps.map((place, at) => at > 0 && place !== steps[at - 1]);
	expect(moved.some((move, at) => move && moved[at - 1])).toBe(false);
	// A label that appears stands at its rounded place.
	expect(steady(null, 84.3, 2, 0.5)).toBe(84.5);
	expect(steady(null, 84.3, 1, 0.5)).toBe(84);
});
