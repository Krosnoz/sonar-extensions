// What stands and moves in the streets: trees, terraces, the inhabitants (agents), the robots (subagents) and
// the crates they carry.
import { THREE, merge } from "../render/nodes";
import { CARRIED, b, ball, blob, cyl, piece, rnd, type G } from "../render/shapes";
import { bench } from "../plan/street-furniture";

// A conifer is drawn at 0.7 of its first size: at 1.5 it stood over a building of two storeys. Its lowest cone starts a
// hand higher (0.09 before the shrink), so that a small one stays clear of a paved edge of 0.1.
const CONIFER = 0.7;
// How far a crown reaches from its trunk, at scale 1, for each kind of tree (the round one's clumps, the conifer's lowest
// cone, the blossom's narrower crown): what a tree planted by a wall must keep clear.
export const REACH = [0.84, 0.52 * CONIFER, 0.66];

// A bench, 0.8 of the street's: it stood large against the inhabitants. It keeps its feet on the ground (0.06).
export const seat = (x: number, z: number): G[] => bench(0, 0).map((part) => part.translate(0, -0.06, 0).scale(0.8, 0.8, 0.8).translate(x, 0.06, z));

// A tree: 0 a round one, 1 a tall conifer, 2 a round one in blossom.
export function tree(kind: number): G {
	const r = rnd(kind + 5);
	if (kind === 1)
		return merge(
			[
				cyl("#7c5536", 0.07, 0.1, 0.5, 0, 0, 0, 6),
				...[0, 1, 2, 3, 4].map((at) =>
					piece(new THREE.ConeGeometry(0.52 - at * 0.09, 0.7, 7), ["#2f7d40", "#368c45", "#3f9d4d", "#4aaa55", "#57b85c"][at]!, 0, 0, 0.79 + at * 0.4, 0),
				),
			].map((part) => part.scale(CONIFER, CONIFER, CONIFER)),
		);
	const leaves = kind === 2 ? ["#f48fb1", "#f8a9c4", "#e97aa0", "#fcc7d9"] : ["#2f7d40", "#368c45", "#3f9d4d", "#57b85c"];
	// A tree in blossom keeps a narrower crown (0.7 of the round one's reach, clumps 0.85 as big): its pink crown cut an
	// awning or stuck to a wall where the green one just passed.
	const [reach, fat] = kind === 2 ? [0.7, 0.85] : [1, 1];
	const clumps: [number, number, number, number, number][] = [
		[0, 1.35, 0, 0.55, 1],
		[0.4, 1.2, 0.1, 0.42, 0],
		[-0.38, 1.24, -0.08, 0.44, 0],
		[0.05, 1.72, 0.05, 0.42, 3],
		[-0.16, 1.5, 0.34, 0.38, 2],
		[0.2, 1.55, -0.32, 0.38, 0],
		[0.32, 1.62, 0.26, 0.27, 3],
		[-0.3, 1.66, -0.2, 0.3, 2],
	];
	return merge([
		cyl("#7c5536", 0.08, 0.13, 0.95, 0, 0, 0, 7),
		b("#7c5536", 0.06, 0.4, 0.06, 0.16, 0.7, 0, 0, [0, 0, -0.7]),
		b("#7c5536", 0.06, 0.4, 0.06, -0.16, 0.74, 0, 0, [0, 0, 0.7]),
		...clumps.map(([x, y, z, size, shade]) => blob(leaves[shade]!, size * fat, x * reach, y, z * reach)),
		...Array.from({ length: 6 }, () => blob(leaves[3]!, 0.12, (r() - 0.5) * 1.1 * reach, 1.3 + r() * 0.6, (r() - 0.5) * 1.1 * reach)),
	]);
}
// A table of the cafe's terrace, its parasol, two chairs.
export function terrace(): G {
	return merge([
		cyl("#f3ead9", 0.26, 0.26, 0.03, 0, 0.36, 0, 10),
		cyl("#2c303b", 0.03, 0.03, 0.36, 0, 0, 0, 6),
		cyl("#2c303b", 0.12, 0.12, 0.02, 0, 0, 0, 8),
		cyl("#2c303b", 0.02, 0.02, 0.9, 0, 0.38, 0, 6),
		piece(new THREE.ConeGeometry(0.6, 0.26, 8), "#ffffff", 1, 0, 1.36, 0),
		b("#ffd166", 0.06, 0.08, 0.06, 0.08, 0.39, 0.05),
		...[-0.42, 0.42].flatMap((dx) => [
			b("#a8703f", 0.2, 0.03, 0.2, dx, 0.22, 0),
			b("#a8703f", 0.03, 0.26, 0.2, dx + Math.sign(dx) * 0.1, 0.22, 0),
			b("#2c303b", 0.03, 0.22, 0.03, dx - 0.08, 0, 0.08),
			b("#2c303b", 0.03, 0.22, 0.03, dx + 0.08, 0, -0.08),
		]),
	]);
}

// The number of looks `person` draws: skin, hair, trousers, shoes, shirt and what is worn or carried, each different. The
// jacket alone takes the state's colour, and nothing else is teal, orange or violet.
export const LOOKS = 5;
const SKIN = ["#f2c9a0", "#f4d4b2", "#efc29a", "#f0c8a4", "#f5d6b8"];
const HAIR = ["#3a2a20", "#c9853c", "#1d1b18", "#8a5a2e", "#d9b45a"];
const TROUSERS = ["#39465f", "#6b5a45", "#4b6b5a", "#7a3f4f", "#2f2f35"];
const SHOES = ["#22252c", "#f3efe6", "#4a3426", "#22252c", "#8a8f99"];
const SHIRT = ["#f3efe6", "#cfe0ea", "#ecd5d5", "#e6e0c8", "#f3efe6"];
// What each look wears or carries: a backpack, a scarf and a ponytail, a cap, a beanie, a satchel.
const WORN: ((hair: string) => [G, number][])[] = [
	() => [[b("#8a5f3a", 0.16, 0.2, 0.07, 0, 0.24, -0.09), 0]],
	(hair) => [
		[b("#b5473c", 0.15, 0.05, 0.13, 0, 0.42, 0), 0],
		[b("#b5473c", 0.04, 0.13, 0.02, 0.03, 0.3, 0.066), 0],
		[b(hair, 0.05, 0.13, 0.05, 0, 0.47, -0.11), 0],
	],
	() => [
		[b("#b5473c", 0.24, 0.035, 0.24, 0, 0.62, 0.02), 0],
		[b("#b5473c", 0.2, 0.07, 0.2, 0, 0.64, -0.01), 0],
	],
	() => [
		[b("#5d6b7a", 0.22, 0.1, 0.22, 0, 0.6, 0), 0],
		[b("#d9d2c3", 0.06, 0.06, 0.06, 0, 0.7, 0), 0],
	],
	() => [[b("#a8703f", 0.14, 0.13, 0.06, 0, 0.2, -0.095), 0]],
];

// A person, original: it faces +z. The jacket takes the state's colour. `aLimb` says what a vertex belongs to (1 and 2
// the legs, 3 and 4 the arms): the shader lifts them to walk or to wave.
// A person, original: it faces +z. The jacket takes the state's colour. `aLimb` says what a vertex belongs to (1 and 2
// the legs, 3 and 4 the arms): the shader lifts them to walk or to wave.
export function person(variant: number): G {
	const look = variant % LOOKS;
	const [skin, hair, trousers, shoes, shirt] = [SKIN[look]!, HAIR[look]!, TROUSERS[look]!, SHOES[look]!, SHIRT[look]!];
	const limbs: [G, number][] = [
		...[-1, 1].flatMap((side): [G, number][] => [
			[b(shoes, 0.075, 0.045, 0.12, side * 0.055, 0, 0.015), side < 0 ? 1 : 2],
			[b(trousers, 0.07, 0.19, 0.075, side * 0.055, 0.045, 0), side < 0 ? 1 : 2],
			[b("#ffffff", 0.06, 0.17, 0.075, side * 0.135, 0.245, 0, 5), side < 0 ? 3 : 4],
			[b(skin, 0.055, 0.05, 0.065, side * 0.135, 0.195, 0), side < 0 ? 3 : 4],
		]),
		[b("#ffffff", 0.21, 0.2, 0.125, 0, 0.235, 0, 5), 0],
		[b(shirt, 0.07, 0.1, 0.02, 0, 0.33, 0.064), 0],
		[piece(ball(0.108, 1, 1, 0.95), skin, 0, 0, 0.535, 0), 0],
		// The hair sits on the top and the back of the head: the face stays clear.
		[piece(ball(0.112, 1, 0.7, 1), hair, 0, 0, 0.585, -0.03), 0],
		[b("#1d1b18", 0.026, 0.036, 0.02, -0.04, 0.53, 0.098), 0],
		[b("#1d1b18", 0.026, 0.036, 0.02, 0.04, 0.53, 0.098), 0],
		[b("#e0a888", 0.026, 0.03, 0.03, 0, 0.5, 0.104), 0],
		...WORN[look]!(hair),
	];
	for (const [geometry, limb] of limbs) {
		geometry.setAttribute("aLimb", new THREE.BufferAttribute(new Float32Array(geometry.getAttribute("position").count).fill(limb), 1));
		geometry.setAttribute("aOut", outward(geometry));
	}
	return merge(limbs.map(([geometry]) => geometry));
}
// Where each vertex goes for its piece to grow by one unit on every side: from the piece's middle, by its half size on
// each axis (a box's corner goes 1 along each, a ball's point along its radius). The night's rim (../render/see-through.ts)
// grows the figure so: pushed along its faces' normals, a box's faces parted and the rim had gaps at each corner.
function outward(geometry: G): THREE.BufferAttribute {
	geometry.computeBoundingBox();
	const { min, max } = geometry.boundingBox!;
	const [middle, half] = [min.clone().add(max).multiplyScalar(0.5), max.clone().sub(min).multiplyScalar(0.5)];
	const position = geometry.getAttribute("position");
	const out = new Float32Array(position.count * 3);
	for (let at = 0; at < position.count; at++)
		for (const [axis, get] of [position.getX, position.getY, position.getZ].entries()) {
			const size = half.getComponent(axis);
			out[at * 3 + axis] = size > 0 ? (get.call(position, at) - middle.getComponent(axis)) / size : 0;
		}
	return new THREE.BufferAttribute(out, 3);
}
// A subagent: a small robot on wheels, original. Its eyes and its antenna take the state's light.
export function robot(): G {
	return merge([
		b("#eef1f5", 0.22, 0.18, 0.2, 0, 0.07, 0),
		b("#c9ccd4", 0.24, 0.03, 0.22, 0, 0.25, 0),
		b("#1b2230", 0.16, 0.1, 0.02, 0, 0.12, 0.1),
		b("#ffffff", 0.035, 0.04, 0.02, -0.04, 0.15, 0.105, 2),
		b("#ffffff", 0.035, 0.04, 0.02, 0.04, 0.15, 0.105, 2),
		b("#6b7079", 0.02, 0.12, 0.02, 0.06, 0.28, -0.04),
		b("#ffffff", 0.05, 0.05, 0.05, 0.06, 0.4, -0.04, 2),
		...[-1, 1].map((side) => cyl("#22252c", 0.07, 0.07, 0.04, side * 0.13, 0.05, 0, 8, 0, [0, 0, Math.PI / 2])),
		b("#ff9838", 0.24, 0.02, 0.02, 0, 0.09, 0.1),
	]);
}
// What a person at work carries: a crate that glows with the state's colour.
export function crate(): G {
	return merge([b("#ffffff", 0.16, 0.13, 0.13, 0, 0, 0, CARRIED), b("#f3efe6", 0.17, 0.02, 0.14, 0, 0.055, 0), b("#f3efe6", 0.02, 0.13, 0.14, 0, 0, 0)]);
}
