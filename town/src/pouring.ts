// The bricks a merge's pallet pours into the storey it lays (./sites.ts): thrown in a spray from the pallet, as a
// card's when the town opens (./dust.ts), each to land on a wall of the storey when its height is laid.
import type { Grain } from "./dust";
import { FLY } from "./layer-grains";
import { N } from "./nodes";
import { footOf, type House } from "./rising";
import { BD, BW, SH } from "./shapes";

type Point = [number, number, number];

// The bricks a whole storey takes, and the fewest a merge pours.
const [BRICKS, FEWEST] = [180, 40];
// How much of the spray of the town's opening the bricks keep.
const SPRAY = 0.6;
// The share of a storey laid in a second.
export const RATE = 1.1;
// The seconds after a pallet pours its first bricks land: the storey is laid from then.
export const LANDS = FLY * 0.9;

// The bricks of the storey `storey` of `house` from the share `low` to `high`, poured from `from` at the town's second
// `at`. Returns the second the last one has landed.
export function pourOf(
	house: House,
	storey: number,
	[low, high]: [number, number],
	from: Point,
	at: number,
	random: () => number,
): { grains: Grain[]; until: number } {
	const { x, z, color } = house.wall;
	const hex = parseInt(color.slice(1), 16);
	const colour: [number, number, number] = [hex >> 16, (hex >> 8) & 255, hex & 255];
	const foot = footOf(house, storey);
	const grains = Array.from({ length: Math.max(FEWEST, Math.ceil(BRICKS * (high - low))) }, (): Grain => {
		const [u, v, side] = [random() - 0.5, low + random() * (high - low), random()];
		const y = foot + v * SH;
		// Mostly on the two faces the camera sees.
		const end: Point =
			side < 0.45
				? [x + u * BW, y, z + BD / 2]
				: side < 0.8
					? [x + BW / 2, y, z + u * BD]
					: side < 0.9
						? [x + u * BW, y, z - BD / 2]
						: [x - BW / 2, y, z + u * BD];
		const t1 = at + FLY + (v - low) / RATE;
		const t0 = Math.min(t1 - FLY * (0.7 + random() * 0.3), t1 - 0.6);
		return { start: from, end, t0, t1, colour, into: color, seed: random(), brick: true, from: 1.5 / N, to: 0.9 / N, spray: SPRAY };
	});
	return { grains, until: at + FLY + (high - low) / RATE + 0.3 };
}
