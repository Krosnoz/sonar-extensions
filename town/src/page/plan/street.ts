// A block's land with its earth in section, and its street. The street's furniture is in ./street-furniture.ts.
import { QUAY, banks, type Course } from "./course";
import { face, strata } from "./plinth";
import { H, T, b, cyl, detail, type G } from "../render/shapes";

// `hex` with its saturation times `sat`, its lightness moved by `light` and its hue by `turn` (a turn is 1).
function tinted(hex: string, sat = 1, light = 0, turn = 0): string {
	const read = (at: number): number => parseInt(hex.slice(at, at + 2), 16) / 255;
	const [r, g, blue] = [read(1), read(3), read(5)];
	const [max, min] = [Math.max(r, g, blue), Math.min(r, g, blue)];
	const [l, d] = [(max + min) / 2, max - min];
	let h = 0;
	if (d) h = (max === r ? ((g - blue) / d + 6) % 6 : max === g ? (blue - r) / d + 2 : (r - g) / d + 4) / 6;
	const s = Math.min(1, (d ? d / (1 - Math.abs(2 * l - 1)) : 0) * sat);
	const [hh, ll] = [(((h + turn) % 1) + 1) % 1, Math.min(1, Math.max(0, l + light))];
	const c = (1 - Math.abs(2 * ll - 1)) * s;
	const channel = (n: number): string => {
		const k = (n + hh * 12) % 12;
		return Math.round((ll - (c / 2) * Math.max(-1, Math.min(k - 3, 9 - k, 1))) * 255)
			.toString(16)
			.padStart(2, "0");
	};
	return `#${channel(0)}${channel(8)}${channel(4)}`;
}
// A plant's or a lawn's green, a quarter less saturated than it was: the grass read loud against the facades and the accent.
export const muted = (hex: string): string => tinted(hex, 0.75);
// The lawn of a block: the town's green, a quarter less saturated (0.46 to 0.34), and a little different from block to block
// (its hue within ±2°, its lightness within ±0.02) by the block's number `n`. Every lawn lies at one height and stops at
// its block's edge where a neighbour's begins (`land`): lawns that reached over each other sat 0.02 to 0.08
// apart, and the outline drew that step as a line across the grass.
export type Lawn = { hex: string };
const LAWN: Lawn = { hex: muted("#80c666") };
export const lawnOf = (n: number): Lawn => {
	const step = (((n * 7) % 5) + 5) % 5;
	return { hex: tinted(LAWN.hex, 1, (step - 2) * 0.01, (step - 2) / 360) };
};

// On a face the camera sees: `u` runs along it, `depth` is how far the box comes out of it.
const onFace = (side: number, hex: string, w: number, h: number, u: number, y: number, depth = 0.06): G =>
	side ? b(hex, 0.14, h, w, H + depth - 0.07, y, u) : b(hex, w, h, 0.14, u, y, H + depth - 0.07);

// What is left of [from, to] once the `cuts` are taken out.
export function without(from: number, to: number, cuts: [number, number][]): [number, number][] {
	const out: [number, number][] = [];
	let at = from;
	for (const [lo, hi] of cuts.toSorted((p, q) => p[0] - q[0])) {
		if (lo > at) out.push([at, Math.min(lo, to)]);
		at = Math.max(at, hi);
	}
	if (at < to) out.push([at, to]);
	return out.filter(([lo, hi]) => hi - lo > 1e-9);
}
// A box between `lo` and `hi` along x (`alongX`, at z) or along z (`alongZ`, at x).
export const alongX = (hex: string, [lo, hi]: [number, number], h: number, d: number, z: number, y = 0): G => b(hex, hi - lo, h, d, (lo + hi) / 2, y, z);
export const alongZ = (hex: string, w: number, h: number, [lo, hi]: [number, number], x: number, y = 0): G => b(hex, w, h, hi - lo, x, y, (lo + hi) / 2);

// The foot of the +x wall of the last house of a row: a paving slab along it, 0,4 wide beyond the house's roof (the wall
// stands at or short of the roof's edge) but not past the block's edge, from the house's back wall plus 0,3 to `to`, where
// it joins the walk.
export function sideFoot(house: G, to: number): G[] {
	house.computeBoundingBox();
	const { min, max } = house.boundingBox!;
	const [from, past] = [max.x - 0.5, Math.min(max.x + 0.4, EDGE)];
	return [alongZ("#ddd0c8", past - from, 0.04, [min.z + 0.3, to], (from + past) / 2)];
}

// The street's heights: the road, and a mark painted on it, which stands 0,02 out of it at least (closer, the depth
// buffer cannot tell the two faces apart from afar).
export const ROAD = 0.05;
export const MARK = 0.02;
// The edge of a block's ground, and where the street's kerbs, pavement and the avenue's cross.
export const EDGE = T / 2 + 0.09;

// The block of land of one subject: the earth in section on the two faces the camera sees, the street in front, the
// paved square, the garden. Three variants. `avenue` leaves the crossing of the avenue (x 2,56 to 5,18) free of kerbs,
// pavement and dashes; `river` leaves the river's width (to x 2,0) to the bridge of ./water-strips.ts#riverStrip.
// `rim` says which of its edges has no block beyond: the street ends there in a low wall, and no crossing leads to it.
// `crossing: false` leaves out the street's zebra crossing: the block adds it with `crossing()` when its front is a walk.
// `joined`: the road along the island's right edge comes into the street from the front (./corner.ts): the far kerb and
// the pavement open where it arrives (x 2,56 to 5,18).
export type Rim = { left?: boolean; right?: boolean; front?: boolean; back?: boolean; crossing?: boolean; joined?: boolean };
// The street's zebra crossing, from the block's walk (z 2,56) over the road to the pavement across (z 5,18).
// The pavement across (z 5,18 to 5,59) is the block behind's back edge: if that block is a park or a field, the zebra would
// end against its lawn, so a landing, as high as the pavement, goes on 0,3 into it.
export const crossing = (): G[] => [
	...Array.from({ length: 6 }, (_, at) => b("#f3efe6", 1.3, MARK, 0.2, 0, ROAD, 2.92 + at * 0.38)),
	b("#d6cbbd", 1.3, 0.09, 0.3, 0, 0, 5.74),
];
// `channel`, for a block the water crosses, cuts the course (and its quays) out of the grass and of the first earth: a
// trench down to the second earth, which is the water's bed. `across` is for a course along z.
export type Channel = { course: Course; across: boolean };
// `cover`: whether the street has its manhole cover and drain (a town gives them to one block in two: a cover on every
// block's street was a pattern).
// The x of a block's cover and drain, by the block's number `n`: the middle of a gap between two dashes of the lane, clear of
// the crossing (x ±1.1), and of the avenue's road (x 2.56 on) in its block.
export const drainOf = (n: number, avenue: boolean): number => {
	const gaps = avenue ? [-4.45, -3.35, -2.25] : [-4.45, -3.35, -2.25, 2.15, 3.25, 4.35];
	return gaps[((n % gaps.length) + gaps.length) % gaps.length]!;
};
// The grass reaches 0.09 over the earth where the island ends, a lip over its side; where a block is beyond, it stops at
// the edge, and the neighbour's lawn begins in the same plane.
const lip = (open?: boolean): number => H + (open ? 0.09 : 0);

// A layer of the block's ground between `x` and `z`, with the water's course cut out of it.
type Layer = (hex: string, y: number, h: number, x: [number, number], z: [number, number]) => G[];

// The lawn, its tufts over the two faces the camera sees, and the earth and rock in section under it.
function ground(out: G[], r: () => number, rim: Rim, channel: Channel | undefined, lawn: Lawn, layer: Layer): void {
	out.push(...layer(lawn.hex, -0.2, 0.2, [-lip(rim.left), lip(rim.right)], [-lip(rim.back), lip(rim.front)]));
	// Where the trench opens on the face the camera sees (the canal's on the +x face, the river's on the +z one): no tuft
	// nor stone hangs in the air there.
	const [mid, reach] = channel ? [channel.course.at(H), channel.course.wide(H) + QUAY] : [0, 0];
	const notch = (side: number): [number, number] | null =>
		!channel || side !== (channel.across ? 0 : 1) ? null : channel.across ? [-mid - reach, -mid + reach] : [mid - reach, mid + reach];
	const inNotch = (side: number, from: number, to: number): boolean => {
		const gap = notch(side);
		return !!gap && from < gap[1] && to > gap[0];
	};
	for (const side of [0, 1]) {
		// The grass hangs over the earth in tufts: none narrower than about two pixels of the whole town, none past the
		// corner, where the other face's tufts begin; and 0,03 short of the earth's edge, so that no end of a tuft lies in
		// the plane of the earth's side.
		for (let u = -H + 0.03; u < H - 0.3;) {
			const w = Math.min(0.4 + r() * 0.5, H - 0.03 - u);
			const len = 0.18 + r() * r() * 0.5;
			const tuft = onFace(side, r() < 0.5 ? lawn.hex : tinted(lawn.hex, 1, -0.07), w, len, u + w / 2, -0.2 - len, 0.11);
			if (!inNotch(side, u, u + w)) out.push(tuft);
			u += w;
		}
		// The strata's seams and stones on this face.
		out.push(...face(side, r, (from, to) => inNotch(side, from, to)));
	}
	// The earth and the rock under the lawn.
	out.push(...strata((hex, y, h) => layer(hex, y, h, [-H, H], [-H, H])));
}

// The road's dashed line, clear of the crossing, of the avenue's road and of a river's bridge.
function dashes(out: G[], avenue: boolean, river: boolean): void {
	for (let x = -5; x <= 5; x += 1.1) {
		if (Math.abs(x + 0.05) <= 1.1 || (avenue && x + 0.275 > 2.56 && x - 0.275 < 5.18) || (river && x - 0.275 < 2)) continue;
		out.push(b("#f3efe6", 0.55, MARK, 0.07, x, ROAD, 3.87));
	}
}

// The street, along the front left edge: kerbs, a dashed line, a crossing, a manhole. Where the avenue crosses it
// (x 2,56 to 5,18) the road goes on, and the kerbs and the pavement stop; over a river (to x 2,0) the bridge of
// ./water-strips.ts#riverStrip takes their place.
function street(out: G[], avenue: boolean, river: boolean, rim: Rim): void {
	const kerbs: [number, number][] = [];
	const pavement: [number, number][] = [];
	if (avenue) {
		kerbs.push([2.7, 5.04]);
		pavement.push([2.56, 5.18]);
	}
	if (river) {
		kerbs.push([-EDGE - 1, 2]);
		pavement.push([-EDGE - 1, 2]);
	}
	// Over a river the road is the bridge's: the water runs on under it.
	for (const span of without(-EDGE, EDGE, river ? [[-EDGE - 1, 2]] : [])) out.push(alongX("#77747f", span, ROAD, 2.34, 3.87));
	const [far, farPavement]: [[number, number][], [number, number][]] = rim.joined
		? [
				[...kerbs, [2.7, 5.04]],
				[...pavement, [2.56, 5.18]],
			]
		: [kerbs, pavement];
	for (const span of without(-EDGE, EDGE, kerbs)) out.push(alongX("#eee6d8", span, 0.11, 0.14, 2.63));
	for (const span of without(-EDGE, EDGE, far)) out.push(alongX("#eee6d8", span, 0.11, 0.14, 5.11));
	for (const span of without(-EDGE, EDGE, farPavement)) out.push(alongX("#d6cbbd", span, 0.09, 0.41, 5.385));
	dashes(out, avenue, river);
	// No crossing over a bridge, nor towards the island's front edge.
	if (!river && !rim.front && rim.crossing !== false) out.push(...crossing());
}

// A manhole cover in its lane and a drain: a dark rim round a paler lid with two grooves, so that they read as street
// furniture, not as stains. Each part stands 0,02 higher than the one under it (closer, the depth buffer cannot tell them apart).
// Both stand in the middle of the gap between two dashes of the lane (the dashes are 1,1 apart from x -5, 0,55 long): at
// x -3 the cover touched a dash's length, and read as a double dash.
// They lie on the street's far side (the cover in the far lane, the drain at the far kerb), 2 or more from the poles of
// the lamps, which stand on the near pavement (z 2.1 at most): on the near side they stood at the foot of a lamp.
// The lid has two parallel grooves, and the drain lies 0.8 from it along the kerb, towards the block's middle: a cross
// of bars on a round lid, with the drain beside it, read as a bicycle's wheel lying on the road.
function manhole(out: G[], drain: number): void {
	const [dark, at] = ["#3b3942", drain];
	const gully = at + (at < 0 ? 0.8 : -0.8);
	out.push(
		cyl(dark, 0.28, 0.28, MARK, at, ROAD, 4.5, 16),
		cyl("#6e6b76", 0.22, 0.22, MARK, at, ROAD + 0.02, 4.5, 16),
		...[-0.07, 0.07].map((dz) => b(dark, 0.26, MARK, 0.04, at, ROAD + 0.04, 4.5 + dz, detail(0.04))),
		b(dark, 0.42, MARK, 0.2, gully, ROAD, 4.9),
		...[-0.12, 0, 0.12].map((dx) => b("#77747f", 0.04, MARK, 0.14, gully + dx, ROAD + 0.02, 4.9, detail(0.04))),
	);
}

// The street ends in a low wall where the island does, between its two kerbs; the front edge gets one too, but
// leaves the river's way open.
function ends(out: G[], avenue: boolean, river: boolean, rim: Rim, channel: Channel | undefined): void {
	// The road ends on paving, not on the grass: a paved apron between the kerbs, under the wall, as high as the pavement.
	for (const [on, x] of [
		[rim.left && !river, -5.4],
		[rim.right, 5.4],
	] as const)
		if (on) out.push(b("#d6cbbd", 0.28, 0.09, 2.34, x * 1.005, 0, 3.87), b("#b3ada4", 0.22, 0.3, 2.34, x, ROAD, 3.87));
	if (rim.front)
		for (const span of without(-5.5, 5.5, river ? [[-EDGE - 1, 2]] : []))
			out.push(alongX("#b3ada4", span, 0.37, 0.14, 5.48), alongX("#c9c2b8", span, 0.05, 0.18, 5.48, 0.36));
	// The avenue runs along the island's right edge when no block is beyond: the same low wall, but for the street's own
	// (z 2,56 to 5,18) and where the canal leaves (the block of the canal has its own end).
	if (avenue && rim.right && !channel)
		for (const span of without(-5.5, 5.5, [[2.56, 5.18]])) out.push(alongZ("#b3ada4", 0.14, 0.37, span, 5.48), alongZ("#c9c2b8", 0.18, 0.05, span, 5.48, 0.36));
}

export function land(r: () => number, avenue = false, river = false, rim: Rim = {}, channel?: Channel, cover = true, lawn: Lawn = LAWN, drain = -3.35): G[] {
	const layer: Layer = (hex, y, h, x, z) =>
		channel ? banks(hex, y, h, x, z, channel.course, channel.across) : [b(hex, x[1] - x[0], h, z[1] - z[0], (x[0] + x[1]) / 2, y, (z[0] + z[1]) / 2)];
	const out: G[] = [];
	ground(out, r, rim, channel, lawn, layer);
	street(out, avenue, river, rim);
	if (!river && cover) manhole(out, drain);
	ends(out, avenue, river, rim, channel);
	return out;
}
