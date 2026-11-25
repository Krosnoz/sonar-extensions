// The decor buildings of a project's town, readable as in the reference dioramas: a ground floor
// that stands out (shop window, sign or awning, door), windows in columns, a pale parapet round a flat roof and its
// machines, or a real sloping roof; and one detail per family: fire escape, balconies, shutters, lit signs. Front face
// in +z (the street), then +x, -z (the back) and -x: the camera turns round the town, every face shows; each carries its
// windows, but for a party wall hidden by a neighbour too close.
import type { Style } from "../../shared/styles";
import { cornice, groundSides, roomFor, shop } from "./facades-ground";
import { roof, roofKindOf } from "./facades-roofs";
import { FLOOR, GROUND, IRON, SIGNS, faceAt, fine, glassOf, pick, shade, windowPhase, type Look, type Spec } from "./facades-kit";
import { THREE, merge } from "../render/nodes";
import { b, detail, flat, piece, type G } from "../render/shapes";

// A house's look, drawn from its own random source. An awning on at most one house in three that has a shop.
function lookOf(style: Style, r: () => number): Look {
	const ground = r() < 0.5 ? "shop" : r() < 0.5 ? "arch" : "home";
	return {
		bay: 0.74 + r() * 0.6,
		pane: pick([0.34, 0.42, 0.5], r),
		high: pick([0.5, 0.56, 0.6], r),
		pairs: r() < 0.3,
		balcony: r() < (style.name === "riverside" ? 0.65 : 0.4) ? (r() < 0.5 ? 1 : 2) : 0,
		cornice: pick<Look["cornice"]>([0, 1, 2, 3], r),
		ground,
		awning: ground === "shop" && r() < 0.3,
		door: r() < 0.5 ? 1 : -1,
		bands: r() < 0.7,
	};
}

// How far a house reaches beyond its walls: `side` on each side of its width (roof, trims, side windows) and `depth`
// behind it. A row leaves between two houses the sum of their `side` and a little air.
export const overhang = (style: Style, kind: Spec["kind"]): { side: number; depth: number } => {
	const roofKind = roofKindOf(style, kind);
	return { side: Math.max(0.07, roofKind === "tiles" ? 0.17 : roofKind === "steep" ? 0.12 : 0), depth: roofKind === "tiles" ? 0.2 : 0.1 };
};

// A balcony `w` wide at `u`, on the storey whose floor is at `y`, out of the wall's plane `off`: a stone slab, and an
// iron railing of a hand rail on posts about 0.45 apart, returned to the wall at both ends. A railing of one solid plate
// read from afar as a black bar across the facade. The iron is a fine detail, left out from afar (../render/part-material.ts).
const railing = (bw: number, h: number, d: number, x: number, at: number, z: number): G => b(IRON, bw, h, d, x, at, z, detail(0.04));
function balcony(w: number, u: number, y: number, off: number): G[] {
	const posts = Math.max(1, Math.round(w / 0.45));
	return [
		b("#d8cfc0", w, 0.05, 0.26, u, y + 0.16, off + 0.12),
		railing(w, 0.04, 0.04, u, y + 0.41, off + 0.23),
		...[-1, 1].map((side) => railing(0.04, 0.04, 0.22, u + side * (w / 2 - 0.02), y + 0.41, off + 0.1)),
		...Array.from({ length: posts + 1 }, (_, at) => railing(0.04, 0.2, 0.04, u - w / 2 + 0.02 + (at * (w - 0.04)) / posts, y + 0.21, off + 0.23)),
	];
}

// A fire escape's storey on a face `width` wide, in front of the bay at `u` (`step` wide), on the storey whose floor is at
// `y`: a landing, its rail on posts returned to the wall, and from the landing below a stair (a stringer and its treads).
// Everything stays within the face, short of its corner pilasters (0.12): a landing 0.9 times the bay's step, at the bay's
// end, overhung the corner, and its tilted ladder crossed it; from the side the iron read as a black scribble.
const ESCAPE = { inset: 0.14, least: 0.8, most: 1.05, deep: 0.38, rail: 0.36 };
const escapeFits = (width: number, step: number): boolean => Math.min(step - 0.12, ESCAPE.most) >= ESCAPE.least && width - 2 * ESCAPE.inset >= ESCAPE.least;
// A bar of the fire escape: a fine detail as thin as its thinnest side.
const iron = (w: number, h: number, d: number, x: number, at: number, z: number, turn?: [number, number, number]): G =>
	b(IRON, w, h, d, x, at, z, detail(Math.min(w, h, d)), turn);
function escape(width: number, step: number, u: number, y: number, off: number, below: boolean): G[] {
	const w = Math.min(step - 0.12, ESCAPE.most);
	const half = width / 2 - ESCAPE.inset - w / 2;
	const x = Math.max(-half, Math.min(half, u));
	const [floor, front] = [y + 0.16, off + ESCAPE.deep];
	const posts = Math.max(2, Math.round(w / 0.35));
	const out: G[] = [
		// The landing, its rail along the front and returned to the wall at both ends.
		b(IRON, w, 0.04, ESCAPE.deep, x, floor, off + ESCAPE.deep / 2),
		iron(w, 0.04, 0.04, x, floor + ESCAPE.rail, front - 0.02),
		...[-1, 1].map((side) => iron(0.04, 0.04, ESCAPE.deep - 0.04, x + side * (w / 2 - 0.02), floor + ESCAPE.rail, off + ESCAPE.deep / 2)),
		...Array.from({ length: posts + 1 }, (_, at) => iron(0.03, ESCAPE.rail, 0.03, x - w / 2 + 0.02 + (at * (w - 0.04)) / posts, floor + 0.04, front - 0.02)),
	];
	if (!below) return out;
	// The stair from the landing below: it rises across the landing's width, behind the rail, in front of the wall.
	const [run, rise] = [w - 0.12, FLOOR - 0.04];
	const [slope, z] = [Math.atan2(rise, run), off + 0.2];
	out.push(iron(Math.hypot(run, rise), 0.05, 0.03, x, floor - FLOOR + 0.04 + rise / 2 - 0.025, z + 0.1, [0, 0, slope]));
	const treads = 5;
	for (let at = 1; at < treads; at++) out.push(iron(0.16, 0.03, 0.2, x - run / 2 + (at * run) / treads, floor - FLOOR + 0.04 + (at * rise) / treads - 0.03, z));
	return out;
}

// A window's glass on the face whose plane is at z = off.
type Glass = (w: number, h: number, u: number, y: number) => G;

// A tower's storeys: a band of glass a floor, cut by thin mullions.
function towerStoreys(s: Spec, look: Look, width: number, off: number, glass: Glass): G[] {
	const out: G[] = [];
	const band = look.high + 0.1;
	for (let floor = 0; floor < s.floors; floor++) {
		const y = GROUND + floor * FLOOR;
		out.push(glass(width - 0.16, band, 0, y + 0.2), fine(s.trim, width - 0.02, 0.08, 0, y + 0.06, off));
		const bays = Math.round(width / (0.5 + look.bay * 0.3));
		for (let bay = 1; bay < bays; bay++) out.push(fine(shade(s.trim, 0.9), 0.08, band + 0.02, -width / 2 + (bay * width) / bays, y + 0.19, off));
	}
	return out;
}

// What a face's windows share: their columns, their size, and the column the fire escape takes (-1: none).
type Bays = {
	style: Style;
	s: Spec;
	look: Look;
	width: number;
	off: number;
	front: boolean;
	step: number;
	w: number;
	h: number;
	pairs: boolean;
	escaped: number;
	glass: Glass;
};

// The fire escape takes the last column of a brick house's front, when its landing has room in the face and a stair
// leads to it (two storeys at least).
const escapedBay = (style: Style, s: Spec, width: number, step: number, bays: number, front: boolean): number =>
	front && style.name === "brick" && s.kind !== "tower" && bays > 1 && s.r() < 0.6 && s.floors > 1 && escapeFits(width, step) ? bays - 1 : -1;

// The window of column `bay` on storey `floor` (its floor at `y`): glass, sill and lintel, shutters, fire escape, balcony.
function windowAt(out: G[], f: Bays, floor: number, bay: number, y: number): void {
	const { style, s, look, width, off, front, step, w, h, pairs, escaped, glass } = f;
	const u = -width / 2 + (bay + 0.5) * step + (pairs ? (bay % 2 ? -1 : 1) * step * 0.12 : 0);
	out.push(glass(w, h, u, y + 0.24), fine(s.trim, w + 0.1, 0.08, u, y + 0.16, off), fine(shade(s.wall, 0.78), w + 0.08, 0.08, u, y + 0.24 + h, off));
	if (style.name === "sun" && front) {
		const shutter = pick(["#4f8a6b", "#3f6fb0", "#7b9a52"], s.r);
		out.push(fine(shutter, 0.13, h, u - w / 2 - 0.08, y + 0.24, off), fine(shutter, 0.13, h, u + w / 2 + 0.08, y + 0.24, off));
	}
	if (bay === escaped) out.push(...escape(width, step, u, y, off, floor > 0));
	// A small balcony under every other window of the storeys above the first.
	if (front && escaped < 0 && look.balcony === 2 && floor > 0 && bay % 2 === 0) out.push(...balcony(Math.min(step * 0.85, 0.8), u, y, off));
}

// The windows of storey `floor` (its floor at `y`), then its long balcony and its band.
function storeyAt(out: G[], f: Bays, bays: number, floor: number): void {
	const { style, s, look, width, off, front, escaped } = f;
	const y = GROUND + floor * FLOOR;
	for (let bay = 0; bay < bays; bay++) windowAt(out, f, floor, bay, y);
	// A wrought iron balcony along the second and the last storeys, 0.3 short of each end of the face: it stands 0.25
	// out of the wall, and from the camera's side a balcony as wide as the wall overhung its edge and the neighbour.
	if (front && escaped < 0 && look.balcony === 1 && (floor === 1 || floor === s.floors - 1)) out.push(...balcony(width - 0.6, 0, y, off));
	if (style.name !== "neon" && look.bands && floor > 0) out.push(fine(s.trim, width + 0.04, 0.08, 0, y, off));
}

// The windows of the storeys on a face `width` wide whose plane is at z = off; `front` adds the family's details.
function storeys(style: Style, s: Spec, width: number, off: number, front: boolean, columns?: number): G[] {
	const out: G[] = [];
	const glass: Glass = (w, h, u, y) => flat(b(glassOf(style), w, h, 0.04, u, y, off, windowPhase(s.r)));
	const look = s.look!;
	if (s.kind === "tower" && style.name !== "riverside") return towerStoreys(s, look, width, off, glass);
	const bays = columns ?? Math.max(1, Math.round(width / look.bay));
	const step = width / bays;
	// Windows in pairs, each pair closer to its own middle, on a front or a back whose bays come two by two.
	const pairs = look.pairs && columns === undefined && bays % 2 === 0;
	// The outer windows stay clear of the corner pilasters (0.12 wide).
	const [w, h] = [Math.min(look.pane, step * (pairs ? 0.4 : 0.5), step - 0.34), look.high];
	const escaped = escapedBay(style, s, width, step, bays, front);
	const f: Bays = { style, s, look, width, off, front, step, w, h, pairs, escaped, glass };
	for (let floor = 0; floor < s.floors; floor++) storeyAt(out, f, bays, floor);
	// Pilasters at the corners.
	if (style.name === "riverside" || style.name === "brick")
		for (const u of [-width / 2 + 0.06, width / 2 - 0.06]) out.push(fine(s.trim, 0.12, s.floors * FLOOR - 0.04, u - Math.sign(u) * 0.01, GROUND, off));
	return out;
}

// The accent's band of a tower: a 0.12 high frame laid on top of the walls, round the roof, above the last windows.
const crown = (style: Style, s: Spec, top: number): G[] => [
	b(style.accent, s.w + 0.08, 0.12, 0.12, 0, top, s.d / 2 - 0.02),
	b(style.accent, s.w + 0.08, 0.12, 0.12, 0, top, -s.d / 2 + 0.02),
	b(style.accent, 0.12, 0.12, s.d - 0.08, s.w / 2 - 0.02, top, 0),
	b(style.accent, 0.12, 0.12, s.d - 0.08, -s.w / 2 + 0.02, top, 0),
];

// A prism of the footprint `points` (x, z), from y to y + h.
function prism(hex: string, points: [number, number][], h: number, y: number): G {
	const shape = new THREE.Shape(points.map(([x, z]) => new THREE.Vector2(x, -z)));
	return piece(new THREE.ExtrudeGeometry(shape, { depth: h, bevelEnabled: false }).rotateX(-Math.PI / 2), hex, 0, 0, y, 0);
}

// The footprint of a house with its +x +z corner cut by `c` on each side, grown by `grow` all round.
const cutFootprint = (w: number, d: number, c: number, grow = 0): [number, number][] => {
	const [x, z, k] = [w / 2 + grow, d / 2 + grow, c + grow * (2 - Math.SQRT2)];
	return [
		[-x, -z],
		[x, -z],
		[x, z - k],
		[x - k, z],
		[-x, z],
	];
};

// A house on a corner: the +x +z corner is cut at 45°, and the shop's door and a sign stand on the cut, with a window
// along each of the two faces beside it. The storeys above carry their windows on the cut too.
function corner(style: Style, s: Spec): G[] {
	const c = Math.min(1, s.d * 0.4, s.w * 0.35);
	const [length, rise, top] = [c * Math.SQRT2, s.floors * FLOOR, GROUND + s.floors * FLOOR];
	const [cx, cz] = [s.w / 2 - c / 2, s.d / 2 - c / 2];
	const onCut = (parts: G[]): G =>
		merge(parts)
			.rotateY(Math.PI / 4)
			.translate(cx, 0, cz);
	const glass = (w: number, h: number, u: number, y: number, off: number): G => b(glassOf(style), w, h, 0.04, u, y, off, windowPhase(s.r));
	const colour = pick(SIGNS, s.r);
	const [front, right] = [s.w - c, s.d - c];
	const out: G[] = [prism(shade(s.wall, 0.82), cutFootprint(s.w, s.d, c, 0.01), GROUND, 0), prism(s.wall, cutFootprint(s.w, s.d, c), rise, GROUND)];
	// The shop: a window and a sign band on each of the two faces, and on the cut a door, a sign and a lamp.
	const shopFace = (width: number, off: number): G[] => [
		glass(width - 0.5, 0.78, 0, 0.22, off + 0.005),
		fine(IRON, width - 0.4, 0.08, 0, 1.0, off),
		fine(IRON, width - 0.4, 0.08, 0, 0.14, off),
		b(colour, width - 0.4, 0.24, 0.06, 0, 1.1, off + 0.04),
	];
	out.push(
		merge(shopFace(front, s.d / 2)).translate(-c / 2, 0, 0),
		merge(shopFace(right, s.w / 2))
			.rotateY(Math.PI / 2)
			.translate(0, 0, -c / 2),
	);
	out.push(
		onCut([
			b("#6e4a32", 0.5, 0.92, 0.05, 0, 0.06, 0.01),
			b(s.trim, 0.6, 0.06, 0.08, 0, 0.98, 0.02),
			b(colour, length - 0.2, 0.24, 0.06, 0, 1.1, 0.03),
			b("#cfc4b6", 0.7, 0.06, 0.2, 0, 0, 0.1),
			glass(0.26, 0.5, 0.3, 0.3, 0.012),
			glass(0.26, 0.5, -0.3, 0.3, 0.012),
		]),
	);
	// The storeys: the front and the right faces keep their columns, the cut has one window a floor.
	out.push(
		...storeys(style, s, front, s.d / 2, true).map((part) => part.translate(-c / 2, 0, 0)),
		merge(storeys(style, s, right, s.w / 2, false))
			.rotateY(Math.PI / 2)
			.translate(0, 0, -c / 2),
		onCut(storeys(style, s, length, 0, false, 1)),
	);
	const open = roomFor(s);
	out.push(faceAt(storeys(style, s, s.w, s.d / 2, false), Math.PI), ...groundSides(style, s, [open[0], false]));
	if (open[0]) out.push(faceAt(storeys(style, s, s.d, s.w / 2, false), -Math.PI / 2));
	// A flat roof behind its parapet that follows the cut, and its machines in the back corner.
	const rim = shade(s.trim, 1.04);
	const inset = cutFootprint(s.w - 0.3, s.d - 0.3, c - 0.15 * (2 - Math.SQRT2));
	out.push(
		prism(shade(s.roof, 1.25), inset, 0.06, top),
		b(rim, front + 0.03, 0.26, 0.14, (-s.w / 2 - 0.03 + (s.w / 2 - c)) / 2, top, s.d / 2 - 0.04),
		b(rim, 0.14, 0.26, right + 0.03, s.w / 2 - 0.04, top, (-s.d / 2 - 0.03 + (s.d / 2 - c)) / 2),
		b(rim, s.w + 0.06, 0.26, 0.14, 0, top, -s.d / 2 + 0.04),
		b(rim, 0.14, 0.26, s.d, -s.w / 2 + 0.04, top, 0),
		b(rim, length, 0.26, 0.14, cx - 0.03, top, cz - 0.03, 0, [0, Math.PI / 4, 0]),
		b("#9aa0a8", 0.5, 0.36, 0.5, -s.w / 4, top + 0.06, -s.d / 4),
		b("#c9ccd4", 0.44, 0.3, 0.38, -s.w / 4 + 0.75, top + 0.06, -s.d / 4),
	);
	return out;
}

// A tower steps back above a third of its height, and wears a crown.
export function building(style: Style, s: Spec): G[] {
	s.look ??= lookOf(style, s.r);
	if (s.corner) return corner(style, s);
	const volume = (v: Spec, y0: number): G[] => {
		const height = v.floors * FLOOR;
		const out: G[] = [b(v.wall, v.w, height, v.d, 0, y0, 0)];
		const moved = (parts: G[]): G[] => parts.map((part) => part.translate(0, y0 - GROUND, 0));
		// A side face has windows only where its neighbour leaves air; a stepped volume gains what it stands back.
		const open = roomFor(s, (s.w - v.w) / 2);
		out.push(...moved(storeys(style, v, v.w, v.d / 2, true)), ...moved([faceAt(storeys(style, v, v.w, v.d / 2, false), Math.PI)]));
		if (open[1]) out.push(...moved([faceAt(storeys(style, v, v.d, v.w / 2, false), Math.PI / 2)]));
		if (open[0]) out.push(...moved([faceAt(storeys(style, v, v.d, v.w / 2, false), -Math.PI / 2)]));
		return out;
	};
	const out: G[] = [...shop(style, s)];
	if (s.kind === "tower" && s.floors > 8) {
		const low = Math.floor(s.floors * 0.55);
		const upper: Spec = { ...s, w: s.w * 0.72, d: s.d * 0.78, floors: s.floors - low };
		out.push(...volume({ ...s, floors: low }, GROUND), b(s.trim, s.w + 0.1, 0.14, s.d + 0.1, 0, GROUND + low * FLOOR, 0));
		const top = GROUND + s.floors * FLOOR;
		out.push(...volume(upper, GROUND + low * FLOOR), ...roof(style, upper, top), ...crown(style, upper, top));
		return out;
	}
	out.push(...volume(s, GROUND), ...roof(style, s, GROUND + s.floors * FLOOR));
	const eaves = ["tiles", "steep"].includes(roofKindOf(style, s.kind));
	if (s.kind !== "tower" && !eaves) out.push(...cornice(s, GROUND + s.floors * FLOOR));
	return out;
}
