// The course of a canal or a river through a block: where its middle and its width lie along it, and the flat slabs that
// follow it (water, quays, the banks the water is cut out of). The water lies in a trench, well under the street.
import { THREE } from "../render/nodes";
import { H, T, piece, type G } from "../render/shapes";

// The water, softer than the grass, and still readable at night.
export const WATER = ["#6f9fc4", "#8db8d8"] as const;
// The water's top stands 0,6 under the road (0,05), the bed of the trench on the layer of earth below the grass, and the
// quay's top 0,07 over the ground: a house has storeys 1,05 high, so a quay's wall reads as over half a storey of stone.
export const SURFACE = -0.55;
export const BED = -0.9;
export const QUAY_TOP = 0.07;
// The lighter strip of the water's top stands 0,02 above SURFACE: what rides on the water stands on it.
export const WATER_TOP = SURFACE + 0.02;
// A quay's thickness, and how far its coping reaches beyond it.
export const QUAY = 0.4;

// The course's middle at `u` along its block (from the block's middle): a sine that rises over one block and falls over
// the next (`sign` alternates), so that two blocks' courses meet at the same point with the same slope, and the water
// has neither step nor kink from one block to the next.
export const wind = (u: number, centre: number, bend: number, sign: number): number => centre + bend * sign * Math.sin((Math.PI * (u + H)) / T);

// `swell`, when given, widens and shifts the course along the block (the course's width and middle at u, as offsets from
// `half` and `centre`): water and quays follow it. Two blocks' swells meet when both are the same at their common end and
// flat there.
export type Swell = (u: number) => { extra: number; shift: number };

// A course along u across a block, built along x (to turn for one along z): its middle and its half width at `u`.
export type Course = { at: (u: number) => number; wide: (u: number) => number };
export const courseOf = (centre: number, half: number, bend: number, sign: number, swell: Swell = () => ({ extra: 0, shift: 0 })): Course => ({
	at: (u) => wind(u, centre, bend, sign) + swell(u).shift,
	wide: (u) => half + swell(u).extra,
});

// A flat slab (from `y`, `h` high) between two offsets of a course along u (`edges`: the near and the far one at u): a
// polygon followed every 0,25, one piece from a block's end to the other, built along x.
export function ribbon(hex: string, [lo, hi]: [number, number], at: (u: number) => number, edges: (u: number) => [number, number], y: number, h: number): G {
	const steps = Math.max(1, Math.ceil((hi - lo) / 0.25));
	const us = Array.from({ length: steps + 1 }, (_, k) => lo + ((hi - lo) * k) / steps);
	// The shape's v is -z: turned flat, the shape's plane becomes the ground and its depth the height.
	const V = (u: number, off: number) => new THREE.Vector2(u, -(at(u) + off));
	const shape = new THREE.Shape([...us.map((u) => V(u, edges(u)[1])), ...us.toReversed().map((u) => V(u, edges(u)[0]))]);
	return piece(new THREE.ExtrudeGeometry(shape, { depth: h, bevelEnabled: false }).rotateX(-Math.PI / 2), hex, 0, 0, y, 0);
}

// A layer of ground (from `x[0]` to `x[1]` and `z[0]` to `z[1]` round the block's middle, from `y`, `h` thick) with the
// course cut out of it, quays included: the two banks, one each side. `across` turns them, for a course along z.
export function banks(hex: string, y: number, h: number, x: [number, number], z: [number, number], course: Course, across: boolean): G[] {
	// Built along x, then turned: a course along z runs along u = z, and its offsets v are -x.
	const [along, [lo, hi]]: [[number, number], [number, number]] = across ? [z, [-x[1], -x[0]]] : [x, z];
	const bank = (edges: (u: number) => [number, number]): G => {
		const slab = ribbon(hex, along, course.at, edges, y, h);
		return across ? slab.rotateY(-Math.PI / 2) : slab;
	};
	return [bank((u) => [lo - course.at(u), -course.wide(u) - QUAY]), bank((u) => [course.wide(u) + QUAY, hi - course.at(u)])];
}
