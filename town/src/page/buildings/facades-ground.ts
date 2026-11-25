// A house's ground floor and its cornice: the shop's window, sign or awning, the carriage door, the dwelling's door and
// flower boxes, the windows of the sides and the back, and the band under the roof.
import type { Style } from "../../shared/styles";
import { FLOOR, GROUND, IRON, SIDE_MIN, SIGNS, faceAt, fine, glassOf, pick, shade, windowPhase, type Spec } from "./facades-kit";
import { b, detail, type G } from "../render/shapes";

// The ground floor's sides and back, in the frame of a +z face turned to its place: a window on a side that has room, and
// at the back a service door, a window and a basement grate. `across` is the face's width.
function groundFace(style: Style, s: Spec, across: number, off: number, back: boolean): G[] {
	const glass = (w: number, h: number, u: number, y: number): G => b(glassOf(style), w, h, 0.04, u, y, off, windowPhase(s.r));
	const frame = (u: number, w: number): G[] => [fine(s.trim, w + 0.1, 0.08, u, 0.44, off), fine(shade(s.wall, 0.78), w + 0.08, 0.08, u, 1.1, off)];
	const out: G[] = [glass(0.46, 0.58, -across / 4, 0.52), ...frame(-across / 4, 0.46)];
	if (back) {
		out.push(b("#6e4a32", 0.42, 0.92, 0.05, across / 4, 0.06, off + 0.01), b(s.trim, 0.52, 0.06, 0.08, across / 4, 0.98, off + 0.02));
		if (across > 2.6) out.push(glass(0.46, 0.58, 0, 0.52), ...frame(0, 0.46));
	} else out.push(glass(0.34, 0.16, across / 4, 0.1), b(IRON, 0.42, 0.04, 0.06, across / 4, 0.26, off + 0.02));
	return out;
}

// The windows of the ground floor on the three faces other than the front: the back always, a side when it is free.
export function groundSides(style: Style, s: Spec, open: [boolean, boolean]): G[] {
	const out: G[] = [faceAt(groundFace(style, s, s.w, s.d / 2 + 0.01, true), Math.PI)];
	if (open[1]) out.push(faceAt(groundFace(style, s, s.d, s.w / 2 + 0.01, false), Math.PI / 2));
	if (open[0]) out.push(faceAt(groundFace(style, s, s.d, s.w / 2 + 0.01, false), -Math.PI / 2));
	return out;
}

// Whether the air beside a house, on each side, leaves room for windows.
export const roomFor = (s: Spec, inset = 0): [boolean, boolean] => [
	(s.gaps?.[0] ?? Infinity) + inset >= SIDE_MIN,
	(s.gaps?.[1] ?? Infinity) + inset >= SIDE_MIN,
];

const DOORS = ["#6e4a32", "#4f6f5a", "#7a3f3f", "#3f5470", "#5a4a40"];

// A window of a ground floor wall, with its frame and sill.
function groundWindow(style: Style, s: Spec, u: number, w: number, off: number): G[] {
	return [
		b(glassOf(style), w, 0.58, 0.04, u, 0.52, off, windowPhase(s.r)),
		fine(s.trim, w + 0.1, 0.08, u, 0.44, off),
		fine(shade(s.wall, 0.78), w + 0.08, 0.08, u, 1.1, off),
	];
}

// A carriage door: two leaves in a frame of the trim, under a lintel, with a step, and a small window on each side that
// has room for it.
function archway(style: Style, s: Spec, x: number, off: number): G[] {
	const door = 0.96;
	const out: G[] = [
		b("#4a3426", door, 1, 0.05, x, 0.06, off + 0.012),
		b("#2c1f17", 0.025, 0.98, 0.06, x, 0.06, off + 0.014),
		b("#c9a24a", 0.05, 0.05, 0.04, x - 0.08, 0.55, off + 0.05),
		b("#c9a24a", 0.05, 0.05, 0.04, x + 0.08, 0.55, off + 0.05),
		...[-1, 1].map((side) => b(s.trim, 0.1, 1.1, 0.08, x + side * (door / 2 + 0.05), 0.06, off + 0.02)),
		b(s.trim, door + 0.3, 0.1, 0.1, x, 1.12, off + 0.03),
		b(shade(s.trim, 0.85), 0.14, 0.12, 0.12, x, 1.22, off + 0.03),
		b("#cfc4b6", door + 0.3, 0.05, 0.2, x, 0.01, off + 0.1),
	];
	for (const side of [-1, 1]) {
		const u = x + side * (door / 2 + 0.5);
		if (Math.abs(u) + 0.26 < s.w / 2) out.push(...groundWindow(style, s, u, 0.34, off));
	}
	return out;
}

// A dwelling's ground floor: a door with a step and a plate, and a window or two with a flower box.
function dwelling(style: Style, s: Spec, off: number): G[] {
	const side = s.look!.door;
	const door = side * (s.w / 2 - 0.42);
	const out: G[] = [
		b(pick(DOORS, s.r), 0.42, 0.92, 0.05, door, 0.06, off + 0.01),
		b(s.trim, 0.52, 0.06, 0.08, door, 0.98, off + 0.02),
		b("#cfc4b6", 0.62, 0.05, 0.18, door, 0.01, off + 0.09),
		b("#ffe7a0", 0.1, 0.14, 0.1, door + side * 0.34, 0.8, off + 0.04, 4),
	];
	const [near, far] = [-side * 0.3, -side * 1.1];
	for (const u of s.w > 2.8 ? [near, far] : [near]) {
		out.push(...groundWindow(style, s, u, 0.46, off), b("#8a5f3a", 0.54, 0.1, 0.14, u, 0.34, off + 0.08));
		for (let n = 0; n < 3; n++) out.push(b(pick(["#ff6f91", "#ffd166", "#ffffff", "#4aaa55"], s.r), 0.07, 0.07, 0.07, u - 0.16 + n * 0.16, 0.44, off + 0.08));
	}
	return out;
}

// The ground floor: a darker base, a shop window, a door, and a sign board or a striped awning; a lit sign in the
// neon family.
export function shop(style: Style, s: Spec): G[] {
	const off = s.d / 2;
	const look = s.look!;
	const base = b(shade(s.wall, 0.82), s.w + 0.02, GROUND, s.d + 0.02, 0, 0, 0);
	if (look.ground !== "shop")
		return [
			base,
			...(look.ground === "arch" ? archway(style, s, look.door * Math.min(0.3, s.w * 0.12), off) : dwelling(style, s, off)),
			...groundSides(style, s, roomFor(s)),
		];
	// The window stays inside the wall, on the door's other side: from -0.35 - glassW / 2 - 0.05 to the door's edge.
	const glassW = Math.min(Math.max(0.6, s.w - 1.1), s.w - 1);
	const [side, gx] = [look.door, -look.door * 0.35];
	const colour = pick(SIGNS, s.r);
	const out: G[] = [
		base,
		b(glassOf(style), glassW, 0.78, 0.04, gx, 0.22, off + 0.005, windowPhase(s.r)),
		fine(IRON, glassW + 0.1, 0.08, gx, 1.0, off),
		fine(IRON, glassW + 0.1, 0.08, gx, 0.14, off),
		b("#6e4a32", 0.42, 0.92, 0.05, side * (s.w / 2 - 0.42), 0.06, off + 0.01),
		b(s.trim, 0.52, 0.06, 0.08, side * (s.w / 2 - 0.42), 0.98, off + 0.02),
		...groundSides(style, s, roomFor(s)),
	];
	if (!look.awning) {
		// A plain sign board: the letters, lit by intervals, read as dashes from afar.
		out.push(b(colour, glassW + 0.1, 0.24, 0.06, gx, 1.1, off + 0.04));
	} else {
		// The canvas in its colour, a little thinner, under its pale stripes: from afar the stripes are left out
		// (../render/shapes.ts#detail) and the awning is one colour. Two stripes of 2 pixels blinked as the town turned.
		const stripes = Math.max(2, Math.round(glassW / 0.2));
		const wide = glassW / stripes;
		out.push(b(colour, glassW - 0.01, 0.03, 0.53, gx, 1.125, off + 0.26, 0, [0.42, 0, 0]));
		for (let n = 1; n < stripes; n += 2)
			out.push(b("#f6efe2", wide, 0.04, 0.55, gx - glassW / 2 + (n + 0.5) * wide, 1.12, off + 0.26, detail(wide, 3), [0.42, 0, 0]));
	}
	if (style.name === "neon" && s.r() < 0.75)
		out.push(
			b(
				pick(["#ff4f6d", "#35c2ff", "#ffd23f", "#7cff8a"], s.r),
				0.12,
				Math.min(2.6, s.floors * FLOOR),
				0.4,
				side * (s.w / 2 - 0.08),
				GROUND + 0.15,
				off + 0.24,
				4,
			),
		);
	return out;
}

// The cornice under a flat or mansard roof: none, a thin band, a deep one with a row of teeth along the front and the
// back, or a frieze of the wall's shade. A pitched roof overhangs more and hides it.
export function cornice(s: Spec, top: number): G[] {
	const [kind, x, z] = [s.look!.cornice, s.w, s.d];
	if (kind === 1) return [b(s.trim, x + 0.08, 0.07, z + 0.08, 0, top - 0.08, 0)];
	if (kind === 3) return [b(shade(s.wall, 0.9), x + 0.04, 0.14, z + 0.04, 0, top - 0.15, 0), b(s.trim, x + 0.08, 0.03, z + 0.08, 0, top - 0.05, 0)];
	if (kind !== 2) return [];
	const teeth = Math.max(2, Math.round(x / 0.2));
	return [
		b(s.trim, x + 0.12, 0.09, z + 0.12, 0, top - 0.11, 0),
		...Array.from({ length: teeth }, (_, n) => -x / 2 + (n + 0.5) * (x / teeth)).flatMap((u) =>
			[1, -1].map((face) => b(shade(s.trim, 0.85), 0.09, 0.04, 0.05, u, top - 0.15, face * (z / 2 + 0.03))),
		),
	];
}
