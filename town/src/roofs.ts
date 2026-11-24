// The buildings' roofs: slate with dormers and chimneys, a flat roof with its machines, tiles with a gable.
import { THREE, merge } from "./nodes";
import { muted } from "./street";
import { BD, BW, b, ball, blob, cyl, piece, rnd, turned, type G } from "./shapes";

// A mansard's tones (its slope, its upper slope and dormer caps, its ridge): slate, grey zinc, verdigris, tile, brown.
// A subject's name draws one (./looks.ts#looksOf): the large buildings were all slate blue, a wall over the town.
export const MANSARDS = [
	["#56637a", "#4a566b", "#6b7890"],
	["#7d8590", "#6c737d", "#959ca5"],
	["#6f9a8b", "#5d8577", "#86ad9f"],
	["#b0614a", "#97513d", "#c27863"],
	["#7a5f52", "#674f44", "#8e7366"],
] as const;

function slate(r: () => number, tone = 0): G[] {
	const [slope, upper, ridge] = MANSARDS[tone]!;
	const out: G[] = [
		b(slope, BW + 0.2, 0.62, BD + 0.2, 0, 0, 0),
		b(upper, BW - 0.34, 0.3, BD - 0.34, 0, 0.62, 0),
		b(ridge, BW - 0.9, 0.08, BD - 0.9, 0, 0.92, 0),
		b("#aeb6bf", BW - 0.3, 0.04, BD - 0.3, 0, 0.6, 0),
	];
	const dormer = (u: number, off: number): G[] => [
		b("#f3ead9", 0.5, 0.5, 0.3, u, 0.08, off),
		b("#39485f", 0.3, 0.34, 0.04, u, 0.14, off + 0.14, 6 + r() * 0.49),
		b(upper, 0.6, 0.07, 0.4, u, 0.58, off),
		b("#f3ead9", 0.03, 0.36, 0.03, u, 0.13, off + 0.16),
	];
	out.push(...[-1.9, 0, 1.9].flatMap((u) => dormer(u, BD / 2)), turned([-0.85, 0.85].flatMap((u) => dormer(u, BW / 2))));
	// A chimney stands 0.5 at least, and 0.25 of the half size, from the edge of the slab it shows over: the ridge slab
	// (x ±2.55, z ±1.4), the highest one. Seen from above, at z -0.8 it sat on the slab's back edge.
	for (const [x, z] of [
		[-1.6, -0.6],
		[1.5, -0.62],
	] as const)
		out.push(
			b("#b5654a", 0.5, 0.95, 0.34, x, 0.6, z),
			b("#8f4a36", 0.58, 0.06, 0.42, x, 1.55, z),
			...[-0.14, 0, 0.14].map((dx) => cyl("#c8643c", 0.05, 0.06, 0.16, x + dx, 1.61, z, 6)),
		);
	return out;
}

// The flat roofs: six of them, so that two buildings side by side do not carry the same terrace. The surface is the same,
// the parapet changes its colour and its height, and the things on it: 0 the classic (air conditioners, tank, stairs' hut,
// antenna, solar panels, pots), 1 bare (a hut and a unit), 2 units, antenna and panels, 3 a greenhouse, 4 a roof garden,
// 5 a field of solar panels.
export const FLATS = 6;
const PARAPETS = ["#e2dccf", "#e9e4da", "#d8c8ae", "#bfae9a", "#e2dccf", "#c4c9cf"];

const unit = (x: number, z: number): G[] => [
	b("#c9ccd4", 0.6, 0.36, 0.5, x, 0.08, z),
	cyl("#4d5563", 0.18, 0.18, 0.03, x, 0.44, z, 10),
	b("#6b7079", 0.5, 0.06, 0.03, x, 0.2, z + 0.26),
];
const tank = (x: number, z: number): G[] => [
	...[-1, 1].flatMap((sx) => [-1, 1].map((sz) => b("#4d5563", 0.06, 0.45, 0.06, x + sx * 0.3, 0.08, z + sz * 0.3))),
	cyl("#9b6a44", 0.46, 0.46, 0.7, x, 0.53, z, 10),
	cyl("#7a5234", 0.5, 0.5, 0.05, x, 0.75, z, 10),
	piece(new THREE.ConeGeometry(0.52, 0.3, 10), "#5f6b7a", 0, x, 1.38, z),
];
const hut = (wall: string, x: number, z: number): G[] => [
	b(wall, 1, 0.85, 0.9, x, 0.08, z),
	b("#8d877d", 1.14, 0.07, 1.04, x, 0.93, z),
	b("#6b7079", 0.36, 0.62, 0.04, x, 0.08, z + 0.46),
];
// A roof's television aerial, on its foot at (x, y, z): a mast, and on its top a boom along x that carries five rods
// across it, shorter towards one end. From above it reads as a fishbone, from the side as a T. A mast with two bars
// across it, below its top, read from above as a small black figure. It takes 0.7 along x, 0.46 along z.
export const AERIAL = { long: 0.7, wide: 0.46 };
export function aerial(x: number, y: number, z: number): G[] {
	const dark = "#23262d";
	const top = y + 1.1;
	return [
		b("#6b7079", 0.22, 0.04, 0.22, x, y, z),
		b(dark, 0.06, top - y - 0.04, 0.06, x, y + 0.04, z),
		b(dark, AERIAL.long, 0.06, 0.06, x, top, z),
		// The rods stand 0.005 under the boom's top and over its bottom: no face in one plane with the boom's.
		...[0, 1, 2, 3, 4].map((at) => b(dark, 0.045, 0.05, AERIAL.wide - at * 0.06, x - 0.3 + at * 0.15, top + 0.005, z)),
	];
}
const antenna = (x: number, z: number): G[] => [...aerial(x, 0.08, z), piece(ball(0.2, 1, 0.3, 1), "#e9edf2", 0, x - 0.9, 0.5, z, [0.7, 0, 0])];
// A row of `count` panels, 0.7 apart from x0, their middle at z + 0.25.
const panels = (x0: number, z: number, count: number): G[] =>
	Array.from({ length: count }, (_, at) => [
		b("#24407a", 0.62, 0.04, 0.9, x0 + at * 0.7, 0.3, z + 0.25, 0, [0.5, 0, 0]),
		b("#aeb6bf", 0.02, 0.05, 0.9, x0 + at * 0.7, 0.31, z + 0.25, 0, [0.5, 0, 0]),
		b("#6b7079", 0.5, 0.22, 0.05, x0 + at * 0.7, 0.08, z),
	]).flat();

function flat(variant: number): G[] {
	const wall = PARAPETS[variant]!;
	const rim = variant === 3 ? 0.46 : variant === 1 ? 0.4 : 0.3;
	const out: G[] = [
		b("#a8a39a", BW, 0.08, BD, 0, 0, 0),
		b(wall, BW + 0.12, rim, 0.14, 0, 0, BD / 2),
		b(wall, BW + 0.12, rim, 0.14, 0, 0, -BD / 2),
		b(wall, 0.14, rim, BD, BW / 2, 0, 0),
		b(wall, 0.14, rim, BD, -BW / 2, 0, 0),
	];
	if (variant === 0) {
		out.push(...unit(1.9, 0.9), ...unit(1.1, 0.9), ...tank(-2, -0.7), ...hut(wall, -0.3, -1), ...antenna(2.5, -1.3), ...panels(-1.9, 0.7, 3));
		for (let at = 0; at < 4; at++)
			out.push(cyl("#c8643c", 0.12, 0.09, 0.16, 0.2 + at * 0.26, 0.08, 1.45, 7), blob(at % 2 ? "#4aaa55" : "#3f9d4d", 0.14, 0.2 + at * 0.26, 0.34, 1.45));
	} else if (variant === 1) out.push(...hut(wall, -0.8, -0.6), ...unit(1.9, 0.9));
	else if (variant === 2) out.push(...unit(1.9, 0.9), ...unit(1.1, 0.9), ...antenna(2.5, -1.3), ...panels(-1.9, 0.7, 3), ...panels(-1.9, -0.7, 3));
	else if (variant === 3) {
		// The greenhouse: a pale sill, glass between four posts, a flat top.
		const [x, z, frame] = [-1.4, 0.5, "#f3ead9"];
		out.push(b(frame, 2.4, 0.22, 1.3, x, 0.08, z), b("#b8d4cf", 2.3, 0.62, 1.2, x, 0.3, z), b(frame, 2.4, 0.06, 1.3, x, 0.92, z));
		for (const sx of [-1, 1]) for (const sz of [-1, 1]) out.push(b(frame, 0.07, 0.62, 0.07, x + sx * 1.18, 0.3, z + sz * 0.62));
		out.push(...unit(1.6, 0.9), ...antenna(2.5, -1.3));
	} else if (variant === 4) {
		// The roof garden: a lawn with three raised beds and their shrubs, a bench, and the hut.
		out.push(b(muted("#86b866"), 4, 0.06, 2.4, -0.6, 0.08, 0.2));
		for (const x of [-2.0, -0.6, 0.8])
			out.push(b("#8a5f3a", 0.9, 0.22, 0.5, x, 0.14, 0.6), blob("#4aaa55", 0.3, x, 0.44, 0.6), blob("#57b85c", 0.2, x + 0.22, 0.52, 0.6));
		out.push(
			b("#a8703f", 1.1, 0.05, 0.3, -0.6, 0.34, -0.5),
			b("#2c303b", 0.05, 0.2, 0.28, -1.1, 0.14, -0.5),
			b("#2c303b", 0.05, 0.2, 0.28, -0.1, 0.14, -0.5),
			...hut(wall, 2.2, -1.1),
		);
	} else out.push(...panels(-2.1, 0.5, 4), ...panels(-2.1, -0.7, 4), ...hut(wall, 1.9, -1), ...antenna(2.5, 0.9));
	return out;
}

const prism = (hex: string, long: number, size: number, part: number): G =>
	piece(
		new THREE.CylinderGeometry(size, size, long, 3)
			.rotateZ(Math.PI / 2)
			.rotateX(-Math.PI / 2)
			.scale(1, 0.5, 1),
		hex,
		part,
		0,
		size * 0.25,
		0,
	);

// Rows of tiles on the slope the camera sees, a chimney, two skylights.
function tiles(r: () => number): G[] {
	const radius = (BD / 2 + 0.22) / 0.866;
	const out: G[] = [
		prism("#c8643c", BW + 0.3, radius, 0),
		prism("#ffffff", BW + 0.34, radius * 0.94, 1),
		b("#a84f30", BW + 0.36, 0.08, 0.16, 0, radius * 0.75 - 0.04, 0),
	];
	const slope = Math.atan2(radius * 0.75, radius * 0.866);
	for (let row = 1; row < 6; row++)
		out.push(b("#b2532f", BW + 0.28, 0.03, 0.05, 0, radius * 0.75 * (1 - row / 6) + 0.01, (radius * 0.866 * row) / 6 + 0.02, 0, [slope, 0, 0]));
	out.push(
		b("#b5654a", 0.44, 1.1, 0.4, -1.8, 0.3, -0.7),
		b("#8f4a36", 0.52, 0.06, 0.48, -1.8, 1.4, -0.7),
		cyl("#c8643c", 0.07, 0.08, 0.18, -1.8, 1.46, -0.7, 6),
	);
	for (const u of [-0.6, 1.5])
		out.push(
			b("#39485f", 0.5, 0.04, 0.5, u, radius * 0.36 + 0.02, radius * 0.45 + 0.02, 6 + r() * 0.49, [slope, 0, 0]),
			b("#f3ead9", 0.58, 0.03, 0.58, u, radius * 0.36 + 0.01, radius * 0.45 + 0.01, 0, [slope, 0, 0]),
		);
	return out;
}

// `variant` changes the flat roof (style 1): which of the `FLATS` it is; and the mansard (style 0): which of `MANSARDS`.
export function roof(style: number, variant = 0): G {
	const r = rnd(style + 57);
	return merge(style === 0 ? slate(r, variant) : style === 1 ? flat(variant) : tiles(r));
}

// A roof's own surface (a flat roof's floor, a mansard's or a gable's ridge), the tops [x, y, z] of what stands higher on it
// inside the parapet (a stair hut, a tank, an aerial), the highest per cell of CELL, and the points [x, z] of a flat
// roof's floor clear of those: a subject's anchor is on the bare surface, and its sign stands over those tops, never on them
// (./signs.ts). Its anchor 1.6 over the roof sat on the stair hut, its sign over the water tank.
const CELL = 0.3;
type Crown = { surface: number; tops: [number, number, number][]; bare: [number, number][] };
const crowns = new Map<string, Crown>();
export function crownOf(style: number, variant = 0): Crown {
	const key = `${style} ${variant}`;
	const known = crowns.get(key);
	if (known) return known;
	const surface = style === 0 ? 1 : style === 1 ? 0.08 : ((BD / 2 + 0.22) / 0.866) * 0.75 + 0.04;
	const position = roof(style, variant).getAttribute("position");
	const cells = new Map<string, [number, number, number]>();
	// Only a flat roof carries a hut, a tank, a greenhouse: a mansard's chimneys are its roof's own, which a sign on it
	// covers rather than stand high above its anchor.
	if (style === 1)
		for (let at = 0; at < position.count; at++) {
			const [x, y, z] = [position.getX(at), position.getY(at), position.getZ(at)];
			if (y <= surface + 0.15 || Math.abs(x) > BW / 2 - 0.1 || Math.abs(z) > BD / 2 - 0.1) continue;
			const cell = `${Math.round(x / CELL)} ${Math.round(z / CELL)}`;
			if ((cells.get(cell)?.[1] ?? -Infinity) < y) cells.set(cell, [x, y, z]);
		}
	const tops = [...cells.values()];
	// Only a flat roof's floor is level: off a ridge's middle, a point is lower than the surface said.
	const grid = style === 1 ? [-2.4, -1.2, 0, 1.2, 2.4].flatMap((x) => [-1.2, 0, 1.2].map((z): [number, number] => [x, z])) : [[0, 0] as [number, number]];
	const bare = grid.filter(([x, z]) => !tops.some(([tx, , tz]) => Math.abs(tx - x) < 0.6 && Math.abs(tz - z) < 0.6));
	const made = { surface, tops, bare };
	crowns.set(key, made);
	return made;
}
