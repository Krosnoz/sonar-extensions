// What a merge brings to a subject's building (./sites.ts): a tower crane, a truck and its pallet of bricks. Made of
// the town's small plain volumes.
import { merge } from "../render/nodes";
import { SH, b, box, cyl, piece, type G } from "../render/shapes";

// The crane's yellow, its iron.
export const CRANE = "#f0b429";
const IRON = "#2c303b";
// How far the jib reaches from the mast.
const JIB = 7.4;

// One length of the mast, a storey high: four posts and two rings.
export function mast(): G {
	const half = 0.13;
	const posts = [-1, 1].flatMap((sx) => [-1, 1].map((sz) => b(CRANE, 0.05, SH, 0.05, sx * half, 0, sz * half)));
	const rings = [0, SH / 2].flatMap((y) =>
		[-1, 1].flatMap((side) => [b(CRANE, 0.3, 0.04, 0.04, 0, y, side * half), b(CRANE, 0.04, 0.04, 0.3, side * half, y, 0)]),
	);
	return merge([...posts, ...rings]);
}

// What turns on the mast: the cabin, the jib along +x, the counter-jib and its weight, and a light at the tip.
export const jib = (): G =>
	merge([
		b(IRON, 0.4, 0.1, 0.4, 0, 0, 0),
		b("#f4f2ee", 0.3, 0.3, 0.3, 0.1, 0.1, 0.27),
		b("#2f4a63", 0.04, 0.16, 0.26, 0.26, 0.2, 0.27, 6.1),
		b(CRANE, 0.08, 0.95, 0.08, 0, 0.1, 0),
		...[-0.1, 0.1].map((z) => b(CRANE, JIB, 0.05, 0.05, JIB / 2, 0.12, z)),
		b(CRANE, JIB * 0.86, 0.05, 0.05, JIB * 0.43, 0.42, 0),
		...Array.from({ length: 12 }, (_, at) => b(CRANE, 0.04, 0.3, 0.04, 0.5 + at * 0.6, 0.14, 0)),
		b(CRANE, 1.9, 0.06, 0.26, -0.95, 0.12, 0),
		b("#6b7079", 0.55, 0.42, 0.36, -1.55, -0.3, 0),
		b("#ffffff", 0.1, 0.1, 0.1, JIB - 0.05, 0.44, 0, 2),
	]);

// The cable, one metre down from its top: stretched to the hook.
export const cable = (): G => piece(box(0.03, 1, 0.03), IRON, 0, 0, -0.5, 0);
export const hook = (): G => merge([b(CRANE, 0.22, 0.07, 0.22, 0, 0, 0), b(IRON, 0.1, 0.14, 0.1, 0, -0.14, 0)]);

// A pallet's height, and how far under the cable's end the hook's iron reaches.
export const [LOAD, HOOK] = [0.47, 0.14];
// What a merge delivers: a pallet of bricks in the wall's colour.
export const pallet = (): G => merge([b("#b98a52", 0.74, 0.07, 0.6, 0, 0, 0), b("#ffffff", 0.64, 0.4, 0.5, 0, 0.07, 0, 1)]);

// A merge comes by the street: a flatbed truck, its cab in the instance's colour. It faces +x, as the town's cars.
export const truck = (): G =>
	merge([
		b("#ffffff", 0.38, 0.44, 0.5, 0.44, 0.12, 0, 1),
		b("#2f4a63", 0.04, 0.17, 0.42, 0.63, 0.36, 0, 6.1),
		b("#8a8f98", 0.9, 0.07, 0.5, -0.2, 0.2, 0),
		b("#6b7079", 0.04, 0.12, 0.5, -0.63, 0.27, 0),
		...[-0.42, 0.42].flatMap((x) => [-0.24, 0.24].map((z) => cyl("#24262b", 0.12, 0.12, 0.08, x, 0.0, z, 8, 0, [Math.PI / 2, 0, 0]))),
		...[-0.16, 0.16].map((z) => b("#ffe7a0", 0.03, 0.06, 0.08, 0.64, 0.2, z, 4)),
	]).scale(1.4, 1.4, 1.4);
