// The parks' and squares' furniture: fountain, kiosk, pond, vegetable garden, playground.
import { b, blob, cyl, pick, type G } from "./shapes";

// The central stack (column, upper bowl, jet) is 1,5 times as large as it was, so that a fountain reads from afar; the
// basin is `wide` times its first size (1 on a subject's square, where the people's loop passes 0,08 from it, 1,5 in a
// park).
export function fountain(x: number, z: number, wide = 1): G[] {
	const stone = "#ded6c8";
	const up = 1.5;
	return [
		cyl(stone, 0.95 * wide, wide, 0.1, x, 0.06, z, 12),
		cyl(stone, 0.86 * wide, 0.9 * wide, 0.2, x, 0.16, z, 12),
		cyl("#58b4e6", 0.76 * wide, 0.76 * wide, 0.04, x, 0.34, z, 12),
		cyl(stone, 0.1 * up, 0.16 * up, 0.6 * up, x, 0.36, z, 8),
		cyl(stone, 0.4 * up, 0.2 * up, 0.1 * up, x, 0.36 + 0.58 * up, z, 10),
		cyl("#8fd3f4", 0.33 * up, 0.33 * up, 0.03 * up, x, 0.36 + 0.67 * up, z, 10),
		cyl(stone, 0.05 * up, 0.07 * up, 0.24 * up, x, 0.36 + 0.68 * up, z, 6),
		blob("#c8ecff", 0.08 * up, x, 0.36 + 0.96 * up, z),
	];
}
export function kiosk(x: number, z: number, r: () => number): G[] {
	const [green, dark] = ["#2f6f55", "#1f4a39"];
	return [
		b(green, 1.2, 1.05, 0.9, x, 0.06, z),
		b(dark, 1.5, 0.08, 1.2, x, 1.11, z),
		b(green, 1.0, 0.16, 0.7, x, 1.19, z),
		b("#f3ead9", 0.5, 0.1, 0.04, x, 1.21, z + 0.36),
		b("#1b2230", 0.9, 0.45, 0.04, x, 0.5, z + 0.44),
		b("#a8703f", 1.0, 0.05, 0.22, x, 0.44, z + 0.52),
		...Array.from({ length: 9 }, (_, at) =>
			b(
				pick(["#ff6f91", "#ffd166", "#7fb8ff", "#f3ead9", "#8fdc8a"], r),
				0.12,
				0.16,
				0.02,
				x - 0.36 + (at % 5) * 0.18,
				0.56 + Math.floor(at / 5) * 0.2,
				z + 0.47,
			),
		),
		...Array.from({ length: 5 }, (_, at) => b(pick(["#ff9838", "#f3ead9", "#7fb8ff"], r), 0.16, 0.03 + r() * 0.05, 0.14, x - 0.38 + at * 0.19, 0.49, z + 0.52)),
	];
}
export function pond(x: number, z: number, r: () => number): G[] {
	const out: G[] = [b("#6f9fc4", 2.7, 0.05, 2.3, x, 0, z), b("#8db8d8", 2.1, 0.02, 1.7, x + 0.1, 0.05, z + 0.1)];
	for (let at = 0; at < 22; at++) {
		const angle = (at / 22) * Math.PI * 2;
		// None under the jetty: a stone's top and a plank's would lie at one height.
		const [dx, dz] = [Math.cos(angle) * 1.45, Math.sin(angle) * 1.25];
		if (dx > 0 && dx < 1.45 && dz > 0.3 && dz < 1.6) continue;
		out.push(
			b(
				pick(["#9a948c", "#b3ada4", "#847d76"], r),
				0.3 + r() * 0.25,
				// Tops at least 0.025 apart from one stone to the next: no two in one plane.
				0.1 + (at % 5) * 0.035 + r() * 0.01,
				0.3 + r() * 0.2,
				x + Math.cos(angle) * 1.45,
				0,
				z + Math.sin(angle) * 1.25,
				0,
				[0, r() * 3, 0],
			),
		);
	}
	// A flower on each lily pad; a reed's head on the top of its stem.
	for (let at = 0; at < 5; at++) {
		// East of the reeds (x - 1,1 to x - 0,6), so that a pad and a reed never share a plane.
		const [px, pz] = [x - 0.4 + r() * 1.2, z + (r() - 0.5) * 1.3];
		out.push(cyl("#4fb26a", 0.14, 0.14, 0.02, px, 0.07, pz, 8), b("#ff9fce", 0.05, 0.05, 0.05, px, 0.09, pz));
	}
	for (let at = 0; at < 7; at++) {
		// On a lattice (4 × 2, 0,14 and 0,2 apart): two reeds never share a plane.
		const [px, pz, tall] = [x - 1.1 + (at % 4) * 0.14, z - 0.9 + Math.floor(at / 4) * 0.2, 0.4 + r() * 0.4];
		out.push(b("#3c8a4a", 0.03, tall, 0.03, px, 0, pz), b("#7a5234", 0.05, 0.12, 0.05, px, tall, pz));
	}
	// A small jetty.
	out.push(
		...[0, 0.16, 0.32, 0.48].map((dx) => b("#b98654", 0.13, 0.04, 0.5, x + 0.5 + dx, 0.12, z + 0.95)),
		b("#7a5234", 0.06, 0.2, 0.06, x + 0.5, 0, z + 0.75),
		b("#7a5234", 0.06, 0.2, 0.06, x + 0.98, 0, z + 0.75),
	);
	return out;
}
// The garden is 2,9 deep: the shed's roof, then three rows of beds. It keeps 0,5 of grass on every side but the one next
// to the block's neighbour: from the street behind the block (its pavement begins at z -5,41, and a car passing there
// would ride a shed that leans on it), from the paved square in front (its edge is at z -1,35), and from the block's right
// edge (x 5,5) when `x` is the subject's garden (3,35). `zAsked` is where its middle would like to be; it is taken in
// between those two limits.
const GARDEN = 2.9;
export function beds(x: number, zAsked: number, r: () => number): G[] {
	const back = Math.min(Math.max(zAsked - GARDEN / 2, -5.41 + 0.5), -1.35 - 0.5 - GARDEN);
	const out: G[] = [];
	for (let row = 0; row < 3; row++) {
		const rz = back + 0.9 + 0.27 + row * 0.7;
		out.push(b("#6b4630", 2.5, 0.1, 0.5, x, 0, rz), b("#8a5f3a", 2.6, 0.14, 0.06, x, 0, rz + 0.27), b("#8a5f3a", 2.6, 0.14, 0.06, x, 0, rz - 0.27));
		for (let at = 0; at < 8; at++) {
			const px = x - 1.12 + at * 0.32;
			out.push(
				b(row % 2 ? "#58aa61" : "#66b86a", 0.14, 0.14 + r() * 0.12, 0.14, px, 0.1, rz),
				b(
					pick(row % 2 ? ["#ff6f91", "#ffffff", "#c9a3ff"] : ["#ff9838", "#ffd166", "#e0473c"], r),
					0.08,
					0.08,
					0.08,
					px,
					0.26 + r() * 0.1,
					rz + (r() - 0.5) * 0.1,
				),
			);
		}
	}
	// A shed, a watering can, a wheelbarrow.
	const [sx, sz] = [x + 0.8, back + 0.4];
	out.push(
		b("#b98654", 0.7, 0.7, 0.6, sx, 0, sz),
		b("#8a5f3a", 0.9, 0.08, 0.8, sx, 0.7, sz),
		b("#7a4a2a", 0.26, 0.5, 0.04, sx + 0.08, 0, sz + 0.31),
		b("#39485f", 0.16, 0.16, 0.04, sx - 0.2, 0.4, sz + 0.31, 6.2),
		b("#9aa3ad", 0.16, 0.16, 0.12, x - 0.95, 0, back + 0.45),
		b("#c8553a", 0.4, 0.14, 0.26, x - 0.3, 0.12, back + 0.45),
		cyl("#22252c", 0.09, 0.09, 0.05, x - 0.06, 0, back + 0.45, 8, 0, [Math.PI / 2, 0, 0]),
	);
	return out;
}
// A playground's look: `hedge`, the side (1 the +x one, -1 the -x one) its hedge runs along, with the back; `flip`, its
// things mirrored across it; `set`, what it holds: 0 a slide, a swing and a sandbox, 1 a slide, a seesaw and a sandbox,
// 2 a climbing frame, a swing and two spring riders. The parks' playgrounds were all the first, in the same corner.
// `sand`, its colour; `hedges`: 0 a hedge along the back and the side, 1 along the back only, 2 a low white fence.
export type Play = { hedge: 1 | -1; flip: boolean; set: 0 | 1 | 2; sand?: string; hedges?: 0 | 1 | 2 };
// Two spring riders' places across and along the playground, and their bodies' colours.
const RIDERS: [number, number, string][] = [
	[-1.0, 0.6, "#7fb8ff"],
	[-0.4, 1.0, "#ff9fce"],
];
// A hedge along the back and one side, open on the others; or a fence of posts and a rail there.
function edge(out: G[], x: number, z: number, r: () => number, hedge: 1 | -1, hedges: 0 | 1 | 2): void {
	for (let at = 0; at < 9; at++)
		if (hedges === 2)
			out.push(
				b("#f3ead9", 0.06, 0.34, 0.06, x + hedge * (-1.7 + at * 0.42), 0, z - 1.65),
				b("#f3ead9", 0.06, 0.34, 0.06, x + hedge * 1.8, 0, z - 1.6 + at * 0.4),
			);
		else
			out.push(
				b(at % 2 ? "#4d9a56" : "#58aa61", 0.42, 0.3 + r() * 0.1, 0.36, x + hedge * (-1.7 + at * 0.42), 0, z - 1.65),
				...(hedges === 1 ? [] : [b(at % 2 ? "#58aa61" : "#4d9a56", 0.36, 0.3 + r() * 0.1, 0.42, x + hedge * 1.8, 0, z - 1.6 + at * 0.4)]),
			);
	if (hedges === 2) out.push(b("#f3ead9", 3.42, 0.04, 0.04, x - hedge * 0.02, 0.26, z - 1.65), b("#f3ead9", 0.04, 0.04, 3.24, x + hedge * 1.8, 0.27, z));
}
export function playground(
	x: number,
	z: number,
	r: () => number,
	{ hedge, flip, set, sand = "#e8d9a8", hedges = 0 }: Play = { hedge: 1, flip: false, set: 0 },
): G[] {
	const out: G[] = [b(sand, 3.2, 0.04, 2.9, x, 0.005, z)];
	edge(out, x, z, r, hedge, hedges);
	// Its things, `u` across it (mirrored when `flip`).
	const f = flip ? -1 : 1;
	const u = (dx: number): number => x + f * dx;
	const slide = (): G[] => [
		b("#e0473c", 0.08, 0.9, 0.08, u(-0.9), 0, z - 0.9),
		b("#e0473c", 0.08, 0.9, 0.08, u(-0.9), 0, z - 0.4),
		b("#ffd166", 0.5, 0.06, 0.6, u(-0.9), 0.86, z - 0.65),
		b("#7fb8ff", 1.3, 0.05, 0.4, u(-0.2), 0.42, z - 0.65, 0, [0, 0, -0.62 * f]),
	];
	const swing = (): G[] => [
		...[-0.5, 0.5].flatMap((dz) => [b("#2f6fd0", 0.06, 1, 0.06, u(0.9), 0, z + 0.4 + dz)]),
		b("#2f6fd0", 0.08, 0.06, 1.1, u(0.9), 1, z + 0.4),
		b("#22252c", 0.02, 0.6, 0.02, u(0.9), 0.4, z + 0.25),
		b("#22252c", 0.02, 0.6, 0.02, u(0.9), 0.4, z + 0.55),
		b("#ffd166", 0.2, 0.04, 0.36, u(0.9), 0.36, z + 0.4),
	];
	const sandbox = (): G[] => [
		b("#b98654", 1.1, 0.12, 1.1, u(-0.7), 0, z + 0.8),
		b("#f1dc9a", 0.95, 0.04, 0.95, u(-0.7), 0.1, z + 0.8),
		b("#e0473c", 0.12, 0.1, 0.12, u(-0.9), 0.14, z + 0.9),
		b("#7fb8ff", 0.1, 0.14, 0.1, u(-0.5), 0.14, z + 0.6),
	];
	// A plank on its pivot, tilted along z, a handle at each end.
	const seesaw = (): G[] => [
		b("#2f6fd0", 0.14, 0.26, 0.14, u(0.9), 0, z + 0.4),
		b("#ffd166", 0.16, 0.05, 1.4, u(0.9), 0.24, z + 0.4, 0, [0.2, 0, 0]),
		// The plank's +z end is the low one.
		...[-0.5, 0.5].map((dz) => b("#e0473c", 0.12, 0.14, 0.04, u(0.9), 0.3 - dz * 0.2, z + 0.4 + dz)),
	];
	// A cube of bars, 0.8 high: four posts, two rings of bars under their tops (no top in one plane with a post's).
	const frame = (): G[] => [
		...[-1, 1].flatMap((sx) => [-1, 1].map((sz) => b("#e0473c", 0.06, 0.8, 0.06, u(-0.9 + sx * 0.35), 0, z - 0.65 + sz * 0.35))),
		...[0.36, 0.7].flatMap((y) =>
			[-1, 1]
				.map((sz) => b("#ffd166", 0.64, 0.04, 0.04, u(-0.9), y, z - 0.65 + sz * 0.35))
				.concat([-1, 1].map((sx) => b("#ffd166", 0.04, 0.04, 0.64, u(-0.9 + sx * 0.35), y + 0.02, z - 0.65))),
		),
	];
	// Two spring riders: a spring and a small body on it.
	const riders = (): G[] =>
		RIDERS.flatMap(([dx, dz, hex]) => [b("#22252c", 0.05, 0.18, 0.05, u(dx), 0.04, z + dz), b(hex, 0.32, 0.18, 0.14, u(dx), 0.22, z + dz)]);
	out.push(...(set === 2 ? [...frame(), ...swing(), ...riders()] : [...slide(), ...(set === 1 ? seesaw() : swing()), ...sandbox()]));
	return out;
}
