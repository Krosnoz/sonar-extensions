// The roofs of the town's houses (./facades.ts): a pitched roof in one of three forms, a mansard, a roof terrace or a flat
// roof behind its parapet with its machines.
import type { Style } from "../../shared/styles";
import { IRON, glassOf, pick, shade, windowPhase, type Spec } from "./facades-kit";
import { THREE } from "../render/nodes";
import { AERIAL, aerial } from "./roofs";
import { b, cyl, piece, type G } from "../render/shapes";

export const roofKindOf = (style: Style, kind: Spec["kind"]): Style["roof"] =>
	style.roof === "mixed" ? (kind === "row" ? "tiles" : "flat") : kind === "tower" ? "flat" : style.roof;

// Free spots on a flat roof: what stands on it never overlaps what is already there, nor the parapet.
function roomOn(s: Spec): (w: number, d: number, px?: number, pz?: number) => [number, number] | null {
	const taken: { x: number; z: number; w: number; d: number }[] = [];
	const [mx, mz] = [s.w / 2 - 0.2, s.d / 2 - 0.2];
	return (w, d, px, pz) => {
		const fits = (x: number, z: number): boolean =>
			Math.abs(x) + w / 2 <= mx &&
			Math.abs(z) + d / 2 <= mz &&
			taken.every((t) => Math.abs(x - t.x) >= (w + t.w) / 2 + 0.08 || Math.abs(z - t.z) >= (d + t.d) / 2 + 0.08);
		const tries: [number, number][] = px === undefined || pz === undefined ? [] : [[px, pz]];
		for (let n = 0; n < 12; n++) tries.push([(s.r() * 2 - 1) * (mx - w / 2), (s.r() * 2 - 1) * (mz - d / 2)]);
		const spot = tries.find(([x, z]) => fits(x, z));
		if (spot) taken.push({ x: spot[0], z: spot[1], w, d });
		return spot ?? null;
	};
}

// A gable: a prism `w` long along x, `d` deep, `h` high, its slopes towards ±z.
function gable(hex: string, w: number, d: number, h: number, y: number): G {
	const shape = new THREE.Shape([new THREE.Vector2(-d / 2, 0), new THREE.Vector2(d / 2, 0), new THREE.Vector2(0, h)]);
	const solid = new THREE.ExtrudeGeometry(shape, { depth: w, bevelEnabled: false }).rotateY(Math.PI / 2).translate(-w / 2, 0, 0);
	return piece(solid, hex, 0, 0, y, 0);
}

// A hipped roof: four slopes, its ridge along x (a point when the house is as deep as it is wide).
function hip(hex: string, w: number, d: number, h: number, y: number): G {
	const [x, z, ridge] = [w / 2, d / 2, Math.max(0, w - d) / 2];
	const [a, c, e, f] = [
		[-x, 0, z],
		[x, 0, z],
		[x, 0, -z],
		[-x, 0, -z],
	].map(([p, q, r]) => new THREE.Vector3(p, q, r));
	const [left, right] = [new THREE.Vector3(-ridge, h, 0), new THREE.Vector3(ridge, h, 0)];
	const geometry = new THREE.BufferGeometry().setFromPoints([a!, c!, right, a!, right, left, c!, e!, right, e!, f!, left, e!, left, right, f!, a!, left]);
	geometry.computeVertexNormals();
	// The other pieces have a uv, and a merge refuses geometries with other attributes.
	geometry.setAttribute("uv", new THREE.BufferAttribute(new Float32Array(18 * 2), 2));
	return piece(geometry, hex, 0, 0, y, 0);
}

// A chimney that stands out of a pitched roof at (x, z), its top `h` above the roof's base. `half` is the roof's half width
// and half depth: the chimney keeps from their edge 0.5 or a quarter of the half size, the larger (plus its half width
// 0.15), where the eave's lip is.
const keptIn = (at: number, half: number): number => Math.sign(at) * Math.min(Math.abs(at), Math.max(0, half - Math.max(0.5, half / 4) - 0.15));
const chimney = (s: Spec, top: number, x: number, z: number, h: number, half: [number, number]): G[] => {
	const [cx, cz] = [keptIn(x, half[0]), keptIn(z, half[1])];
	return [b(shade(s.wall, 0.75), 0.3, h + 0.3, 0.3, cx, top + 0.1, cz), b("#5a4a40", 0.36, 0.06, 0.36, cx, top + h + 0.4, cz)];
};

// A gable facing the street: its wall triangle in front and behind, the roof's edges around it; no higher than 0.7 of
// the wall.
function facing(style: Style, s: Spec, top: number, side: number, cap: G, smoke: boolean): G[] {
	const h = Math.min(s.w * (0.35 + s.r() * 0.2), 0.7 * top);
	const out: G[] = [
		gable(s.roof, s.d - 0.1, s.w + side, h + 0.12, top).rotateY(Math.PI / 2),
		gable(s.wall, s.d + 0.04, s.w - 0.02, h - 0.04, top).rotateY(Math.PI / 2),
		...[1, -1].map((face) => b(s.trim, s.w + 0.08, 0.08, 0.1, 0, top - 0.02, face * (s.d / 2 + 0.03))),
	];
	// A window in each gable, and a hoist beam at the front one's top.
	for (const face of [1, -1])
		out.push(
			b(glassOf(style), 0.3, 0.42, 0.03, 0, top + h * 0.25, face * (s.d / 2 + 0.03), windowPhase(s.r)),
			b(s.trim, 0.4, 0.06, 0.05, 0, top + h * 0.25 - 0.04, face * (s.d / 2 + 0.05)),
		);
	// The beam stands 0.06 over the window and 0.1 under the gable's peak, or there is none: at 0.72 of a low gable it
	// went through the window.
	const beam = top + h * 0.25 + 0.42 + 0.06;
	if (s.r() < 0.5 && beam + 0.08 <= top + h - 0.1) out.push(b("#4a3b35", 0.08, 0.08, 0.4, 0, beam, s.d / 2 + 0.16));
	if (smoke) out.push(...chimney(s, top, 0, -s.d / 4, h, [(s.w + side) / 2, (s.d - 0.1) / 2]));
	return out.concat(cap);
}

// The pitched roof's form, by the draw `pull`: tiles have no flat roof.
const formOf = (pull: number, tiles: boolean): "along" | "hip" | "facing" | "flat" =>
	tiles ? (pull < 0.55 ? "along" : pull < 0.8 ? "hip" : "facing") : pull < 0.4 ? "facing" : pull < 0.65 ? "along" : pull < 0.85 ? "hip" : "flat";

// A pitched roof, one of three forms drawn by chance (the same gable over and over makes a forest of needles): a gable
// facing the street, a gable along it, or a hip. Never steeper than half the width, and low next to a high wall.
function pitched(style: Style, s: Spec, top: number, tiles: boolean): G[] {
	const pull = s.r();
	// What a roof reaches beyond its walls: tiles 0.15 aside and 0.2 deep, the others 0.12 and 0.1 (see `overhang`).
	const [side, deep] = tiles ? [0.3, 0.4] : [0.24, 0.2];
	const form = formOf(pull, tiles);
	if (form === "flat") return flatRoof(style, s, top);
	const cap = b(shade(s.wall, 0.9), s.w + 0.02, 0.08, s.d + 0.02, 0, top - 0.04, 0);
	const smoke = s.r() < 0.5;
	if (form === "facing") return facing(style, s, top, side, cap, smoke);
	const h = tiles ? Math.min(1.1, s.d * 0.32) * (0.75 + s.r() * 0.25) : Math.min(s.w * (0.3 + s.r() * 0.15), s.d * 0.4, 0.7 * top);
	if (form === "hip") {
		const out: G[] = [hip(s.roof, s.w + side, s.d + deep, h, top), cap];
		// On the ridge, where the slopes are high enough to hold it.
		if (smoke) out.push(...chimney(s, top, s.w * 0.15, -s.d / 8, h, [(s.w + side) / 2, (s.d + deep) / 2]));
		return out;
	}
	// A gable along the street: a ridge cap and, in tiles, its lines.
	// The cap's ends stand a hair out of the roof's in tiles, a hair in in the others: never in the roof's end plane.
	const out: G[] = [
		gable(s.roof, s.w + side, s.d + deep, h, top),
		gable(shade(s.roof, 0.8), s.w + side + (tiles ? 0.04 : -0.04), 0.16, 0.14, top + h - 0.12),
		cap,
	];
	if (tiles)
		for (let n = 1; n < 4; n++)
			out.push(b(shade(s.roof, 0.88), s.w + 0.28, 0.03, 0.04, 0, top + (h * n) / 4 - 0.02, (s.d + 0.4) / 2 - ((s.d + 0.4) / 2) * (n / 4) + 0.02));
	if (smoke) out.push(...chimney(s, top, s.w / 2 - 0.45, -s.d / 6, h, [(s.w + side) / 2, (s.d + deep) / 2]));
	return out;
}

// A roof terrace behind a low parapet of the wall's colour: a stair hut, a pergola, sometimes a small dome.
function terraceRoof(style: Style, s: Spec, top: number): G[] {
	const out: G[] = [
		b(shade(s.wall, 0.95), s.w - 0.1, 0.05, s.d - 0.1, 0, top, 0),
		b(s.wall, s.w + 0.04, 0.34, 0.12, 0, top, s.d / 2 - 0.04),
		b(s.wall, s.w + 0.04, 0.34, 0.12, 0, top, -s.d / 2 + 0.04),
		b(s.wall, 0.12, 0.34, s.d, s.w / 2 - 0.04, top, 0),
		b(s.wall, 0.12, 0.34, s.d, -s.w / 2 + 0.04, top, 0),
	];
	const room = roomOn(s);
	const hut = room(0.8, 0.84, -s.w / 4, -s.d / 4);
	if (hut) out.push(b(s.wall, 0.8, 0.7, 0.8, hut[0], top, hut[1]), b("#6e4a32", 0.3, 0.5, 0.03, hut[0], top + 0.05, hut[1] + 0.41));
	const extra = s.r();
	if (hut && extra < 0.35) out.push(piece(new THREE.SphereGeometry(0.42, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), style.accent, 0, hut[0], top + 0.7, hut[1]));
	else if (extra < 0.7) {
		// The pergola and its planter take a 1.1 square, whose centre is 0.065 and 0.1 from the pergola's.
		const spot = room(1.1, 1.1, s.w / 5 + 0.065, 0.1);
		if (spot) {
			const [px, pz] = [spot[0] - 0.065, spot[1] - 0.1];
			for (const [dx, dz] of [
				[-1, -1],
				[1, -1],
				[-1, 1],
				[1, 1],
			] as const)
				out.push(b("#8a6a4a", 0.05, 0.6, 0.05, px + dx * 0.4, top + 0.05, pz + dz * 0.4));
			for (let n = 0; n < 5; n++) out.push(b("#a7845c", 0.94, 0.04, 0.06, px, top + 0.65, pz - 0.4 + n * 0.2));
			out.push(b("#6fa35a", 0.3, 0.2, 0.3, px + 0.45, top + 0.05, pz + 0.45));
		}
	}
	return out;
}

export function roof(style: Style, s: Spec, top: number): G[] {
	const kind = roofKindOf(style, s.kind);
	if (kind === "tiles" || kind === "steep") return pitched(style, s, top, kind === "tiles");
	if (kind === "terrace") return terraceRoof(style, s, top);
	if (kind === "mansard") {
		const out: G[] = [
			b(s.trim, s.w + 0.14, 0.12, s.d + 0.14, 0, top, 0),
			b(s.roof, s.w - 0.06, 0.62, s.d - 0.06, 0, top + 0.12, 0),
			b(shade(s.roof, 1.18), s.w - 0.6, 0.28, s.d - 0.6, 0, top + 0.74, 0),
		];
		const dormers = Math.max(1, Math.round(s.w / 1.2));
		for (let n = 0; n < dormers; n++) {
			const u = -s.w / 2 + (n + 0.5) * (s.w / dormers);
			// The same dormers at the back.
			for (const face of [1, -1])
				out.push(
					b(s.trim, 0.36, 0.46, 0.28, u, top + 0.18, face * (s.d / 2 - 0.04)),
					b(glassOf(style), 0.22, 0.28, 0.03, u, top + 0.24, face * (s.d / 2 + 0.11), windowPhase(s.r)),
					gable(s.roof, 0.44, 0.34, 0.18, top + 0.64).translate(u, 0, face * (s.d / 2 - 0.04)),
				);
		}
		// It shows over the upper deck (w - 0.6 by d - 0.6, as high as top + 1.02), in from its edge by 0.5 or a quarter of
		// the deck's half size, the larger; a deck too narrow to hold that has none.
		const [hx, hz] = [(s.w - 0.6) / 2, (s.d - 0.6) / 2];
		const [mx, mz] = [Math.max(0.5, hx / 4) + 0.17, Math.max(0.5, hz / 4) + 0.13];
		if (hx > mx && hz > mz) {
			const [cx, cz] = [-(hx - mx), -Math.min(s.d / 4, hz - mz)];
			out.push(b("#b5654a", 0.34, 0.75, 0.26, cx, top + 0.74, cz), ...[-0.08, 0.08].map((dx) => cyl("#c8643c", 0.04, 0.05, 0.14, cx + dx, top + 1.49, cz, 6)));
		}
		return out;
	}
	return flatRoof(style, s, top);
}

// A flat roof behind its pale parapet, with its machines.
function flatRoof(style: Style, s: Spec, top: number): G[] {
	const rim = shade(s.trim, 1.04);
	const out: G[] = [
		b(shade(s.roof, 1.25), s.w - 0.1, 0.06, s.d - 0.1, 0, top, 0),
		b(rim, s.w + 0.06, 0.26, 0.14, 0, top, s.d / 2 - 0.04),
		b(rim, s.w + 0.06, 0.26, 0.14, 0, top, -s.d / 2 + 0.04),
		b(rim, 0.14, 0.26, s.d, s.w / 2 - 0.04, top, 0),
		b(rim, 0.14, 0.26, s.d, -s.w / 2 + 0.04, top, 0),
	];
	// What stands on the roof never overlaps: the billboard first, then the stair hut, the water tank, the units and the
	// antenna each take a free spot, or are left out when the roof is full.
	const room = roomOn(s);
	if (style.name === "neon" && s.kind !== "row" && s.r() < 0.5 && room(s.w * 0.7 + 0.1, 0.2, 0, 0.05)) {
		// A billboard on the roof, lit at night.
		out.push(b(IRON, 0.06, 0.5, 0.06, -s.w / 4, top + 0.06, 0), b(IRON, 0.06, 0.5, 0.06, s.w / 4, top + 0.06, 0));
		out.push(
			b(pick(["#ff6f91", "#35c2ff", "#ffd23f", "#8f7cff"], s.r), s.w * 0.7, 0.9, 0.08, 0, top + 0.5, 0.05, 4),
			b(IRON, s.w * 0.7 + 0.1, 1, 0.06, 0, top + 0.45, 0),
		);
	}
	const hut = room(0.5, 0.56, -s.w / 4, -s.d / 4);
	if (hut) out.push(b("#9aa0a8", 0.5, 0.36, 0.5, hut[0], top + 0.06, hut[1]), b("#6b7079", 0.3, 0.32, 0.04, hut[0], top + 0.06, hut[1] + 0.26));
	if (style.name === "brick" && s.r() < 0.5) {
		const spot = room(0.76, 0.76, s.w / 4, -s.d / 5);
		if (spot) {
			const [x, z] = spot;
			out.push(
				...[-1, 1].flatMap((dx) => [-1, 1].map((dz) => b("#4a3a30", 0.05, 0.55, 0.05, x + dx * 0.24, top + 0.06, z + dz * 0.24))),
				cyl("#8b5e3c", 0.32, 0.32, 0.6, x, top + 0.6, z, 10),
				piece(new THREE.ConeGeometry(0.36, 0.26, 10), "#5d4030", 0, x, top + 1.33, z),
			);
		}
	}
	const things = 1 + Math.floor(s.r() * 3);
	for (let n = 0; n < things; n++) {
		const spot = room(0.44, 0.38);
		if (spot) out.push(b("#c9ccd4", 0.44, 0.3, 0.38, spot[0], top + 0.06, spot[1]), b("#8e939c", 0.26, 0.03, 0.26, spot[0], top + 0.36, spot[1]));
	}
	// The aerial takes its boom's room, so that its rods cross nothing on the roof.
	const antenna = s.r() < 0.35 ? room(AERIAL.long, AERIAL.wide, s.w / 3, s.d / 4) : null;
	if (antenna) out.push(...aerial(antenna[0], top + 0.06, antenna[1]));
	return out;
}
