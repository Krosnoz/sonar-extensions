// What a sign keeps off, and where it slides before its name is cut (./sign-geometry.ts): « Ancienne applicati… » and
// « API publique et inté… » were cut on a phone with room beside them (13/11), every place refused for a lamp's head no
// longer drawn or for four pixels round another roof's anchor.
import { expect, test } from "bun:test";
import { ORDER, SPOTS, attached, clear, dotOf, headsDrawn } from "./sign-geometry";

test("a lamp's head is an obstacle only while it is drawn: its post 1.5 pixels of the drawing or more", () => {
	// 0.06 of the town: at 20 CSS px a unit, 1.2 px, under 1.5 half-pixels (0.75): drawn; at 10, 0.6: gone.
	expect(headsDrawn(20, 0.5)).toBe(true);
	expect(headsDrawn(10, 0.5)).toBe(false);
	expect(headsDrawn(25, 1)).toBe(true);
	expect(headsDrawn(24, 1)).toBe(false);
});

test("another roof's anchor is an obstacle over its dot only", () => {
	const dot = dotOf([100, 100]);
	// A sign whose edge is two pixels from the point, beside the dot, stands; one over the dot does not.
	expect(clear([dot], 102, 60, 80, 40, 0)).toBe(true);
	expect(clear([dot], 99, 60, 80, 40, 0)).toBe(false);
	// The dot reaches 3.5 px left of its point, 1.5 px right (.world-dot's margin).
	expect(clear([dot], 20, 60, 76, 40, 0)).toBe(true);
	expect(clear([dot], 20, 60, 77, 40, 0)).toBe(false);
});

test("a long name slides past half its width, toward the screen's middle first, while its line stays short", () => {
	// Slides and sides come in pairs: rightward first for a roof on the left of the screen, leftward for one on the right.
	const first = (toward: number): number => SPOTS[ORDER[toward]!.find((at) => SPOTS[at]![0] !== 0)!]![0];
	expect(first(1)).toBeGreaterThan(0);
	expect(first(-1)).toBeLessThan(0);
	expect([...ORDER[1]!].sort((p, q) => p - q)).toEqual([...SPOTS.keys()]);
	expect([...ORDER[-1]!].sort((p, q) => p - q)).toEqual([...SPOTS.keys()]);
	// A name 200 px wide, 22 high (with its room of 10), its roof at x 300: at 0.6 of its width its edge is 25 px past the
	// roof, joined; a whole width out it is 105 px off, detached.
	const [w, h, x, y] = [210, 32, 300, 400];
	const at = (column: number): number => SPOTS.findIndex(([c, r]) => c === column && r === 0);
	const top = y - 6 - h;
	expect(at(0.6)).toBeGreaterThan(0);
	expect(attached(at(0.6), true, x, y, x + 0.6 * w, w, top, h)).toBe(true);
	expect(attached(at(1), true, x, y, x + w, w, top, h)).toBe(false);
});
