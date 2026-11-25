// The blocks nobody lives on yet: a field in furrows or an orchard, a few trees along the street, and now and then one
// thing of the countryside. Every one of them had the same grey well, a dozen of them on the grass at 10 agents.
import type { Trees } from "./city";
import type { Style } from "../../shared/styles";
import { field } from "./fields";
import type { Block } from "./grid";
import { b, cyl, H, type G } from "../render/shapes";

// `count` points in [x0, x1] × [z0, z1], each at least `gap` from the others and from `avoid`: spread, never on a grid.
export function scatter(
	r: () => number,
	count: number,
	[x0, x1]: [number, number],
	[z0, z1]: [number, number],
	gap: number,
	avoid: [number, number][] = [],
): [number, number][] {
	const out: [number, number][] = [];
	for (let attempt = 0; attempt < count * 12 && out.length < count; attempt++) {
		const p: [number, number] = [x0 + r() * (x1 - x0), z0 + r() * (z1 - z0)];
		if ([...out, ...avoid].every((q) => Math.hypot(p[0] - q[0], p[1] - q[1]) >= gap)) out.push(p);
	}
	return out;
}

// The things of the countryside, each about 1 wide, standing at (x, z): a well, two hay bales, a woodpile, three
// beehives, a scarecrow.
const WOOD = "#8a5f3a";
const THINGS: ((x: number, z: number) => G[])[] = [
	(x, z) => [cyl("#9a948a", 0.42, 0.42, 0.5, x, 0, z, 10), cyl("#6f9fc4", 0.32, 0.32, 0.05, x, 0.47, z, 10)],
	(x, z) => [
		cyl("#e2c46a", 0.3, 0.3, 0.42, x - 0.25, 0.3, z, 12, 0, [Math.PI / 2, 0, 0]),
		cyl("#d4b45a", 0.3, 0.3, 0.42, x + 0.4, 0.3, z + 0.2, 12, 0, [Math.PI / 2, 0, 0.4]),
	],
	(x, z) =>
		[0, 1, 2].flatMap((row) =>
			Array.from({ length: 3 - row }, (_, at) =>
				cyl(at % 2 ? WOOD : "#a8703f", 0.11, 0.11, 0.9, x - 0.22 + row * 0.11 + at * 0.22, 0.11 + row * 0.19, z, 8, 0, [Math.PI / 2, 0, 0]),
			),
		),
	(x, z) =>
		[-0.45, 0, 0.45].flatMap((dx) => [
			b("#f3ead9", 0.3, 0.32, 0.3, x + dx, 0.1, z),
			b("#c9a36a", 0.36, 0.05, 0.36, x + dx, 0.42, z),
			b(WOOD, 0.26, 0.1, 0.26, x + dx, 0, z),
		]),
	(x, z) => [
		b(WOOD, 0.06, 1.2, 0.06, x, 0, z),
		b(WOOD, 0.8, 0.05, 0.05, x, 0.85, z),
		b("#c8553a", 0.3, 0.36, 0.16, x, 0.62, z),
		cyl("#e2c46a", 0.13, 0.13, 0.18, x, 1.05, z, 8),
		cyl("#5b3d2b", 0.22, 0.22, 0.03, x, 1.2, z, 10),
	],
];
// `n` modulo `m`, never negative.
const mod = (n: number, m: number): number => ((n % m) + m) % m;
// Which thing a free block shows, -1 for none: one block in three at most ((i + 2j) % 3 is never 0 for two blocks side
// by side or one ahead of the other), and those that carry one and touch by a corner differ in `i`, so in their thing.
export function thingOf(i: number, j: number, seed: number): number {
	return mod(i + 2 * j, 3) === 0 ? mod(i + seed, THINGS.length) : -1;
}

// The land a block keeps for itself, in x and z from its centre: its street runs along its front (z from 2.56), and the
// avenue along its +x side when `end` is short of the edge (x from 2.56). A tree's crown is about 1 wide.
const FRONT = 2.56 - 0.9;
// Twice the reach of the round crown (REACH in ../people/figures.ts) at the orchard's biggest scale, 1.2.
const GAP = 2 * 0.84 * 1.2 + 0.05;
// A field is the exception (about a quarter): bands of different widths, and gaps between them. Otherwise an orchard of
// trees spread with a distance between them. `thing`, from `thingOf`, at a spot that is not always the same.
export function meadow(style: Style, block: Block, r: () => number, trees: Trees, end: number, thing: number): G[] {
	const out: G[] = [];
	const [west, east] = [-H + 0.6, end < H ? FRONT : H - 0.6];
	const spot: [number, number] = [west + 0.8 + r() * (east - west - 1.6), 0.6 + r() * 0.9];
	// The orchard's trees stand GAP apart: two round crowns at their biggest (1.2) never overlap on the ground.
	const orchard = r() < 0.25 ? [] : scatter(r, 6, [west + 0.8, east - 0.8], [-4.8, 0.9], GAP, [spot]);
	if (!orchard.length) out.push(...field(r, [west, east - 0.6 - r() * 0.8], [-5 + r() * 0.4, -0.3]));
	for (const [x, z] of orchard)
		trees(style.trees[Math.floor(r() * style.trees.length)]!).put({ x: block.x + x, y: 0, z: block.z + z, ry: r() * 6, s: 0.9 + r() * 0.3 });
	if (thing >= 0) out.push(...THINGS[thing]!(spot[0], spot[1]));
	// A few trees along the street's side, apart from one another, from the thing's spot and from the orchard's trees:
	// they avoided the spot only, and stood in a column with the orchard's front trees (12/11).
	for (const [x] of scatter(r, 3, [west + 0.8, east - 0.8], [FRONT - 0.2, FRONT - 0.2], 2.2, [[spot[0], FRONT - 0.2], ...orchard]))
		trees(style.trees[Math.floor(r() * style.trees.length)]!).put({ x: block.x + x, y: 0, z: block.z + FRONT - 0.2, ry: r() * 6, s: 1 });
	return out;
}
