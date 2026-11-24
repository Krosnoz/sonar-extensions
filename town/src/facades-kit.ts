// What the houses' facades (./facades.ts) and their ground floors (./facades-ground.ts) share: a house's spec and look,
// the storey's sizes, the colours of the iron and of the signs, and the glass.
import type { Style } from "./styles";
import { THREE, merge } from "./nodes";
import { b, detail, flat, type G } from "./shapes";

// `gaps`: the free air beside the walls, on the -x and the +x side (a missing one is open). `corner`: the house cuts its
// +x +z corner and puts its shop's door there.
export type Spec = {
	w: number;
	d: number;
	floors: number;
	wall: string;
	trim: string;
	roof: string;
	kind: "row" | "mid" | "tower";
	r: () => number;
	gaps?: [number, number];
	corner?: boolean;
	// Drawn once per house by `building`, so that its four faces agree.
	look?: Look;
};

// What makes one house differ from the next: the rhythm and the size of its windows, its ground floor, its balconies and
// its cornice.
export type Look = {
	bay: number;
	pane: number;
	high: number;
	pairs: boolean;
	balcony: 0 | 1 | 2;
	cornice: 0 | 1 | 2 | 3;
	ground: "shop" | "arch" | "home";
	awning: boolean;
	door: 1 | -1;
	bands: boolean;
};

export const FLOOR = 1.05;
export const GROUND = 1.45;
// A side wall gets windows only when the neighbour leaves this much air: nearer, the roofs and the trims meet.
export const SIDE_MIN = 0.5;
export const IRON = "#2c303b";
export const SIGNS = ["#d8453a", "#2f8f6a", "#e0a03a", "#3f6fb0", "#9b4f8f", "#1f6f78"];

// A window's frame, mullion or shutter stands at most this far out of the wall, and none is thinner than `FINE` in width
// or height: a finer or a deeper one flickers as the town moves (its faces, a hair from the wall's, fall on the same
// depth value). It is a box `depth` thick, centred on the wall's plane.
const OUT = 0.03;
const FINE = 0.08;
const FRAME_DEPTH = 2 * OUT;

// A frame, a mullion, a lintel or a sill on the wall's plane `off`: from `y` up, `w` wide at `u`. Its part is a fine
// detail (8) whose fraction is its thinner size: seen from afar, once that size is under 1.5 pixels, the shader leaves it
// out and the wall or the glass behind shows (./part-material.ts). A grid of lines finer than a pixel made a moire pattern as the town turned.
export const fine = (hex: string, w: number, h: number, u: number, y: number, off: number): G => {
	const [width, height] = [Math.max(w, FINE), Math.max(h, FINE)];
	return flat(b(hex, width, height, FRAME_DEPTH, u, y, off, detail(Math.min(width, height))));
};

export const shade = (hex: string, by = 0.86): string => `#${new THREE.Color(hex).multiplyScalar(by).getHexString()}`;
export const pick = <T>(list: T[], r: () => number): T => list[Math.floor(r() * list.length)]!;

// The glass of a dark window, lighter than the style's so that it reads in the shade (night: #4b5c78 is its limit).
export const glassOf = (style: Style): string => `#${new THREE.Color(style.glass).lerp(new THREE.Color("#4b5c78"), 0.7).getHexString()}`;

// A window's part and its fraction (part 6 + fraction / 2.04; see part-material.ts): the shader lights it by day when the fraction
// is under the share of the instance at work, and by night also from 0.8. A cream window by day reads as a broken pane,
// so no window gets a low fraction: 35 % are above the largest share (1), lit by night only; the others stay between 0.6
// and 0.78, dark by night and by day unless 60 % or more of the subject's agents work (that needs the shader to be fixed).
export const NIGHT_ONLY = 6 + 0.9999 * 0.49;
export const windowPhase = (r: () => number): number => (r() < 0.35 ? NIGHT_ONLY : 6 + (0.6 + r() * 0.18) * 0.49);

export const faceAt = (parts: G[], turn: number): G => merge(parts).rotateY(turn);
