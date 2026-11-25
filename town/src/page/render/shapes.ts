// What the town's models are made of: a block's size, and small plain volumes. Every model is original and made of
// them: the pixel-art pass draws their edges. The camera sees the +x and +z faces: details go there.
import { THREE, merge } from "./nodes";

export type G = THREE.BufferGeometry;

// A softer palette for the ground's colours, close to the reference illustrations: duller grass, pinkish roads.
const PALETTE: Record<string, string> = {
	"#74c655": "#86b866",
	"#5fb048": "#6a9f52",
	"#77747f": "#b9a7a6",
	"#56535d": "#8d7d7c",
	"#eee6d8": "#ece2da",
	"#d6cbbd": "#ddd0c8",
	"#b9a892": "#cbb9ad",
	"#e6dac8": "#e9ded5",
	"#dccfbb": "#ded2c8",
	"#cdbda6": "#d3c4b9",
};

// The colour a model's part is drawn in: the shaders that pick a colour out (./part-material.ts) read the same one.
export const tone = (hex: string): string => PALETTE[hex] ?? hex;

// One part of a model: its colour, and what the material does with it (0 plain, 1 takes the instance's colour, 2 a
// light that follows the state, 4 a lamp, 5 the instance's colour that glows with the state, 6 a window, 7 a pool of
// light, 8 a fine detail left out from afar).
export function piece(geometry: G, hex: string, part: number, x = 0, y = 0, z = 0, turn: [number, number, number] = [0, 0, 0]): G {
	const made = geometry.index ? geometry.toNonIndexed() : geometry;
	// An angle of zero turns nothing, but its matrix still went over every vertex and normal: a city has thousands of
	// pieces, most not turned.
	if (turn[0]) made.rotateX(turn[0]);
	if (turn[1]) made.rotateY(turn[1]);
	if (turn[2]) made.rotateZ(turn[2]);
	if (x || y || z) made.translate(x, y, z);
	const count = made.getAttribute("position").count;
	const colors = new Float32Array(count * 3);
	const tint = new THREE.Color(tone(hex));
	for (let each = 0; each < count; each++) tint.toArray(colors, each * 3);
	made.setAttribute("color", new THREE.BufferAttribute(colors, 3));
	made.setAttribute("aPart", new THREE.BufferAttribute(new Float32Array(count).fill(part), 1));
	return made;
}
// The part of a street lamp's iron: by night it casts no moon shadow (./part-material.ts#material). The lamp's own light
// floods the ground round it, so the shadow of its head lay in its pool as a dark patch a metre from the post.
export const LAMP_IRON = 3;
// The part of what an inhabitant carries that glows (../people/figures.ts#crate): by night it lights itself, under the glow's
// threshold. As a screen's part (x 3.2), it bloomed into a blurred ball over the heads of a crowd.
export const CARRIED = 10;
// The part of a fine detail whose thinner size is `thin`: the shader leaves it out once that size is under `least`
// pixels (it compares the fraction with 1.5 pixels). A stripe in a row of stripes of two colours still blinked at 2
// pixels: such a row asks for more.
export const detail = (thin: number, least = 1.5): number => 8 + Math.min((thin * 1.5) / least, 0.49);
// A pane or a trim on a +z wall, all its faces lit as its front. Its sides, a few centimetres deep, are a sliver under
// a pixel that the sun lit apart from the wall: down every window of a tower, a line that blinked as the town turned.
export const flat = (geometry: G): G => {
	const normal = geometry.getAttribute("normal");
	for (let at = 0; at < normal.count; at++) normal.setXYZ(at, 0, 0, 1);
	return geometry;
};
export const box = (w: number, h: number, d: number): G => new THREE.BoxGeometry(w, h, d);
export const ball = (r: number, sx = 1, sy = 1, sz = 1): G => new THREE.SphereGeometry(r, 16, 12).scale(sx, sy, sz);
const tube = (top: number, bottom: number, h: number, sides = 16): G => new THREE.CylinderGeometry(top, bottom, h, sides);
// A block's side; a building's width, depth, storey and ground floor heights.
export const T = 11;
export const BW = 6;
export const BD = 3.7;
export const SH = 1.3;
export const GH = 1.55;
export const H = T / 2;

export const rnd = (seed: number): (() => number) => {
	let s = (seed + 1) * 9301 + 49297;
	return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;
};
// A box of one metre, unindexed, built once: each box of the town is a copy of it, scaled. A box of three.js holds its
// half sizes, which a scaled one of a metre gives to the bit (a half times a size). A city built thousands of them, each
// a new box of three.js copied unindexed: a third of the town's build.
let unit: G | null = null;
function scaled(w: number, h: number, d: number): G {
	unit ??= new THREE.BoxGeometry(1, 1, 1).toNonIndexed();
	const made = new THREE.BufferGeometry();
	const position = unit.getAttribute("position").array.slice();
	for (let at = 0; at < position.length; at += 3) {
		position[at] = position[at]! * w;
		position[at + 1] = position[at + 1]! * h;
		position[at + 2] = position[at + 2]! * d;
	}
	made.setAttribute("position", new THREE.BufferAttribute(position, 3));
	for (const name of ["normal", "uv"]) {
		const own = unit.getAttribute(name);
		made.setAttribute(name, new THREE.BufferAttribute(own.array.slice(), own.itemSize));
	}
	for (const { start, count, materialIndex } of unit.groups) made.addGroup(start, count, materialIndex);
	return made;
}
// A box by the centre of its bottom face.
export const b = (hex: string, w: number, h: number, d: number, x = 0, y = 0, z = 0, part = 0, turn?: [number, number, number]): G =>
	piece(scaled(w, h, d), hex, part, x, y + h / 2, z, turn);
export const cyl = (
	hex: string,
	top: number,
	bottom: number,
	h: number,
	x: number,
	y: number,
	z: number,
	sides = 10,
	part = 0,
	turn?: [number, number, number],
): G => piece(tube(top, bottom, h, sides), hex, part, x, y + h / 2, z, turn);
export const blob = (hex: string, r: number, x: number, y: number, z: number, part = 0): G => piece(new THREE.IcosahedronGeometry(r, 1), hex, part, x, y, z);
export const pick = <Item>(list: Item[], r: () => number): Item => list[Math.floor(r() * list.length)]!;
// What is built on the +z face of a volume `width` wide, turned to its +x face.
export const turned = (parts: G[]): G => merge(parts).rotateY(Math.PI / 2);
