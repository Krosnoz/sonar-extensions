// The street's furniture (the parks' is in ./gardens.ts): lamps and their pools of light, benches, planters and bins.
import { THREE } from "./nodes";
import { LAMP_IRON, b, blob, cyl, pick, piece, type G } from "./shapes";

// A pool of light on the ground, `rx` by `rz` wide, by night only: a flat disc, never drawn, laid in the lamps' light
// map (./lamplight.ts), whose light fades to nothing at its edge and lights the ground only (./part-material.ts#material). It
// stays within the block's ground (5,5 from its middle), not a halo in the air over the sea: near an edge it narrows on
// that axis, its middle kept under its lamp. Its middle pulled in instead left the lamps of a park's, a river's and the
// monument's back with a dark foot, their pool 1,35 to 2 away.
const POOL = 0.14;
export function pool(hex: string, x: number, z: number, rx: number, rz = rx): G {
	const [wide, deep] = [Math.min(rx, 5.5 - Math.abs(x)), Math.min(rz, 5.5 - Math.abs(z))];
	return piece(new THREE.CircleGeometry(1, 20).scale(wide, deep, 1).rotateX(-Math.PI / 2), hex, 7, x, POOL, z);
}

// A pole stands on the pavement or the square, well short of the street's kerb (z 2,56): its lamp, 1,9 high, would
// otherwise read as standing in the road once the camera tilts it over. By night its light lies on the ground round it.
// `most`: the furthest forward it stands; a square's lamps stand at z 2.3, behind the walkers of its round (./squares.ts).
const POST = LAMP_IRON + 0.06;
export function lamp(x: number, zAsked: number, most = 2.1): G[] {
	const z = Math.min(zAsked, most);
	const iron = "#2c303b";
	return [
		// Amber, a little yellower than the lamp's orange: added to the road's blue-lilac, an orange read pink.
		pool("#ffb347", x, z, 2.25),
		// The post is a fine detail (its width in the part's fraction, ./part-material.ts#material): a line under 1.5 pixels
		// blinked as the town turned; from afar the lamp is its light. Its head and its foot go with it (the post's
		// fraction on the lamp's parts): alone, 1.7 up, the head read as a firefly over the grass and the water, and the
		// foot as a dark dot in the middle of each pool.
		b(iron, 0.16, 0.1, 0.16, x, 0.06, z, POST),
		b(iron, 0.06, 1.5, 0.06, x, 0.16, z, POST),
		b(iron, 0.2, 0.04, 0.2, x, 1.62, z, POST),
		b("#ffe7a0", 0.14, 0.2, 0.14, x, 1.66, z, 4 + 0.06),
		b(iron, 0.24, 0.05, 0.24, x, 1.86, z, POST),
		// The lantern's top is glass that gives light: seen from above, an iron finial over the cap hid the whole lamp,
		// which read as out.
		b("#ffe7a0", 0.12, 0.04, 0.12, x, 1.91, z, 4 + 0.06),
	];
}
export function bench(x: number, z: number): G[] {
	const [wood, iron] = ["#a8703f", "#2c303b"];
	return [
		...[-0.09, 0, 0.09].map((dz) => b(wood, 0.9, 0.03, 0.07, x, 0.3, z + dz)),
		// Between the two iron posts, not across them: no two faces in one plane.
		...[0.4, 0.5].map((y) => b(wood, 0.71, 0.06, 0.03, x, y, z - 0.15)),
		...[-0.38, 0.38].flatMap((dx) => [b(iron, 0.05, 0.24, 0.3, x + dx, 0.06, z), b(iron, 0.05, 0.3, 0.04, x + dx, 0.3, z - 0.16)]),
	];
}
export function planter(x: number, z: number, r: () => number): G[] {
	const flowers = ["#ff6f91", "#ffd166", "#ffffff", "#c9a3ff", "#ff9838"];
	return [
		b("#b98654", 0.7, 0.3, 0.7, x, 0.06, z),
		b("#8a5f3a", 0.76, 0.05, 0.76, x, 0.33, z),
		b("#4a3324", 0.62, 0.04, 0.62, x, 0.36, z),
		blob("#3f9d4d", 0.26, x, 0.56, z),
		blob("#66b86a", 0.18, x + 0.12, 0.7, z + 0.08),
		// On a lattice (3 × 2) with a small jitter: two flowers never share a plane.
		...Array.from({ length: 6 }, (_, at) =>
			b(
				pick(flowers, r),
				0.06,
				0.06,
				0.06,
				x + ((at % 3) - 1) * 0.18 + (r() - 0.5) * 0.04,
				0.4 + r() * 0.34,
				z + (Math.floor(at / 3) - 0.5) * 0.2 + (r() - 0.5) * 0.04,
			),
		),
	];
}
export function bin(x: number, z: number): G[] {
	return [cyl("#3f6b4d", 0.13, 0.11, 0.34, x, 0.06, z, 8), cyl("#2c4c38", 0.15, 0.15, 0.04, x, 0.4, z, 8)];
}
