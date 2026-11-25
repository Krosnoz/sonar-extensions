// The parks of the town's free blocks: paths on one of three plans, a centrepiece (./park-pieces.ts), groves, benches,
// lamps and planters, each put only where it touches nothing else.
import type { Trees } from "./city";
import type { Style } from "../../shared/styles";
import { REACH } from "../people/figures";
import type { Block } from "./grid";
import { bandstandIn, fountainIn, gardenIn, playIn, pondIn, type Plot } from "./park-pieces";
import { b, T, type G } from "../render/shapes";
import { ROAD } from "./street";
import { bench, lamp, planter } from "./street-furniture";

const PATH = "#c9b9a6";
const PIECES = ["fountain", "pond", "play", "bandstand", "garden", "grove"] as const;
type Piece = (typeof PIECES)[number];
// A rectangle on the block's ground: x from, x to, z from, z to.
type Rect = [number, number, number, number];
const BACK = -5.3;
const FRONT = 2.45;

// The plans, drawn for a park whose land runs from x -5.3 to `e`: a cross with the piece in the back-left corner, a
// promenade along the front with the piece behind it, or a ring of paths round the piece. Their paths and their plot.
function planOf(plan: number, e: number): { paths: Rect[]; plot: Rect } {
	if (plan === 0)
		return {
			paths: [
				[-0.05, 1.05, -5.25, 2.55],
				[-3, e, -1.2, -0.2],
			],
			plot: [-5.2, -0.2, -5.2, -1.35],
		};
	if (plan === 1) {
		const x = Math.min(1.6, e - 1.5);
		return {
			paths: [
				[-5.3, e, 0.45, 1.35],
				[x - 0.5, x + 0.5, -5.25, 0.45],
				[-2.9, -1.9, 1.35, 2.55],
			],
			plot: [-5.2, x - 0.65, -5.2, 0.3],
		};
	}
	const cx = (e - 5.3) / 2 - 0.6;
	const hx = Math.min(3.2, cx + 5.25, e - cx);
	return {
		paths: [
			[cx - hx, cx + hx, 0.5, 1.2],
			[cx - hx, cx + hx, -4.4, -3.7],
			[cx - hx, cx - hx + 0.7, -3.7, 0.5],
			[cx + hx - 0.7, cx + hx, -3.7, 0.5],
			[cx - 0.45, cx + 0.45, 1.2, 2.55],
		],
		plot: [cx - hx + 0.85, cx + hx - 0.85, -3.55, 0.35],
	};
}

const overlaps = (p: Rect, q: Rect): boolean => p[0] < q[1] && q[0] < p[1] && p[2] < q[3] && q[2] < p[3];

// What a park keeps as it is laid out: its land's end `e`, its paths, the ground taken, what stands in it (the piece,
// the lamps, the benches, the planters, at its own size: a crown keeps off it), and what it draws.
type Laid = { r: () => number; e: number; paths: Rect[]; taken: Rect[]; standing: Rect[]; out: G[] };

const clear = (laid: Laid, rect: Rect): boolean =>
	rect[0] >= BACK && rect[1] <= laid.e && rect[2] >= BACK && rect[3] <= FRONT && !laid.taken.some((t) => overlaps(rect, t));

// A spot beside a path, `gap` out of its edge, on one of its sides: [x, z, the way it faces, along x or not].
function beside({ r, paths }: Laid, gap: number): [number, number, number] {
	const [x0, x1, z0, z1] = paths[Math.floor(r() * paths.length)]!;
	const side = r() < 0.5 ? -1 : 1;
	if (x1 - x0 > z1 - z0) return [x0 + r() * (x1 - x0), side < 0 ? z0 - gap : z1 + gap, side < 0 ? 0 : Math.PI];
	return [side < 0 ? x0 - gap : x1 + gap, z0 + r() * (z1 - z0), side < 0 ? Math.PI / 2 : -Math.PI / 2];
}

// The piece that stands in the plot.
function pieceIn(piece: Piece, area: Plot, r: () => number): G[] {
	if (piece === "fountain") return fountainIn(area, r);
	if (piece === "pond") return pondIn(area, r);
	if (piece === "play") return playIn(area, r);
	if (piece === "bandstand") return bandstandIn(area, r);
	if (piece === "garden") return gardenIn(area, r);
	return [];
}

// The piece keeps the ground it covers and 0.3 round it.
function keep(laid: Laid, made: G[]): void {
	if (!made.length) return;
	const box = [Infinity, -Infinity, Infinity, -Infinity] as Rect;
	for (const part of made) {
		part.computeBoundingBox();
		const { min, max } = part.boundingBox!;
		[box[0], box[1], box[2], box[3]] = [Math.min(box[0], min.x), Math.max(box[1], max.x), Math.min(box[2], min.z), Math.max(box[3], max.z)];
	}
	laid.taken.push([box[0] - 0.3, box[1] + 0.3, box[2] - 0.3, box[3] + 0.3]);
	laid.standing.push(box);
	laid.out.push(...made);
}

// Lamps: two (three in the big park), 0.8 or more from any trunk. Returns their feet.
function lamps(laid: Laid, big: boolean): [number, number][] {
	const poles: [number, number][] = [];
	for (let tries = 0; tries < 40 && poles.length < (big ? 3 : 2); tries++) {
		const [x, z] = beside(laid, 0.3);
		const rect: Rect = [x - 0.15, x + 0.15, z - 0.15, z + 0.15];
		if (z > 2.1 || !clear(laid, rect) || poles.some(([px, pz]) => Math.hypot(px - x, pz - z) < 3)) continue;
		// A bench or a planter keeps 0.3 off it, as off the piece: one put against its foot touched its head.
		laid.taken.push([rect[0] - 0.3, rect[1] + 0.3, rect[2] - 0.3, rect[3] + 0.3]);
		laid.standing.push(rect);
		poles.push([x, z]);
		laid.out.push(...lamp(x, z));
	}
	return poles;
}

// Benches facing a path.
function benches(laid: Laid, big: boolean): void {
	const seats = (big ? 4 : 2) + Math.floor(laid.r() * 2);
	for (let [tries, put] = [0, 0]; tries < 60 && put < seats; tries++) {
		const [x, z, ry] = beside(laid, 0.32);
		const across = Math.abs(Math.sin(ry)) > 0.5;
		const rect: Rect = across ? [x - 0.25, x + 0.25, z - 0.42, z + 0.42] : [x - 0.42, x + 0.42, z - 0.25, z + 0.25];
		if (!clear(laid, rect)) continue;
		laid.taken.push(rect);
		laid.standing.push(rect);
		put++;
		laid.out.push(...bench(0, 0).map((part) => part.translate(0, -0.06, 0).scale(0.8, 0.8, 0.8).rotateY(ry).translate(x, 0.06, z)));
	}
}

// Planters beside a path.
function planters(laid: Laid, big: boolean): void {
	const { r } = laid;
	for (let [tries, put, want] = [0, 0, big ? 3 : Math.floor(r() * 3)]; tries < 40 && put < want; tries++) {
		const [x, z] = beside(laid, 0.5);
		const rect: Rect = [x - 0.4, x + 0.4, z - 0.4, z + 0.4];
		if (!clear(laid, rect)) continue;
		laid.taken.push(rect);
		laid.standing.push(rect);
		put++;
		laid.out.push(...planter(x, z, r));
	}
}

// Trees of two kinds, the town's and one of any, in groves of two to four; the lawn of trees fills its plot first.
// A crown keeps off the paths and what was put, 0.8 from a lamp, and short of the avenue and the edges.
function groves(laid: Laid, style: Style, block: Block, trees: Trees, end: number, big: boolean, piece: Piece, plot: Rect, poles: [number, number][]): void {
	const { r, e, standing } = laid;
	const kinds = [style.trees[Math.floor(r() * style.trees.length)]!, Math.floor(r() * 3)];
	// Two crowns never overlap on the ground: each keeps its whole reach (REACH in ../people/figures.ts) from the other's. A square
	// of half its reach let the groves' crowns run into one another (12/11).
	const crowns: [number, number, number][] = [];
	const plant = (x: number, z: number, size: number): boolean => {
		const half = 0.42 * size;
		const rect: Rect = [x - half, x + half, z - half, z + half];
		const kind = kinds[r() < 0.65 ? 0 : 1]!;
		const reach = REACH[kind]! * size;
		if (x < -4.6 || x > end - 0.9 || z < -4.6 || z > 1.8 || !clear(laid, rect) || crowns.some(([cx, cz, cr]) => Math.hypot(cx - x, cz - z) < cr + reach))
			return false;
		if (poles.some(([px, pz]) => Math.hypot(px - x, pz - z) < 0.8)) return false;
		// The crown's whole reach, not the trunk's square, keeps off what stands: a conifer 0.3 out of a flower garden's box
		// spread its lowest boughs over the corner of a bed.
		const under = ([x0, x1, z0, z1]: Rect): boolean => Math.hypot(x - Math.max(x0, Math.min(x, x1)), z - Math.max(z0, Math.min(z, z1))) < reach;
		if (standing.some(under)) return false;
		crowns.push([x, z, reach]);
		trees(kind).put({ x: block.x + x, y: 0, z: block.z + z, ry: r() * 6, s: size });
		return true;
	};
	if (piece === "grove")
		for (let tries = 0, put = 0; tries < 60 && put < 7; tries++)
			if (plant(plot[0] + r() * (plot[1] - plot[0]), plot[2] + r() * (plot[3] - plot[2]), 0.9 + r() * 0.5)) put++;
	const want = (big ? 14 : 8) + Math.floor(r() * 4);
	for (let tries = 0, put = 0; tries < 30 && put < want; tries++) {
		const [gx, gz] = [BACK + r() * (e - BACK), BACK + r() * (FRONT - BACK)];
		const size = 0.9 + r() * 0.5;
		for (let at = 0; at < 2 + Math.floor(r() * 3); at++) if (plant(gx + (r() - 0.5) * 2, gz + (r() - 0.5) * 2, size * (0.85 + r() * 0.3))) put++;
	}
}

// One park. `plan`: 0 to 2 the plans above, 3 to 5 the same mirrored across the block (only where no avenue runs on its
// right). `piece`, what stands in its plot.
function park(style: Style, block: Block, trees: Trees, end: number, big: boolean, r: () => number, piece: Piece, plan: number): G[] {
	const e = Math.min(5.3, end - 0.2);
	const s = plan >= 3 ? -1 : 1;
	const flip = ([x0, x1, z0, z1]: Rect): Rect => (s === 1 ? [x0, x1, z0, z1] : [-x1, -x0, z0, z1]);
	const { paths: drawn, plot: inDesign } = planOf(plan % 3, e);
	const paths = drawn.map(flip);
	const plot = flip(inDesign);
	const out: G[] = paths.map(([x0, x1, z0, z1]) => b(PATH, x1 - x0, ROAD, z1 - z0, (x0 + x1) / 2, 0, (z0 + z1) / 2));
	const laid: Laid = { r, e, paths, taken: [...paths], standing: [], out };
	const area: Plot = { x: (plot[0] + plot[1]) / 2, z: (plot[2] + plot[3]) / 2, w: plot[1] - plot[0], d: plot[3] - plot[2] };
	keep(laid, pieceIn(piece, area, r));
	const poles = lamps(laid, big);
	benches(laid, big);
	planters(laid, big);
	groves(laid, style, block, trees, end, big, piece, plot, poles);
	return out;
}

// The parks of one town. Each takes a piece and a plan that none of the parks within two blocks of it (corners counted)
// made before it has, or, short of one, the one they have least (a park next to it counts ten of those two blocks away);
// the draw is the block's own random, so that the town is the same at every visit.
export function parkPlanner(): (style: Style, block: Block, trees: Trees, end: number, big: boolean, r: () => number) => G[] {
	const made: { i: number; j: number; piece: Piece; plan: number }[] = [];
	return (style, block, trees, end, big, r) => {
		const away = (m: { i: number; j: number }): number => Math.max(Math.abs(m.i - block.i), Math.abs(m.j - block.j));
		const near = made.filter((m) => away(m) <= 2);
		const choose = <Item>(options: readonly Item[], used: Item[]): Item => {
			const count = (o: Item): number => used.reduce((sum, u, at) => sum + (u === o ? (away(near[at]!) === 1 ? 10 : 1) : 0), 0);
			const least = Math.min(...options.map(count));
			const pool = options.filter((o) => count(o) === least);
			return pool[Math.floor(r() * pool.length)]!;
		};
		const piece = choose(
			PIECES,
			near.map((m) => m.piece),
		);
		const plan = choose(
			end >= T / 2 ? [0, 1, 2, 3, 4, 5] : [0, 1, 2],
			near.map((m) => m.plan),
		);
		made.push({ i: block.i, j: block.j, piece, plan });
		return park(style, block, trees, end, big, r, piece, plan);
	};
}
