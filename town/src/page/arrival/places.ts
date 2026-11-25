// Where the cubes of the page land: bricks on the sides of a building the camera sees and on its roof, parts of an
// inhabitant, tiles of a block's ground. Each place says when the front lays it, so its cube lands just then, and the
// colour of what is built there, which the cube takes as it comes.
import type { Mounted } from "../render/kit";

// `origin`: where the front is measured for it, the foot of what it is a part of (./pace.ts).
type Spot = [number, number, number];
export type Place = { at: Spot; origin: Spot; size: number; t1: number; colour: string };
type House = { at: [number, number]; w: number; d: number; top: number; wall: string; roof: string; paving: string };

function shuffled<T>(list: T[], random: () => number): T[] {
	const out = [...list];
	for (let at = out.length - 1; at > 0; at--) {
		const other = Math.floor(random() * (at + 1));
		[out[at], out[other]] = [out[other]!, out[at]!];
	}
	return out;
}
// `count` places among `all`, spread over it; reused if the page gives more cubes than there are places.
const spread = (all: Place[], count: number, random: () => number): Place[] => {
	const mixed = shuffled(all, random);
	return Array.from({ length: count }, (_, at) => mixed[at % mixed.length]!);
};

// The camera looks from +x, +z and above: those two sides and the roof are seen.
export function bricks(mounted: Mounted, house: House, count: number, random: () => number): Place[] {
	if (!count) return [];
	const [hx, hz] = house.at;
	const area = (house.w + house.d) * house.top + house.w * house.d;
	// Down to the town's own cube, 1/11 of a metre: the points settle where the front lays its cubes.
	const size = Math.min(0.6, Math.max(1 / 11, Math.sqrt(area / count)));
	const all: Place[] = [];
	const put = (x: number, y: number, z: number, colour: string): void =>
		void all.push({ at: [x, y, z], origin: [hx, 0, hz], size, t1: mounted.when([x, y, z], [hx, 0, hz]), colour });
	const steps = (from: number, to: number): number[] =>
		Array.from({ length: Math.max(1, Math.floor((to - from) / size)) }, (_, at) => from + (at + 0.5) * size);
	for (const y of steps(0.1, house.top)) {
		for (const z of steps(hz - house.d / 2, hz + house.d / 2)) put(hx + house.w / 2 - size * 0.45, y, z, house.wall);
		for (const x of steps(hx - house.w / 2, hx + house.w / 2)) put(x, y, hz + house.d / 2 - size * 0.45, house.wall);
	}
	for (const x of steps(hx - house.w / 2, hx + house.w / 2)) for (const z of steps(hz - house.d / 2, hz + house.d / 2)) put(x, house.top + 0.2, z, house.roof);
	return spread(all, count, random);
}

export function tiles(mounted: Mounted, lot: { at: [number, number]; side: number; house: House }, count: number, random: () => number): Place[] {
	const size = Math.min(0.7, Math.max(1 / 11, Math.sqrt((lot.side * lot.side * 0.6) / Math.max(1, count))));
	const { house } = lot;
	return Array.from({ length: count }, () => {
		let [x, z] = [0, 0];
		// Outside the building's foot: the tiles make its square and its street.
		do [x, z] = [lot.at[0] + (random() - 0.5) * lot.side * 0.9, lot.at[1] + (random() - 0.5) * lot.side * 0.9];
		while (Math.abs(x - house.at[0]) < house.w / 2 && Math.abs(z - house.at[1]) < house.d / 2);
		const at: Spot = [x, 0.12, z];
		return { at, origin: at, size, t1: mounted.when(at), colour: house.paving };
	});
}

// `colour`: the inhabitant's, the colour of its state.
export function body(mounted: Mounted, at: [number, number, number], colour: string, random: () => number): Place {
	const spot: Spot = [at[0] + (random() - 0.5) * 0.36, 0.15 + random() * 1.3, at[2] + (random() - 0.5) * 0.36];
	const origin: Spot = [at[0], 0, at[2]];
	return { at: spot, origin, size: 0.14, t1: mounted.when(spot, origin), colour };
}
