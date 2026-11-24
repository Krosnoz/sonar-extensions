// The plinth reads by night: a line of moonlight along its top edge and its foot, nothing by day (plinth.ts).
import { expect, test } from "bun:test";
import type { Block } from "./grid";
import type { Kit } from "./kit";
import type { G } from "./shapes";

// The models read the page's storage on import (./shapes.ts).
(globalThis as Record<string, unknown>)["localStorage"] ??= { getItem: () => null };
const { BOTTOM, edgeLight } = await import("./plinth");
const { T } = await import("./shapes");

// The lines laid, as the box of each one put: its lowest and highest y, where it stands, and where it was `put`.
type Laid = { low: number; high: number; x: number; z: number; put: [number, number] };
const laid = (night: boolean, blocks: Block[]): Laid[] => {
	const out: Laid[] = [];
	const kit = {
		night,
		part: (g: G) => {
			g.computeBoundingBox();
			const box = g.boundingBox!;
			return {
				put: ({ x, z }: { x: number; z: number }) =>
					out.push({ low: box.min.y, high: box.max.y, x: x + (box.min.x + box.max.x) / 2, z: z + (box.min.z + box.max.z) / 2, put: [x, z] }),
			};
		},
	} as unknown as Kit;
	edgeLight(kit, blocks);
	return out;
};
const two = [
	{ x: 0, z: 0 },
	{ x: T, z: 0 },
] as Block[];

test("by night, the plinth's foot carries a line of moonlight on each open side, and a bridge between two islands side by side", () => {
	// The reading of 13/11: the foot stood at 1.03:1 against the page's background, only the top edge set the island apart.
	const feet = laid(true, two).filter((l) => Math.abs(l.low - BOTTOM) < 0.01);
	// Six open sides, and two bridges along the two sides the two islands share.
	expect(feet.length).toBe(8);
	expect(feet.every((l) => l.high - l.low < 0.5)).toBe(true);
});

test("a line of moonlight is put where its block stands, on every side: the front builds it with its block", () => {
	// The film of 17/11: a line of the left or the far side was put a block away from its own, and the front, which
	// builds a part where it is put (./parts.ts), drew it alone on the page a block before the land, or a block after.
	const lines = laid(true, [{ x: T, z: -T }] as Block[]);
	expect(lines.map((l) => l.put)).toEqual(lines.map(() => [T, -T]));
	// The four sides still carry their two lines, the top edge's and the foot's, out of the block's middle.
	const sides = lines.map((l) => `${Math.sign(Math.round(l.x - T))},${Math.sign(Math.round(l.z + T))}`);
	expect(sides.toSorted()).toEqual(["-1,0", "-1,0", "0,-1", "0,-1", "0,1", "0,1", "1,0", "1,0"]);
});

test("by day, the plinth carries no line", () => {
	expect(laid(false, two)).toEqual([]);
});
