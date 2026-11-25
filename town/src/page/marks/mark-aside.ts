// Where a mark seen from afar (./far-marks.ts) goes when a sign or another mark takes its place: beside it (SPOTS),
// faded in there. From afar the signs stand over the squares, and fading those marks out hid two agents in three.
import type { Placed } from "./mark-paint";
import { HOLD, join, overlaps, type Placing } from "./mark-place";
import { fadedIn } from "./mark-share";

// How much of a mark's place a sign may take before it leaves it, in pixels: a place on the edge of free changed in a turn.
// Another mark may take none of it (./mark-place.ts).
const SLACK = 3;
// Where a mark goes when a sign or another mark takes its place, in its own widths and heights: under, beside, above.
// It keeps the place it took while that stays free, and goes back to its own once free with HOLD to spare.
const SPOTS = [
	[0, 0],
	[0, 1],
	[-1, 0],
	[1, 0],
	[0, -1],
	[-1, 1],
	[1, 1],
	[-1, -1],
	[1, -1],
];

// A mark at the place it took. `now`: how much it shows there, on its way in.
export type Kept = Placing & { now: number };
// What the marks keep from one frame to the next, by their group's id: the place each took, and how much it shows there.
export type Asides = { spots: Map<number, number>; seen: Map<number, number> };

// Whether the foot of a box stands over the town's ground, `hull` its four corners on the screen in turn.
function over(hull: [number, number][], box: number[]): boolean {
	const [px, py] = [(box[0]! + box[2]!) / 2, box[3]!];
	const sides = hull.map(([ax, ay], at) => {
		const [bx, by] = hull[(at + 1) % hull.length]!;
		return Math.sign((bx - ax) * (py - ay) - (by - ay) * (px - ax));
	});
	return sides.every((side) => side >= 0) || sides.every((side) => side <= 0);
}

// The `placed` marks, each at its own place or beside it, out of `signs` and of one another, on a screen `width` by
// `height`. A mark moved aside stays over the town's ground (`hull`). `held` is changed in place.
export function aside(
	placed: Placing[],
	signs: number[][],
	hull: [number, number][],
	[width, height]: [number, number],
	held: Asides,
	dt: number,
	measure: (p: Placed) => number[],
): Kept[] {
	const kept: Kept[] = [];
	for (const { id, members, p, box, shows } of placed) {
		const [w, h] = [box[2]! - box[0]!, box[3]! - box[1]!];
		const shifts = SPOTS.map(([sx, sy]) => [sx! * (w + 4), sy! * (h + 4)] as const);
		const at = (spot: number): number[] => [box[0]! + shifts[spot]![0], box[1]! + shifts[spot]![1], box[2]! + shifts[spot]![0], box[3]! + shifts[spot]![1]];
		// A sign may cover SLACK of a place; a mark none of it.
		const free = (spot: number, room: number): boolean =>
			!signs.some((other) => overlaps(at(spot), other, room)) &&
			!kept.some((other) => overlaps(at(spot), other.box, Math.max(0, room))) &&
			(spot === 0 || (over(hull, at(spot)) && at(spot)[0]! >= 0 && at(spot)[1]! >= 0 && at(spot)[2]! <= width && at(spot)[3]! <= height));
		// Its own place first, once free with room to spare; else the place it holds, while no more than SLACK of it is
		// taken by a sign; else the first free.
		const spotted = held.spots.get(id) ?? 0;
		let spot = free(0, spotted === 0 ? -SLACK : HOLD) ? 0 : free(spotted, -SLACK) ? spotted : SPOTS.findIndex((_, each) => free(each, HOLD));
		// No place free: it joins the mark its own place would cover, or stays there under the sign (the marks' canvas is
		// under the signs), rather than hide its agents.
		if (spot < 0) {
			const host = kept.find((other) => overlaps(at(0), other.box, 0));
			if (host) {
				join(host, { id, members, p, box, shows }, measure);
				continue;
			}
			spot = 0;
		}
		if (spot !== spotted) held.seen.set(id, 0);
		held.spots.set(id, spot);
		const now = fadedIn(held.seen.get(id) ?? 1, dt);
		held.seen.set(id, now);
		kept.push({ id, members, p: { ...p, x: p.x + shifts[spot]![0], y: p.y + shifts[spot]![1] }, box: at(spot), shows, now });
	}
	return kept;
}
