// The water through the town's blocks: the canal along its row, the river along its column, and the boats on the canal.
import type { Block } from "./grid";
import { merge } from "../render/nodes";
import { b, H, pick, rnd, T, type G } from "../render/shapes";
import { boat, bridge as bridge_, quayLamps, waterway } from "./canals";
import { WATER_TOP, courseOf, wind, type Swell } from "./course";
import { EDGE, MARK } from "./street";
import { lamp } from "./street-furniture";
import { seat } from "../people/figures";
import { scatter } from "./meadows";
import type { Trees } from "./city";

// The water's width each side of its middle, and how far its course bends: narrow and winding, a ribbon from block to
// block, not a basin in each. The bend is 0 at the blocks' ends, so that the courses of two blocks meet.
export const HALF = 2.2;
export const BEND = 0.6;

// The boats' wakes: pale strokes on the water, along the flow, following the course (up to 1.2 from its middle).
const wakes = (r: () => number, centre: number, sign: number): G[] =>
	Array.from({ length: 6 }, () => {
		const along = -4.6 + r() * 6.2;
		return b("#a9c8dc", 0.5 + r() * 0.8, MARK, 0.06, along, WATER_TOP, wind(along, centre, BEND, sign) + (r() - 0.5) * 2.4);
	});

// How far the canal's width differs from HALF where block `k` ends and block `k + 1` begins: both read it, so the water
// is as wide on one side of the line as on the other. None at the avenue's bridge, which spans exactly HALF.
const canalEnd = (seed: number, k: number, avenue: number): number => (k === avenue || k === avenue - 1 ? 0 : (rnd(seed + 211 + k * 17)() - 0.5) * 0.6);
const smooth = (t: number): number => t * t * (3 - 2 * t);

// The canal's width and middle along block `i`: from the width of its first end to its last (flat at both, so that the
// course has no kink), and in about four blocks in ten a basin, wider in the middle and pushed away from the side the
// course already bends to (the water stays between the back wall and the street's kerb).
export function canalSwell(seed: number, i: number, avenue: number): Swell {
	const crossed = i === avenue;
	const [from, to] = [canalEnd(seed, i - 1, avenue), canalEnd(seed, i, avenue)];
	const r = rnd(seed + 307 + i * 13);
	const basin = !crossed && r() < 0.4 ? 0.45 + r() * 0.15 : 0;
	const sign = i % 2 ? 1 : -1;
	return (u) => {
		const t = Math.min(1, Math.max(0, (u + H) / T));
		const bulge = basin * Math.sin(Math.PI * t) ** 2;
		return { extra: from + (to - from) * smooth(t) + bulge, shift: -sign * bulge };
	};
}

// A boat riding the canal in block `i`: its place along the block, its colours and its heading follow `boatSeed`; it is
// turned with the course, which it follows to within half a metre.
function afloatIn(boatSeed: number, sign: number, swell: Swell): G {
	const r = rnd(boatSeed);
	const course = (u: number): number => wind(u, -1.7, BEND, sign) + swell(u).shift;
	const u = -3.4 + r() * 6.4;
	const slope = (course(u + 0.2) - course(u - 0.2)) / 0.4;
	return boat(
		pick(["#c8553a", "#2f6fd0", "#e0a93a", "#e8e1d3"], r),
		pick(["#f3efe6", "#e8d8b0"], r),
		u,
		course(u) + (r() - 0.5),
		-Math.atan(slope) + (r() < 0.5 ? Math.PI : 0),
	);
}

// The canal through its row of blocks, between two stone quays, winding from one block to the next, each block with its
// own width, and a boat in some. The water runs on without a break; the quays only stop where the avenue's bridge crosses
// (x 2,5 to 5,2), and only in the block the avenue crosses.
export function canalStrip(r: () => number, i: number, crossed: boolean, swell: Swell, boatSeed: number | null, exit: "hi" | false): G[] {
	const sign = i % 2 ? 1 : -1;
	return [
		...waterway([-EDGE, EDGE], courseOf(-1.7, HALF, BEND, sign, swell), crossed ? [[2.63, 5.11]] : [], exit),
		...wakes(r, -1.7, sign).concat(quayLamps(courseOf(-1.7, HALF, BEND, sign, swell))),
		...(boatSeed === null ? [] : [afloatIn(boatSeed, sign, swell)]),
	];
}

// The river along its column of blocks, between two quays, winding a little from one block to the next, its water
// unbroken from one block to the next. The block's street crosses it on a bridge: a deck raised to DECK over the water,
// ramps down to the road at both ends, piers and parapets. The river leaves by the island's edge.
export function riverStrip(r: () => number, block: Block, trees: Trees, exit: boolean): G[] {
	// The quays stop at the street (z 2,56 on), where the bridge's deck takes the width, water running under it.
	const sign = block.j % 2 ? 1 : -1;
	const course = waterway([-EDGE, EDGE], courseOf(1.8, HALF, BEND, sign), [[2.63, EDGE + 1]], exit ? "lo" : false);
	const out: G[] = [merge(course).rotateY(-Math.PI / 2), ...bridge_([EDGE - T, 2], [2.56, EDGE - 0.03], [2.7, 5.04])];
	for (const [dx, dz] of scatter(r, 3, [2.8, 4.2], [-4.4, 1.1], 2.2, [
		[2.5, -4.6],
		[3.4, 1.3],
	]))
		trees(r() < 0.5 ? 0 : 1).put({ x: block.x + dx, y: 0, z: block.z + dz, ry: r() * 6, s: 1 });
	out.push(...lamp(2.5, -4.6), ...seat(3.4, 1.3), ...quayLamps(courseOf(1.8, HALF, BEND, sign), true));
	// The course turned to run along z lies at x = -its middle.
	out.push(
		...Array.from({ length: 6 }, () => {
			const along = -4.6 + r() * 6.4;
			return b("#a9c8dc", 0.06, MARK, 0.5 + r() * 0.8, -wind(along, 1.8, BEND, sign) + (r() - 0.5) * 2.4, WATER_TOP, along);
		}),
	);
	return out;
}
