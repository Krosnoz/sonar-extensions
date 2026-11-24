// A project's town, after the rules of the reference dioramas.
// The subjects' blocks stay those of ./town.ts; round them, a generated fabric of decor: a monument at the back,
// towers behind, blocks of flats in the middle, houses in rows in front, a park at the front, avenues across. The
// style (family of houses, palette, trees, monument) comes from the project's name: each project has its town.
import type { Block } from "./grid";
import type { HeightMap } from "./heights";
import type { Kit } from "./kit";
import { THREE, merge } from "./nodes";
import { rnd, T, type G } from "./shapes";
import { courseOf, wind } from "./course";
import { land, lawnOf, drainOf, type Channel, type Rim } from "./street";
import { avenueStrip } from "./avenue";
import { traffic } from "./traffic";
import { parkPlanner } from "./parks";
import { tree } from "./figures";
import { cornerOf } from "./corner";
import { meadow, thingOf } from "./meadows";
import { towerWalls } from "./palette";
import { FLOOR, GROUND } from "./facades-kit";
import { peaksOf } from "./peaks";
import { PER_BLOCK, type Growth } from "./growth";
import { key, type Layout } from "./layout";
import type { Steps } from "./steps";
import type { Style } from "./styles";
import { monument } from "./monument";
import { BEND, HALF, canalStrip, canalSwell, riverStrip } from "./water-strips";
import { closeTo, houses } from "./city-houses";
import { planted, surfaceOf, type Standing } from "./held-block";
// The highest a tree may stand: two storeys of a house, 2.5 (the ground floor, then one floor).
const TREE_TOP = GROUND + FLOOR;
// The part of a lamp's glass (./shapes.ts#piece).
const LAMP = 4;

// --- Blocks ------------------------------------------------------------------------------------------------------

// Where a block lies from the back corner (0) to the front corner (1): the town is high at the back and low in front.
const depthOf = (block: Block, side: number): number => (block.i + block.j) / Math.max(1, 2 * side - 2);

// The share of the blocks beside the subjects that stay squares in a city: the subjects' quarter reads from afar.
const CLEARING = 0.5;

export type Trees = (kind: number) => ReturnType<Kit["part"]>;
// What stands on the block the town holds for a subject to come: its part, and points of its surface (./held-block.ts).
export type Old = { part: ReturnType<Kit["part"]>; standing: Standing[] };

// What the town decides once for all its blocks, before it builds them one by one.
export type Plan = {
	kit: Kit;
	style: Style;
	seed: number;
	growth: Growth;
	layout: Layout;
	subjects: Block[];
	trees: Trees;
	exists: (i: number, j: number) => boolean;
	order: Block[];
	built: number;
	spreading: boolean;
	quota: Map<Block, number>;
	left: { n: number };
	tower: ReturnType<typeof towerWalls>;
	boats: Set<number>;
	parked: ReturnType<typeof parkPlanner>;
};

// One part per kind of tree, made at its first tree.
function treesOf(kit: Kit): Trees {
	const made = new Map<number, ReturnType<Kit["part"]>>();
	return (kind: number) => {
		if (!made.has(kind)) {
			const geometry = tree(kind);
			geometry.computeBoundingBox();
			const [part, top] = [kit.part(geometry, 60, { still: true }), geometry.boundingBox!.max.y];
			// Whatever the scale a place asks for, a tree stays under two storeys of a house (GROUND + FLOOR): at 1.5 a round one
			// stood 3.2 high, almost three storeys.
			made.set(kind, { ...part, put: (given) => part.put({ ...given, s: typeof given.s === "object" ? given.s : Math.min(given.s ?? 1, TREE_TOP / top) }) });
		}
		return made.get(kind)!;
	};
}

// The blocks are merged into a few meshes, by where they lie along the front: each is built when the front passes.
// `apart`: what stands on the block the town holds for a subject to come, kept out of the buckets (./held-block.ts).
function bucketsOf(heights: HeightMap): { buckets: Map<number, G[]>; apart: G[]; add: (block: Block, parts: G[], held?: boolean) => void } {
	const buckets = new Map<number, G[]>();
	const apart: G[] = [];
	const add = (block: Block, parts: G[], held = false): void => {
		const bucket = block.i - block.j;
		const placed = parts.map((part) => part.translate(block.x, 0, block.z));
		// Each piece's box in the town's heights: a building hides the names of the figures behind it (./heights.ts). The
		// ground and what lies on it hide no head.
		for (const part of placed) {
			part.computeBoundingBox();
			const { min, max } = part.boundingBox!;
			if (max.y > 0.5) heights.add(min.x, min.z, max.x, max.z, max.y);
			// A lamp's glass: its middle is a point a sign keeps clear of (./signs.ts).
			// A street lamp's glass carries its post's width in its fraction (./street-furniture.ts#lamp).
			if (Math.floor(part.getAttribute("aPart")?.getX(0) ?? 0) === LAMP) heights.lamps.push([(min.x + max.x) / 2, (min.y + max.y) / 2, (min.z + max.z) / 2]);
		}
		if (held) apart.push(...placed);
		else buckets.set(bucket, [...(buckets.get(bucket) ?? []), ...placed]);
	};
	return { buckets, apart, add };
}

function planOf(
	kit: Kit,
	fills: Block[],
	subjects: Block[],
	layout: Layout,
	style: Style,
	seed: number,
	growth: Growth,
	trees: Trees,
): { sequence: Block[]; plan: Plan } {
	const { side, canal, river, avenue, parks, bay } = layout;
	const exists = (i: number, j: number): boolean => i >= 0 && j >= 0 && i < side && j < side && !bay.has(key(i, j));
	const special = (block: Block): boolean => block.j === canal || block.i === river || block.i + block.j === 0 || parks.has(key(block.i, block.j));
	// The houses fill from the middle of the town outwards (with a jitter, so that it is no ring), and what is left
	// beyond, once the agents are housed, stays countryside. The tall blocks stay at the back among the housed ones.
	const mid = (side - 1) / 2;
	const near = new Map(fills.map((block) => [block, Math.hypot(block.i - mid, block.j - mid) + rnd(seed + block.i * 5 + block.j)() * 1.4]));
	const sequence = fills.toSorted((p, q) => near.get(p)! - near.get(q)!);
	// From a city on, the houses do not stop at a ring with the countryside beyond: every free block keeps some, fewer and
	// fewer from the middle outwards (down to a quarter of the middle's), so that the density falls without a step.
	const spreading = growth.tier >= 3;
	const free = sequence.filter((block) => !special(block));
	const built = spreading ? free.length : Math.ceil(growth.houses / PER_BLOCK);
	const order = free.slice(0, built).toSorted((p, q) => depthOf(p, side) - depthOf(q, side));
	// The towers of the whole town wear walls apart from one another.
	const tower = towerWalls(style.walls);
	const left = { n: growth.houses };
	const weight = (rank: number): number => 1 - 0.75 * (rank / Math.max(1, free.length - 1));
	// A share of the free blocks are squares, and every one of the middle's near the subjects is one in about two: the
	// houses that would stand there go to the others.
	const housed = 0.55 * (1 - (growth.open / (1 + growth.open)) * 0.8);
	const per = growth.houses / (free.reduce((sum, _, rank) => sum + weight(rank), 0) * housed);
	const quota = new Map(free.map((block, rank) => [block, Math.round(per * weight(rank))] as const));
	// Two or three of the canal's blocks carry a boat (the avenue's, with its bridge, none).
	const afloat = fills.filter((each) => each.j === canal && each.i !== avenue).map((each) => each.i);
	const boats = new Set(afloat.toSorted((p, q) => rnd(seed + 409 + p)() - rnd(seed + 409 + q)()).slice(0, 2 + (seed % 2)));
	// Each park takes a plan and a piece that the parks near it have not (./parks.ts#parkPlanner).
	const parked = parkPlanner();
	return { sequence, plan: { kit, style, seed, growth, layout, subjects, trees, exists, order, built, spreading, quota, left, tower, boats, parked } };
}

// The canal's strip through a block: its quays, its water, a boat on two or three of them.
function canalParts(p: Plan, block: Block, r: () => number, crossed: boolean, rim: Rim): G[] {
	const { seed, layout } = p;
	return canalStrip(
		r,
		block.i,
		crossed,
		canalSwell(seed, block.i, layout.avenue),
		p.boats.has(block.i) ? seed + 409 + block.i : null,
		rim.right && !crossed ? "hi" : false,
	);
}

// What stands on a block past its ground: water, the monument, a park, a meadow, a square or houses.
function placeParts(p: Plan, block: Block, r: () => number, parts: G[], crossed: boolean, rim: Rim, end: number, rank: number): void {
	const { style, trees, growth, layout, seed, subjects, spreading } = p;
	const { canal, river, parks } = layout;
	if (block.j === canal) {
		parts.push(...canalParts(p, block, r, crossed, rim));
	} else if (block.i === river) {
		parts.push(...riverStrip(r, block, trees, !p.exists(block.i, block.j - 1)));
	} else if (block.i === 0 && block.j === 0) {
		// A hamlet has no monument yet: a well on its green.
		parts.push(...(growth.tier === 0 ? meadow(style, block, r, trees, end, 0) : monument(style, block, trees, growth.tier, r)));
	} else if (parks.has(key(block.i, block.j))) {
		parts.push(...p.parked(style, block, trees, end, key(block.i, block.j) === layout.big, r));
	} else if (p.left.n <= 0 || (spreading && !p.quota.get(block))) {
		parts.push(...meadow(style, block, r, trees, end, thingOf(block.i, block.j, seed)));
	} else if (spreading && closeTo(block, subjects) ? r() < CLEARING : !closeTo(block, subjects) && r() < growth.open / (1 + growth.open)) {
		// A square between the houses: room to see the people of the town walk.
		parts.push(...p.parked(style, block, trees, end, false, r));
	} else {
		houses(p, block, r, parts, crossed, rim, end, rank);
	}
}

// A block's parts: its ground, the avenue's pavement where it runs, and what stands on it.
function blockParts(p: Plan, block: Block): G[] {
	const { seed, exists } = p;
	const { canal, river, avenue } = p.layout;
	const r = rnd(seed + block.i * 31 + block.j * 7);
	// The island's front corner turns its street along the right edge, as the avenue (./corner.ts).
	const corner = cornerOf(block, exists, avenue, canal);
	const crossed = block.i === avenue || corner === "turn";
	// The street's zebra crossing leaves from a walk: only a block of houses, which has one, adds it (below).
	const rim: Rim = {
		left: !exists(block.i - 1, block.j),
		right: !exists(block.i + 1, block.j),
		front: !exists(block.i, block.j + 1),
		back: !exists(block.i, block.j - 1),
		crossing: false,
		joined: corner === "join",
	};
	// The water's course through the block, if it has one: the canal (along x) or the river (along z). The ground is cut
	// out of it, into a trench.
	const channel: Channel | undefined =
		block.j === canal
			? { course: courseOf(-1.7, HALF, BEND, block.i % 2 ? 1 : -1, canalSwell(seed, block.i, avenue)), across: false }
			: block.i === river
				? { course: courseOf(1.8, HALF, BEND, block.j % 2 ? 1 : -1), across: true }
				: undefined;
	const parts: G[] = [
		merge(
			land(
				r,
				crossed,
				block.i === river,
				rim,
				channel,
				(block.i + block.j) % 2 === 0,
				lawnOf(block.i * 3 + block.j * 5),
				drainOf(block.i + block.j * 2, crossed),
			),
		),
	];
	const end = crossed ? 2.4 : T / 2;
	const rank = p.order.indexOf(block);
	if (crossed) {
		// Over the canal the avenue's pavement runs up to the quays, along the course (the same sign as canalStrip's).
		const [swell, sign] = [canalSwell(seed, block.i, avenue), block.i % 2 ? 1 : -1];
		parts.push(
			...avenueStrip(block.j === canal, !exists(block.i, block.j - 1), block.j === canal ? (u) => wind(u, -1.7, BEND, sign) + swell(u).shift : undefined),
		);
	}
	placeParts(p, block, r, parts, crossed, rim, end, rank);
	return parts;
}

// Then all the buckets are one mesh, drawn at once: each vertex keeps where its bucket's middle lies along the front
// (`aAlong`, ./parts.ts), so each bucket is still built when the front passes it. A mesh per bucket was a draw per
// bucket, in the town's pass and in the sun's: about 25 of each, the third of a frame's draws.
// `apart`: what stands on the block held for a subject to come, a part of its own (`old`), which leaves when the
// subject comes (./plot.ts).
// `trees`: its trees, which count neither in the town's height nor among its peaks, as the town's other trees.
function* merged(kit: Kit, buckets: Map<number, G[]>, apart: G[], trees: G[]): Steps<{ highest: number; peaks: [number, number, number][]; old?: Old }> {
	let highest = 0;
	const peaks: [number, number, number][] = [];
	const whole: G[] = [];
	const one = (parts: G[], more: G[] = []): G => {
		const built = merge(parts);
		built.computeBoundingBox();
		const centre = built.boundingBox!.getCenter(new THREE.Vector3());
		highest = Math.max(highest, built.boundingBox!.max.y);
		// Above a house's ground floor: lower, a building stands inside the island's frame.
		peaks.push(...peaksOf(built, 2));
		const geometry = more.length ? merge([built, ...more]) : built;
		const count = geometry.getAttribute("position").count;
		geometry.setAttribute("aAlong", new THREE.BufferAttribute(new Float32Array(count).fill(kit.along(centre.x, 0, centre.z)), 1));
		return geometry;
	};
	for (const parts of buckets.values()) {
		yield;
		whole.push(one(parts));
	}
	yield;
	const look = { x: 0, y: 0, z: 0, color: "#ffffff", w: 0.18, seed: 0.5 };
	if (whole.length) kit.part(merge(whole), 1).put(look);
	if (!apart.length) return { highest, peaks };
	const geometry = one(apart, trees);
	const part = kit.part(geometry, 1, { plot: "old" });
	part.put(look);
	return { highest, peaks, old: { part, standing: surfaceOf(geometry) } };
}

// A step a block, and a step a merge: the browser takes its hand back between them (./steps.ts).
export function* decorate(
	kit: Kit,
	fills: Block[],
	subjects: Block[],
	layout: Layout,
	style: Style,
	seed: number,
	growth: Growth,
	heights: HeightMap,
	held?: Block,
): Steps<{ highest: number; peaks: [number, number, number][]; tick: (seconds: number) => void; old?: Old }> {
	const trees = treesOf(kit);
	const { buckets, apart, add } = bucketsOf(heights);
	const { sequence, plan } = planOf(kit, fills, subjects, layout, style, seed, growth, trees);
	const own: G[] = [];
	for (const block of sequence) {
		if (block === held) add(block, blockParts({ ...plan, trees: planted(own, TREE_TOP) }, block), true);
		else add(block, blockParts(plan, block));
		yield;
	}
	const moving = traffic(kit, layout, seed);
	const { highest, peaks, old } = yield* merged(kit, buckets, apart, own);
	return { highest, peaks, tick: moving, ...(old ? { old } : {}) };
}
