// By night, the block the town holds for a subject to come looks as any block until its subject comes
// (./plot-mask.ts, ../render/lamplight.ts). Before, the two lamps of the square not built yet lit the old ground, and the
// line of the land's edge was hidden along the block (22/11, seen against main on a village of 8 agents).

import { expect, test } from "bun:test";
import { lights, type Held } from "../render/lamplight";
import { swept } from "./plot-mask";
import { T } from "../render/shapes";

test("held block: the lamps of what stands there light the ground until its subject's building is built, its own from then on", () => {
	const [old, own, far] = [
		{ x: 22 + 3, z: 11 - 4, old: true },
		{ x: 22 - 2.6, z: 11 + 2.3, old: false },
		{ x: 22 + T, z: 11, old: false },
	];
	// No block held (a town drawn before the block's kit says it): every lamp lights.
	expect([old, own, far].map((disc) => lights(disc, null))).toEqual([true, true, true]);
	const before: Held = [22, 11, false];
	expect([old, own, far].map((disc) => lights(disc, before))).toEqual([true, false, true]);
	const built: Held = [22, 11, true];
	expect([old, own, far].map((disc) => lights(disc, built))).toEqual([false, true, true]);
});

test("held block: its front hides what stands on a subject's ground, never the line of the land's edge", () => {
	// A subject's ground and what stands still on it, a building's storeys, and what stood on the block.
	expect(swept({ still: true, waits: "land" })).toBe(true);
	expect(swept({ waits: "building" })).toBe(true);
	expect(swept({ plot: "old" })).toBe(true);
	// The line of the edge (../plan/plinth.ts), a car and a figure, which wait for the ground only.
	expect(swept({ glow: 0.55, shadow: false, still: true, waits: "land", plot: "kept" })).toBe(false);
	expect(swept({ waits: "land" })).toBe(false);
	expect(swept({})).toBe(false);
});
