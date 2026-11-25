// A field of a block nobody lives on yet (./meadows.ts#meadow): two or three plots, each low on the grass in its crop's
// colour, crossed by darker furrows. Raised bands of one colour with grass between them read as planks laid on the lawn.
import { shade } from "../buildings/facades-kit";
import { b, detail, type G } from "../render/shapes";

// Ripe wheat, young green shoots, ploughed earth.
const CROPS = ["#d8b85a", "#9cc25a", "#a0714a"];
// A plot stands 0.05 over the grass; its furrows 0.02 over the plot, closer the depth buffer cannot tell them apart.
const PLOT = 0.05;
const FURROW = 0.02;

// The plots share [x0, x1] along x, and split [z0, z1] with a path of grass 0.3 wide between two. A plot's furrows run
// along x or along z, the other way from its neighbour's, 0.26 apart; each is a fine detail, left out from afar, where
// the plot reads as one colour.
export function field(r: () => number, [x0, x1]: [number, number], [z0, z1]: [number, number]): G[] {
	const out: G[] = [];
	const count = 2 + Math.floor(r() * 2);
	const path = 0.3;
	const deep = (z1 - z0 - path * (count - 1)) / count;
	let crop = Math.floor(r() * CROPS.length);
	for (let n = 0; n < count; n++) {
		crop = (crop + 1 + Math.floor(r() * (CROPS.length - 1))) % CROPS.length;
		const hex = CROPS[crop]!;
		const [from, to] = [z0 + n * (deep + path), z0 + n * (deep + path) + deep];
		const [mx, mz, w] = [(x0 + x1) / 2, (from + to) / 2, x1 - x0];
		out.push(b(hex, w, PLOT, deep, mx, 0, mz));
		const [furrow, along] = [shade(hex, 0.72), (n + Math.floor(r() * 2)) % 2 === 0];
		// From 0.13 inside the plot's edge: no furrow runs along it, in the plane of its side.
		if (along) for (let z = from + 0.13; z < to - 0.1; z += 0.26) out.push(b(furrow, w - 0.16, FURROW, 0.07, mx, PLOT, z, detail(0.07)));
		else for (let x = x0 + 0.13; x < x1 - 0.1; x += 0.26) out.push(b(furrow, 0.07, FURROW, deep - 0.16, x, PLOT, mz, detail(0.07)));
	}
	return out;
}
