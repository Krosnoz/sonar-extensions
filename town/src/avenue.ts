// The avenue's strip along its blocks: road, kerbs, dashes, zebra crossing, pavements, and its bridge over the canal.
import { bridge as bridge_ } from "./canals";
import { merge } from "./nodes";
import { b, T, type G } from "./shapes";
import { EDGE, MARK, ROAD, alongZ, without } from "./street";
import { lamp } from "./street-furniture";

// The avenue across the streets, on the +x side of its blocks (x 2,70 to 5,04, as high as the street's road). The
// street's road crosses it, so its own stops at the street's (z 2,70 to 5,04), and its kerbs at the street's kerbs. Over
// the canal, a bridge: its parapets stand where the kerbs would (x 2,63 and 5,11), from quay to quay.
// The bridge's end, along the avenue: 2.1, short of the street's kerb.
export const BRIDGE_END = 2.1;
// Over the canal, `course` is the water's middle along the avenue's block (z at x): its pavements then run up to the quays.
export function avenueStrip(bridge: boolean, back = false, course?: (u: number) => number): G[] {
	const out: G[] = [];
	const cut: [number, number][] = bridge
		? [
				[2.7, 5.04],
				[-EDGE - 1, BRIDGE_END],
			]
		: [[2.7, 5.04]];
	for (const span of without(-EDGE, EDGE, cut))
		out.push(alongZ("#77747f", 2.34, ROAD, span, 3.87), alongZ("#eee6d8", 0.14, 0.11, span, 2.63), alongZ("#eee6d8", 0.14, 0.11, span, 5.11));
	dashes(out, bridge);
	// The crossing before the street; none over the bridge's ramp.
	if (!bridge) for (let at = 0; at < 6; at++) out.push(b("#f3efe6", 0.2, MARK, 1.3, 2.92 + at * 0.38, ROAD, 1.9));
	// Lamps on the pavement by the houses, a third of a block apart (the third falls on the street, which has its own): by
	// night the avenue was a dark strip between lit streets. Off the road, so they cover neither its dashes nor its cars;
	// over the canal the quays' lamps light it.
	if (!bridge) for (const z of [-4.4, -4.4 + T / 3]) out.push(...lamp(2.43, z));
	// Over the canal, a bridge along z: built along x, from the quay's side, then turned.
	if (bridge) out.push(merge(bridge_([EDGE - T, BRIDGE_END], [-5.18, -2.56], [-5.04, -2.7])).rotateY(-Math.PI / 2));
	pavements(out, bridge, course);
	// At the island's back edge the avenue ends in a low wall, between its kerbs, on a paved apron.
	if (back && !bridge) out.push(b("#d6cbbd", 2.34, 0.09, 0.28, 3.87, 0, -5.43), b("#b3ada4", 2.34, 0.3, 0.22, 3.87, ROAD, -5.4));
	return out;
}

// The avenue's dashed line. No dash under the crossing (z 1.25 to 2.55), nor 0.15 short of it, as on the street: the
// one at z 1.6 ran under its first stripes.
function dashes(out: G[], bridge: boolean): void {
	const striped = (z: number): boolean => !bridge && z + 0.275 > 1.25 - 0.15 && z - 0.275 < 2.55 + 0.15;
	for (let z = -5; z <= 5; z += 1.1)
		if (Math.abs(z - 3.9) > 1.4 && !(bridge && z - 0.275 < BRIDGE_END) && !striped(z)) out.push(b("#f3efe6", 0.07, MARK, 0.55, 3.87, ROAD, z));
}

// A pavement along each kerb, short of the street (it has its own) and of the bridge's ramp: the avenue is paved from
// its start, not a road laid on the grass.
// Over the canal the pavement stops at the quays (the water's half width and the quay, 2,65 from the course, taken in by
// 0,05), not before the bridge's ramp: no grass is left between the quay, the ramp and the street.
function pavements(out: G[], bridge: boolean, course: ((u: number) => number) | undefined): void {
	for (const [x, w, [from, to]] of [
		[2.43, 0.26, [2.3, 2.56]],
		[5.385, 0.41, [5.18, 5.59]],
	] as const) {
		const edges = [from, (from + to) / 2, to].map((u) => course?.(u) ?? 0);
		const cuts: [number, number][] =
			bridge && course
				? [
						[2.56, 5.18],
						[Math.max(...edges) - 2.65 + 0.05, Math.min(...edges) + 2.65 - 0.05],
					]
				: bridge
					? [
							[2.56, 5.18],
							[-EDGE - 1, BRIDGE_END],
						]
					: [[2.56, 5.18]];
		for (const span of without(-EDGE, EDGE, cuts)) out.push(alongZ("#d6cbbd", w, 0.09, span, x));
	}
}
