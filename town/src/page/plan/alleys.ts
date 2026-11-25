// The trees of the lane between the two rows of a block.
import { REACH } from "../people/figures";

// What a house reaches into the lane: from x0 to x1, its face at z.
export type Face = [number, number, number];

// The air a crown keeps from a wall or an awning: with 0.12 it touched them from the camera's side.
const AIR = 0.6;

// A tree of the lane: placed among `tries` spots along x, centred between what the rows reach into the lane (`backs`:
// the back row's fronts, `fronts`: the front row's backs), AIR on each side, and as big as that room lets its crown be
// (0.8 at most). None when it would be under 0.5: a tree is left out rather than pressed against a wall or an awning.
// `planted`: the lane's trees already there, whose crowns this one's never overlaps on the ground (the two trees of a
// short lane stood in one column, 12/11).
function alleyTree(r: () => number, kind: number, [from, to]: [number, number], backs: Face[], fronts: Face[], planted: Alley[]): Alley | null {
	const [reach, big] = [REACH[kind]!, 0.8];
	let best: Alley | null = null;
	for (let attempt = 0; attempt < 6 && (best?.s ?? 0) < 0.65; attempt++) {
		const x = from + r() * (to - from);
		// What the crown can meet, taken at its widest (scale 0.8), AIR more to each side (a house's end wall 0.3 from the
		// crown's reach is a wall touched), and 0.2 for the roofs and trims that stand out of a house's width.
		const wide = reach * big + AIR + 0.2;
		const near = (faces: Face[]): number[] => faces.filter(([x0, x1]) => x1 > x - wide && x0 < x + wide).map((face) => face[2]);
		const [back, front] = [Math.max(-2.2, ...near(backs)), Math.min(2.4, ...near(fronts))];
		const s = Math.min(big, (front - back - 2 * AIR) / (2 * reach));
		const z = (back + front) / 2;
		if (planted.some((other) => Math.hypot(other.x - x, other.z - z) < reach * s + REACH[other.kind]! * other.s)) continue;
		if (s >= 0.5 && s > (best?.s ?? 0)) best = { x, z, s, kind };
	}
	return best;
}

export type Alley = { x: number; z: number; s: number; kind: number };

// The lane's trees, one of each of `kinds`, those that find room.
export function alleyTrees(r: () => number, kinds: number[], along: [number, number], backs: Face[], fronts: Face[]): Alley[] {
	const out: Alley[] = [];
	for (const kind of kinds) {
		const planted = alleyTree(r, kind, along, backs, fronts, out);
		if (planted) out.push(planted);
	}
	return out;
}
