// The centrepieces of the town's parks (./parks.ts), each drawn in a plot it keeps to: a fountain, a pond, a bandstand,
// a flower garden, a playground. Every one has its variants, drawn from the park's own random, so that a big town does
// not show the same fountain with the same planters three times in one view.
import { playground } from "./gardens";
import { b, blob, cyl, pick, type G } from "../render/shapes";
import { planter } from "./street-furniture";

// A plot: its middle and its size along x and z. A piece stays inside it.
export type Plot = { x: number; z: number; w: number; d: number };
const STONE = "#ded6c8";
const FLOWERS = ["#ff6f91", "#ffd166", "#ffffff", "#c9a3ff", "#ff9838", "#e0473c", "#7fb8ff"];
// Somewhere in [lo, hi], or its middle when the range is upside down.
const within = (lo: number, hi: number, r: () => number): number => (hi > lo ? lo + r() * (hi - lo) : (lo + hi) / 2);

// Jets out of a wet floor: a paved disc or square, a film of water, a ring or a line of thin jets.
function jets(out: G[], r: () => number, cx: number, z: number, rb: number, shape: number): void {
	const sides = shape === 2 ? 4 : 16;
	out.push(cyl("#d8cfc0", rb, rb, 0.04, cx, 0.03, z, sides, 0, [0, sides === 4 ? Math.PI / 4 : 0, 0]));
	out.push(cyl("#58b4e6", rb * 0.8, rb * 0.8, 0.02, cx, 0.07, z, sides, 0, [0, sides === 4 ? Math.PI / 4 : 0, 0]));
	const count = 5 + Math.floor(r() * 4);
	for (let at = 0; at < count; at++) {
		const angle = (at / count) * Math.PI * 2;
		const [jx, jz] = shape === 1 ? [cx - rb * 0.6 + (at / (count - 1)) * rb * 1.2, z] : [cx + Math.cos(angle) * rb * 0.5, z + Math.sin(angle) * rb * 0.5];
		const tall = 0.35 + r() * 0.45;
		out.push(b("#c8ecff", 0.05, tall, 0.05, jx, 0.09, jz), blob("#c8ecff", 0.07, jx, 0.09 + tall, jz));
	}
}

// A basin, round, eight-sided or square, its column, and one bowl (`tiers` 1) or two.
function bowls(out: G[], r: () => number, cx: number, z: number, rb: number, shape: number, tiers: number): void {
	const sides = shape === 0 ? 12 : 8;
	if (shape === 2) out.push(b(STONE, 1.9 * rb, 0.3, 1.9 * rb, cx, 0.06, z), b("#58b4e6", 1.6 * rb, 0.04, 1.6 * rb, cx, 0.34, z));
	else
		out.push(
			cyl(STONE, 0.95 * rb, rb, 0.1, cx, 0.06, z, sides),
			cyl(STONE, 0.86 * rb, 0.9 * rb, 0.2, cx, 0.16, z, sides),
			cyl("#58b4e6", 0.76 * rb, 0.76 * rb, 0.04, cx, 0.34, z, sides),
		);
	const up = 1.2 + r() * 0.4;
	out.push(cyl(STONE, 0.1 * up, 0.16 * up, 0.6 * up, cx, 0.36, z, 8));
	if (tiers === 2)
		out.push(
			cyl(STONE, 0.4 * up, 0.2 * up, 0.1 * up, cx, 0.36 + 0.58 * up, z, 10),
			cyl("#8fd3f4", 0.33 * up, 0.33 * up, 0.03 * up, cx, 0.36 + 0.67 * up, z, 10),
			cyl(STONE, 0.05 * up, 0.07 * up, 0.24 * up, cx, 0.36 + 0.68 * up, z, 6),
			blob("#c8ecff", 0.08 * up, cx, 0.36 + 0.96 * up, z),
		);
	else out.push(blob("#c8ecff", 0.12 * up, cx, 0.36 + 0.66 * up, z), blob("#c8ecff", 0.07 * up, cx, 0.36 + 0.86 * up, z));
}

// A fountain: a round, eight-sided or square basin of its own size, with two bowls, one, or jets out of a paved floor
// (no basin), and around it four planters at its corners, two at its sides, four low beds, or nothing.
export function fountainIn({ x, z, w, d }: Plot, r: () => number): G[] {
	const [tiers, shape, around] = [Math.floor(r() * 3), Math.floor(r() * 3), Math.floor(r() * 4)];
	const room = Math.min(w, d) / 2 - 0.1;
	// What stands round the basin takes 0.9 of its radius: planters 0.7 wide and a gap.
	const rb = Math.min(1.1 + r() * 0.5, room - (around === 3 ? 0 : 0.95));
	const cx = x + (r() - 0.5) * Math.max(0, w - 2 * (rb + (around === 3 ? 0 : 0.95)) - 0.2);
	const out: G[] = [];
	if (tiers === 0) jets(out, r, cx, z, rb, shape);
	else bowls(out, r, cx, z, rb, shape, tiers);
	const off = rb + 0.5;
	const spots: [number, number][] =
		around === 0
			? [
					[-1, -1],
					[1, -1],
					[-1, 1],
					[1, 1],
				].map(([u, v]) => [u! * off * 0.75, v! * off * 0.75] as [number, number])
			: around === 1
				? [
						[-off, 0],
						[off, 0],
					]
				: around === 2
					? [
							[0, -off],
							[0, off],
							[-off, 0],
							[off, 0],
						]
					: [];
	for (const [dx, dz] of spots)
		if (around === 2) out.push(...bed(cx + dx, z + dz, dx === 0 ? 0.9 : 0.4, dx === 0 ? 0.4 : 0.9, pick(FLOWERS, r), r));
		else out.push(...planter(cx + dx, z + dz, r));
	return out;
}

// A low flower bed: an edge of stone, earth, rows of flowers on a lattice (no two in one plane).
function bed(x: number, z: number, w: number, d: number, hex: string, r: () => number): G[] {
	const out: G[] = [b("#bfb6a8", w + 0.08, 0.1, d + 0.08, x, 0, z), b("#5e3f2c", w, 0.04, d, x, 0.1, z)];
	const [nx, nz] = [Math.max(1, Math.floor(w / 0.18)), Math.max(1, Math.floor(d / 0.18))];
	for (let i = 0; i < nx; i++)
		for (let k = 0; k < nz; k++) {
			const [px, pz] = [x - w / 2 + (i + 0.5) * (w / nx), z - d / 2 + (k + 0.5) * (d / nz)];
			out.push(b(r() < 0.3 ? "#58aa61" : hex, 0.09, 0.08 + r() * 0.06 + ((i + k) % 3) * 0.013, 0.09, px, 0.14, pz));
		}
	return out;
}

// A pond of its own size, its stones round it, lilies, reeds on one side and maybe a jetty on another.
export function pondIn({ x, z, w, d }: Plot, r: () => number): G[] {
	const [rx, rz] = [within(1.1, Math.min(1.8, w / 2 - 0.4), r), within(0.9, Math.min(1.5, d / 2 - 0.4), r)];
	const cx = x + (r() - 0.5) * Math.max(0, w - 2 * rx - 0.8);
	const out: G[] = [
		cyl("#6f9fc4", 1, 1, 0.05, 0, 0, 0, 20).scale(rx, 1, rz).translate(cx, 0, z),
		cyl("#8db8d8", 0.8, 0.8, 0.02, 0, 0.05, 0, 20)
			.scale(rx, 1, rz)
			.translate(cx + 0.1, 0, z + 0.05),
	];
	// The jetty: -1 to the left, 1 to the right, 0 none; it lies on the front half.
	const jetty = Math.floor(r() * 3) - 1;
	const stones = Math.round((rx + rz) * 8);
	for (let at = 0; at < stones; at++) {
		const angle = (at / stones) * Math.PI * 2;
		const [dx, dz] = [Math.cos(angle) * (rx + 0.1), Math.sin(angle) * (rz + 0.1)];
		if (jetty !== 0 && Math.sign(dx) === jetty && Math.abs(dx) > rx * 0.55 && dz > 0.05 && dz < rz * 0.8) continue;
		out.push(
			b(pick(["#9a948c", "#b3ada4", "#847d76"], r), 0.26 + r() * 0.2, 0.1 + (at % 5) * 0.035 + r() * 0.01, 0.24 + r() * 0.16, cx + dx, 0, z + dz, 0, [
				0,
				r() * 3,
				0,
			]),
		);
	}
	const pads = 3 + Math.floor(r() * 4);
	for (let at = 0; at < pads; at++) {
		const angle = r() * Math.PI * 2;
		const [px, pz] = [cx + Math.cos(angle) * rx * 0.5 * r(), z + Math.sin(angle) * rz * 0.5];
		out.push(
			cyl("#4fb26a", 0.14, 0.14, 0.02, px, 0.07 + at * 0.003, pz, 8),
			b(pick(["#ff9fce", "#ffffff", "#ffd166"], r), 0.05, 0.05, 0.05, px, 0.09 + at * 0.003, pz),
		);
	}
	// Reeds against the back of the pond, to its left or its right, on a lattice.
	const side = r() < 0.5 ? -1 : 1;
	for (let at = 0; at < 5 + Math.floor(r() * 4); at++) {
		const [px, pz, tall] = [cx + side * (rx * 0.55 + (at % 3) * 0.14), z - rz * 0.55 + Math.floor(at / 3) * 0.2, 0.4 + r() * 0.4];
		out.push(b("#3c8a4a", 0.03, tall, 0.03, px, 0, pz), b("#7a5234", 0.05, 0.12, 0.05, px, tall, pz));
	}
	if (jetty !== 0) {
		const jx = cx + jetty * (rx - 0.2);
		out.push(
			...[0, 0.16, 0.32, 0.48].map((dz) => b("#b98654", 0.6, 0.04, 0.13, jx, 0.12, z + rz * 0.15 + dz)),
			b("#7a5234", 0.06, 0.2, 0.06, jx - jetty * 0.25, 0, z + rz * 0.15),
			b("#7a5234", 0.06, 0.2, 0.06, jx - jetty * 0.25, 0, z + rz * 0.15 + 0.48),
		);
	}
	return out;
}

// A bandstand: a stone floor of six or eight sides, its posts, a pointed roof of one of four colours, sometimes a ring
// of flower beds.
export function bandstandIn({ x, z, w, d }: Plot, r: () => number): G[] {
	const sides = r() < 0.5 ? 6 : 8;
	const ringed = r() < 0.5 && Math.min(w, d) > 3.4;
	const rr = Math.min(0.9 + r() * 0.4, Math.min(w, d) / 2 - (ringed ? 0.75 : 0.25));
	const cx = x + (r() - 0.5) * Math.max(0, w - 2 * rr - (ringed ? 1.5 : 0.5));
	const roof = pick(["#2f6f55", "#c8553a", "#3d5a80", "#7a4a2a"], r);
	const out: G[] = [cyl("#e9e2d2", rr, rr + 0.05, 0.25, cx, 0, z, sides), cyl("#c9bfae", rr - 0.08, rr - 0.08, 0.02, cx, 0.25, z, sides)];
	for (let at = 0; at < sides; at++) {
		const angle = ((at + 0.5) / sides) * Math.PI * 2;
		out.push(b("#f3ead9", 0.06, 1.05, 0.06, cx + Math.cos(angle) * (rr - 0.12), 0.27, z + Math.sin(angle) * (rr - 0.12)));
	}
	out.push(
		cyl(roof, 0.04, rr + 0.12, 0.55, cx, 1.32, z, sides),
		cyl("#f3ead9", rr + 0.12, rr + 0.12, 0.05, cx, 1.27, z, sides),
		blob("#ffd166", 0.07, cx, 1.92, z),
	);
	if (ringed) {
		const hex = pick(FLOWERS, r);
		for (const [dx, dz] of [
			[-1, 0],
			[1, 0],
			[0, -1],
			[0, 1],
		] as const)
			out.push(...bed(cx + dx * (rr + 0.45), z + dz * (rr + 0.45), dx ? 0.35 : 0.9, dx ? 0.9 : 0.35, hex, r));
	}
	return out;
}

// A flower garden: rows of long beds, four beds round an urn, or a round bed with four small ones at its corners.
export function gardenIn({ x, z, w, d }: Plot, r: () => number): G[] {
	const colours = [pick(FLOWERS, r), pick(FLOWERS, r), pick(FLOWERS, r)];
	const kind = Math.floor(r() * 3);
	const out: G[] = [];
	if (kind === 0) {
		const rows = Math.max(2, Math.min(4, Math.floor((d - 0.2) / 0.85)));
		const long = Math.min(w - 0.4, 2.4 + r() * 1.6);
		for (let at = 0; at < rows; at++) out.push(...bed(x, z - ((rows - 1) * 0.85) / 2 + at * 0.85, long, 0.45, colours[at % 3]!, r));
	} else {
		const half = Math.min(w, d) / 2 - 0.2;
		const size = Math.min(1.1, half - 0.35);
		const off = size / 2 + 0.3;
		for (const [u, v] of [
			[-1, -1],
			[1, -1],
			[-1, 1],
			[1, 1],
		] as const)
			out.push(...bed(x + u * off, z + v * off, size, size, colours[(u + v + 2) % 3]!, r));
		if (kind === 1) out.push(b(STONE, 0.3, 0.45, 0.3, x, 0, z), cyl("#c9bfae", 0.18, 0.12, 0.2, x, 0.45, z, 8), blob("#3f9d4d", 0.16, x, 0.72, z));
		else
			out.push(
				cyl("#bfb6a8", 0.34, 0.36, 0.1, x, 0, z, 12),
				cyl("#5e3f2c", 0.3, 0.3, 0.04, x, 0.1, z, 12),
				...[0, 1, 2, 3, 4].map((at) => blob(colours[at % 3]!, 0.08, x + Math.cos(at * 1.26) * 0.16, 0.2 + at * 0.01, z + Math.sin(at * 1.26) * 0.16)),
			);
	}
	return out;
}

// A playground, its things, its corner of hedge and its sand drawn from the park's random. With its hedges it reaches
// 1.83 behind its middle and 1.81 in front, 1.98 to either side: it is set against the plot's back.
export function playIn({ x, z, w, d }: Plot, r: () => number): G[] {
	const hedge: 1 | -1 = r() < 0.5 ? 1 : -1;
	const look = {
		hedge,
		flip: r() < 0.5,
		set: pick<0 | 1 | 2>([0, 1, 2], r),
		sand: pick(["#e8d9a8", "#e4cf9a", "#d9c7a0", "#c9d3b0"], r),
		hedges: pick<0 | 1 | 2>([0, 1, 2], r),
	};
	const px = x + (r() - 0.5) * Math.max(0, w - 4.0);
	const pz = z - d / 2 + 1.85 + r() * Math.max(0, d - 3.7);
	return playground(px, pz, r, look);
}
