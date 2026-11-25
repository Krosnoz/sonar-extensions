// Canals and rivers: the water in its trench between two stone quays, the bridges over it, and the boats on it.
import { BED, QUAY, QUAY_TOP, SURFACE, WATER, WATER_TOP, ribbon, type Course } from "./course";
import { THREE, merge } from "../render/nodes";
import { b, piece, type G } from "../render/shapes";
import { MARK, ROAD, alongX, without } from "./street";
import { lamp } from "./street-furniture";

// A bridge's deck stands DECK high over the road's level; its ramps rise from the road over RAMP_UP and fall over RAMP_DOWN.
const DECK = 0.3;
// The deck spans all the water: the course winds up to 0,45 off the bridge's middle, so the ramps (solid) stay short of
// it (a bridge is 7,4 long, its water from 0,85 short of one end to 1,0 short of the other).
export const RAMP_UP = 0.85;
export const RAMP_DOWN = 1.05;
// The height of the road, `t` along a bridge `length` long: what the cars follow.
export const deckAt = (t: number, length: number): number =>
	t < RAMP_UP
		? ROAD + ((DECK - ROAD) * Math.max(0, t)) / RAMP_UP
		: t > length - RAMP_DOWN
			? ROAD + ((DECK - ROAD) * Math.max(0, length - t)) / RAMP_DOWN
			: DECK;

// A point of a shape seen from the side.
const V = (x: number, y: number) => new THREE.Vector2(x, y);
// A ramp: a solid wedge from the road's height to the deck's, over `along`, across `across`.
function ramp(rising: boolean, [lo, hi]: [number, number], [from, to]: [number, number]): G {
	const shape = new THREE.Shape(rising ? [V(lo, 0), V(hi, 0), V(hi, DECK), V(lo, ROAD)] : [V(lo, 0), V(hi, 0), V(hi, ROAD), V(lo, DECK)]);
	return piece(new THREE.ExtrudeGeometry(shape, { depth: to - from, bevelEnabled: false }), "#77747f", 0, 0, 0, from);
}

// A slab standing on its side, the polygon `points` (u, y) seen from the side, `depth` across, from `from`.
function profile(points: [number, number][], hex: string, from: number, depth: number): G {
	const shape = new THREE.Shape(points.map(([u, y]) => new THREE.Vector2(u, y)));
	return piece(new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false }), hex, 0, 0, 0, from);
}

// The wall under a bridge's parapet, seen from the side: stone from the bed of the water up to `top`, cut by ONE open
// arch, which stands on the water (the arch's feet 0,3 from the wall's ends) and rises 0,42 over its springing: its crown
// (0,17) is 0,03 under the deck's underside (0,2). The camera sees the arch's opening, whichever side of the bridge it
// looks at.
const SPRING = -0.25;
const RISE = 0.42;
function archedWall([up, down]: [number, number], top: number, hex: string, from: number, depth: number): G {
	const [from_, to] = [up + 0.3, down - 0.3];
	const shape = new THREE.Shape();
	shape.moveTo(up, BED);
	shape.lineTo(from_, BED);
	shape.lineTo(from_, SPRING);
	shape.absellipse((from_ + to) / 2, SPRING, (to - from_) / 2, RISE, Math.PI, 0, true);
	shape.lineTo(to, BED);
	shape.lineTo(down, BED);
	shape.lineTo(down, top);
	shape.lineTo(up, top);
	return piece(new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false }), hex, 0, 0, 0, from);
}

// A bridge along x (`along`), across z (`across`: its whole width, `road` the asphalt's): ramps, a deck over ONE wide
// arch, whose two walls are lined inside with a dark stone (the tunnel reads dark from the camera), a dark water under it,
// the road's dashes, and a straight parapet on each edge, which follows the ramps down to the road. For one along z, merge
// it and turn it by -PI/2.
export function bridge([lo, hi]: [number, number], across: [number, number], road: [number, number]): G[] {
	const [up, down] = [lo + RAMP_UP, hi - RAMP_DOWN];
	const mid = (across[0] + across[1]) / 2;
	const width = across[1] - across[0];
	// Between the side walls (0,14 thick): the deck, the shade on the water, the dark linings (0,1 thick, up to the deck's
	// underside).
	const inner = width - 0.28;
	const out: G[] = [
		ramp(true, [lo, up], across),
		ramp(false, [down, hi], across),
		alongX("#d6cbbd", [up, down], 0.07, inner, mid, 0.2),
		alongX("#77747f", [up, down], 0.03, road[1] - road[0], (road[0] + road[1]) / 2, 0.27),
		alongX("#2f4d66", [up, down], 0.02, inner, mid, WATER_TOP),
		archedWall([up, down], 0.27, "#a39c93", across[0], 0.14),
		archedWall([up, down], 0.27, "#a39c93", across[1] - 0.14, 0.14),
		archedWall([up, down], 0.2, "#1e242d", across[0] + 0.14, 0.1),
		archedWall([up, down], 0.2, "#1e242d", across[1] - 0.24, 0.1),
	];
	// The parapet and its cap: their foot follows the ramp, then the deck; their top is 0,16 and 0,2 over it. Thin, low and
	// of a stone darker than the road (which the camera sees pale), so that the rail reads as a rail, not as a second deck.
	const foot: [number, number][] = [
		[lo, ROAD],
		[up, DECK],
		[up, 0.27],
		[down, 0.27],
		[down, DECK],
		[hi, ROAD],
	];
	const line = (rise: number): [number, number][] => [
		[lo, ROAD + rise],
		[up, 0.27 + rise],
		[down, 0.27 + rise],
		[hi, ROAD + rise],
	];
	for (const edge of [across[0] + 0.07, across[1] - 0.07]) {
		out.push(profile([...foot, ...line(0.16).toReversed()], "#8a817b", edge - 0.05, 0.1));
		out.push(profile([...line(0.16), ...line(0.2).toReversed()], "#a39b94", edge - 0.08, 0.16));
	}
	for (let u = up + 0.3; u < down - 0.3; u += 1.1) out.push(b("#f3efe6", 0.55, MARK, 0.07, u, DECK, (road[0] + road[1]) / 2));
	// The street's dash goes on over each ramp, tilted with it: the road reads on both sides of the water.
	const lane = (road[0] + road[1]) / 2;
	const rise = (DECK - ROAD) / RAMP_UP;
	const fall = (DECK - ROAD) / RAMP_DOWN;
	out.push(
		b("#f3efe6", 0.55, MARK, 0.07, lo + RAMP_UP / 2, ROAD + (DECK - ROAD) / 2, lane, 0, [0, 0, Math.atan(rise)]),
		b("#f3efe6", 0.55, MARK, 0.07, hi - RAMP_DOWN / 2, ROAD + (DECK - ROAD) / 2, lane, 0, [0, 0, -Math.atan(fall)]),
	);
	return out;
}

// A watercourse along u across a block, in a trench: the water from the bed up to SURFACE, between two stone quays that
// reach from the bed to 0,07 over the ground. Where a bridge crosses (`under`) the quays are drawn dark: they are in its
// shade. It bends by up to the course's bend and back to the middle at the block's ends, so that the blocks' courses meet and the
// whole winds. Water and quays run on without a break. Built along x, to turn for one along z; the ground's banks, cut out of
// the course, are the block's (`banks` of ./course.ts). `exit`, for the end of a course (`lo` or `hi`) where it leaves the
// island, does what the river's bridge does at the front edge: the water darkens in two steps over its last metre, so that
// it goes out of sight as it does under the bridge instead of ending in a cut.
const SHADE = 1;
export function waterway([lo, hi]: [number, number], { at, wide }: Course, under: [number, number][] = [], exit: "lo" | "hi" | false = false): G[] {
	const out: G[] = [
		ribbon(WATER[0], [lo, hi], at, (u) => [-wide(u), wide(u)], BED, SURFACE - BED),
		ribbon(WATER[1], [lo, hi], at, (u) => [0.4 - wide(u), wide(u) - 0.4], SURFACE, WATER_TOP - SURFACE),
	];
	// Each step stops 0,03 short of the course's end, so that its end face is not in the water's.
	const steps: [number, number, string][] =
		exit === "hi"
			? [
					[hi - SHADE, hi - SHADE / 2, "#5c86a8"],
					[hi - SHADE / 2, hi - 0.03, "#2f4d66"],
				]
			: exit === "lo"
				? [
						[lo + 0.03, lo + SHADE / 2, "#2f4d66"],
						[lo + SHADE / 2, lo + SHADE, "#5c86a8"],
					]
				: [];
	for (const [from, to, hex] of steps) out.push(ribbon(hex, [from, to], at, (u) => [-wide(u), wide(u)], SURFACE, WATER_TOP - SURFACE + 0.03));
	const dark = under.map(([from, to]): [number, number] => [Math.max(lo, from), Math.min(hi, to)]).filter(([from, to]) => to > from);
	for (const side of [-1, 1]) {
		const edges = (u: number): [number, number] => (side < 0 ? [-wide(u) - QUAY, -wide(u)] : [wide(u), wide(u) + QUAY]);
		for (const part of without(lo, hi, under))
			out.push(
				ribbon("#a39c93", part, at, edges, BED, QUAY_TOP - BED),
				ribbon("#c9c2b8", part, at, (u) => [edges(u)[0] - 0.05, edges(u)[1] + 0.05], QUAY_TOP, 0.04),
			);
		for (const part of dark) out.push(ribbon("#4a5058", part, at, edges, BED, QUAY_TOP - BED));
	}
	return out;
}

// A canal's lamps, one on each quay, apart along it: by night their light streaks the water below them on the screen
// (../render/reflections.ts), whichever way the camera looks. The water had no light of its own, one flat navy. `turned`: for a
// course turned to run along z (a river), which lies at x = -its middle.
export function quayLamps({ at, wide }: Course, turned = false): G[] {
	const spots: [number, number][] = [
		[-2.6, -1],
		[1.9, 1],
	];
	return spots.flatMap(([u, side]) => {
		const v = at(u) + side * (wide(u) + QUAY / 2);
		return turned ? lamp(-v, u) : lamp(u, v);
	});
}

// A boat on the water at (x, z), turned by `turn` about its middle: a hull with a pointed bow, a cabin under a roof. 1,5
// long and 0,6 wide, riding on the water's top.
export function boat(hull: string, cabin: string, x: number, z: number, turn: number): G {
	return merge([
		b(hull, 1.2, 0.2, 0.6, -0.1, 0.05, 0),
		b(hull, 0.42, 0.2, 0.42, 0.5, 0.05, 0, 0, [0, Math.PI / 4, 0]),
		b(cabin, 0.6, 0.28, 0.4, -0.3, 0.25, 0),
		b("#8a5f3a", 0.66, 0.04, 0.46, -0.3, 0.53, 0),
	])
		.rotateY(turn)
		.translate(x, WATER_TOP - 0.05, z);
}
