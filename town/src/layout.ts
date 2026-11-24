// The plan of a project's town (the city): its side in blocks, its water, its avenue and its parks, and where its
// subjects stand in it. What is built on each block is ./city.ts#decorate.
import type { Block, Grid } from "./grid";
import type { Topic } from "./kit";
import { rnd, T } from "./shapes";
import { PER_BLOCK, type Growth } from "./growth";

// The shape of a project's town: its side in blocks (a village for one or two subjects), its water (a canal across the
// streets' row, a river along the avenue's way, or a bay cut into the left corner), its avenue and its park.
// `big` is the largest park, in the middle of the town, in front of the monument.
export type Layout = { side: number; canal: number; river: number; avenue: number; bay: Set<string>; parks: Set<string>; big: string };
export const key = (i: number, j: number): string => `${i},${j}`;

// `crowded`: the town has venues (./venues.ts). Its front corner is then left to them: a park's trees there hid them.
function layoutOf(side: number, seed: number, tier: number, crowded = false): Layout {
	// A hamlet has no water through it: a canal or a river would take half of its few blocks.
	const water = tier === 0 ? "none" : (["canal", "river", "bay"] as const)[seed % 3]!;
	const bay = new Set<string>();
	if (water === "bay")
		for (const [i, j] of [
			[0, side - 1],
			[1, side - 1],
			[0, side - 2],
		] as const)
			if (side > 3 || i + j > side) bay.add(key(i, j));
	const river = water === "river" ? side - 2 : -1;
	const canal = water === "canal" ? side - 2 : -1;
	const avenue = river === 1 ? 2 : 1;
	// The big park: the free block nearest the middle (off the avenue's column if it can), the front corner's the other.
	const mid = (side - 1) / 2;
	const free = (i: number, j: number): boolean => i + j > 0 && j !== canal && i !== river && !bay.has(key(i, j));
	const cells = Array.from({ length: side * side }, (_, n) => [Math.floor(n / side), n % side] as const).filter(([i, j]) => free(i, j));
	const cost = ([i, j]: readonly [number, number]): number => Math.hypot(i - mid, j - mid) + (i === avenue ? 0.8 : 0) - 0.01 * (i + j);
	const big = cells.toSorted((p, q) => cost(p) - cost(q))[0] ?? [side - 1, side - 1];
	const parks = new Set([key(big[0], big[1])]);
	if (!crowded && free(side - 1, side - 1)) parks.add(key(side - 1, side - 1));
	return { side, canal, river, avenue, bay, parks, big: key(big[0], big[1]) };
}

// The smallest town that holds the subjects' blocks, the blocks its agents' houses need, and the squares where each
// subject's crowd spills (`spills`, ./quarters.ts): those take the blocks a subject may take, but the subjects' own and
// the two each subject's building hides: the town is laid out until every one of them has its block.
export function layoutFor(count: number, seed: number, growth: Growth, spills: number[] = []): Layout {
	const spilled = spills.reduce((sum, each) => sum + each, 0);
	const homes = Math.ceil((growth.houses / PER_BLOCK) * (1 + growth.open));
	for (let side = 2; ; side++) {
		const layout = layoutOf(side, seed, growth.tier, spilled > 0);
		const spots = spotsOf(layout).length;
		// The houses also take the blocks along the avenue, where no subject stands.
		const along = Array.from({ length: side }, (_, j) => j).filter(
			(j) => j !== layout.canal && layout.avenue !== layout.river && !layout.bay.has(key(layout.avenue, j)),
		).length;
		const spilling = spilled === 0 || (spots - 3 * count >= spilled && placed(layout, count, seed, spills));
		if (spilling && subjectSpots(layout, count, seed).length >= count && spots + along >= count + homes + spilled) return layout;
	}
}

// Whether every square of `spills` finds its block in `layout`.
function placed(layout: Layout, count: number, seed: number, spills: number[]): boolean {
	const ranked = subjectSpots(layout, count, seed);
	const taken = new Map(ranked.map(([i, j], index) => [key(i, j), index] as const));
	return spilledOn(layout, ranked, taken, spills).size === spills.reduce((sum, each) => sum + each, 0);
}

// Seen from the camera's home (./camera.ts#homeOf, from +x and +z), a block's building hides the front half of the square
// of the block behind it (i, j - 1) and of the one behind on the left (i - 1, j - 1): the subjects' buildings are the
// town's tallest, and their inhabitants stand on their squares (./figures-visible.test.ts).
const hides = ([i, j]: [number, number], [k, l]: [number, number]): boolean => l === j - 1 && (k === i || k === i - 1);

// Up to `count` spots for the subjects, near the middle first (shuffled by `seed`), none hiding another's square.
function subjectSpots(layout: Layout, count: number, seed: number): [number, number][] {
	const r = rnd(seed);
	const mid = (layout.side - 1) / 2;
	const ranked = spotsOf(layout)
		.map((spot) => ({ spot, key: Math.hypot(spot[0] - mid, spot[1] - mid) + r() * 1.6 }))
		.toSorted((a, b) => a.key - b.key)
		.map(({ spot }) => spot);
	const taken: [number, number][] = [];
	for (const spot of ranked) {
		if (taken.length === count) break;
		if (!taken.some((other) => hides(spot, other) || hides(other, spot))) taken.push(spot);
	}
	return taken;
}

// Where a subject may stand: not the monument's corner, the parks, the water, the avenue or the bay.
function spotsOf({ side, canal, river, avenue, bay, parks }: Layout): [number, number][] {
	const spots: [number, number][] = [];
	for (let i = 0; i < side; i++)
		for (let j = 0; j < side; j++)
			if (i + j > 0 && j !== canal && i !== river && i !== avenue && !bay.has(key(i, j)) && !parks.has(key(i, j))) spots.push([i, j]);
	return spots;
}

// The blocks round a held spot that must not be of a quarter: itself, the two its building would hide, and the one on
// its diagonal in front, whose ground lies as far along the front as its own (./part-material.ts#built).
const CLEAR = [
	[0, 0],
	[0, -1],
	[-1, -1],
	[1, 1],
] as const;

// `spills`: how many squares each subject's crowd spills onto, besides its own (./quarters.ts).
// `held`: the town holds the spot the next subject would take, for a subject that comes while it is open (./plot.ts):
// its block is then the subject `topics.length`'s. The spots are ranked whatever their count: a town opened again with
// that subject as its last one gives it the same block, while the town keeps its side. No town changes for it: without
// a free spot left, or with a quarter's square near it, it holds none.
export function cityGrid(topics: Topic[], seed: number, layout: Layout, spills: number[] = [], held = false): Grid {
	const { side } = layout;
	// The subjects prefer the middle, and none stands in front of another (`layoutFor` made the town big enough).
	const ranked = subjectSpots(layout, topics.length + (held ? 1 : 0), seed);
	const taken = new Map<string, number>();
	topics.forEach((_, index) => {
		const [i, j] = ranked[index]!;
		taken.set(`${i},${j}`, index);
	});
	const quarters = spilledOn(layout, ranked.slice(0, topics.length), taken, spills);
	const next = held ? ranked[topics.length] : undefined;
	if (next && CLEAR.every(([di, dj]) => !quarters.has(key(next[0] + di, next[1] + dj)))) taken.set(key(...next), topics.length);
	const all: Block[] = [];
	for (let i = 0; i < side; i++)
		for (let j = 0; j < side; j++)
			if (!layout.bay.has(key(i, j))) {
				const quarter = quarters.get(key(i, j));
				all.push({ i, j, x: i * T, z: j * T, topic: taken.get(key(i, j)) ?? -1, ...(quarter === undefined ? {} : { quarter }) });
			}
	return { all, of: (topic) => all.find((each) => each.topic === topic)! };
}

// The squares each subject's crowd spills onto, by block: in turns, each subject takes the free block nearest its own,
// so that its squares gather around it and two subjects never share one. None stands behind a subject's building.
// They go along their street first (the same j, a block of another street counts three times as far), where blocks
// touch without a street between them and their venues join into esplanades (./venues.ts).
// A venue is seen whole only when nothing stands on the blocks on its right, in front of it and in front on its right:
// seen from the camera's home, a house there hid the right half and the front rows of its paving (220 inhabitants of a
// town of 1 000, ./figures-visible.test.ts). Those blocks are out of the town, water or venues already: the venues
// grow from the town's front edges inwards.
const ACROSS = 3;
function spilledOn(layout: Layout, subjects: [number, number][], taken: Map<string, number>, spills: number[]): Map<string, number> {
	const { side, canal, river, bay } = layout;
	const quarters = new Map<string, number>();
	const left = [...spills];
	const open = (i: number, j: number): boolean => i >= side || j >= side || quarters.has(key(i, j)) || j === canal || i === river || bay.has(key(i, j));
	const seen = ([i, j]: [number, number]): boolean => open(i + 1, j) && open(i, j + 1) && open(i + 1, j + 1);
	let free = spotsOf(layout).filter((spot) => !taken.has(key(...spot)) && !subjects.some((subject) => hides(subject, spot)));
	for (let laid = true; laid && left.some((count) => count > 0);) {
		laid = false;
		subjects.forEach(([i, j], index) => {
			const ready = free.filter(seen);
			if (!left[index] || !ready.length) return;
			const far = ([k, l]: [number, number]): number => Math.hypot(k - i, (l - j) * ACROSS) + 0.001 * (k + l);
			const nearest = ready.reduce((best, spot) => (far(spot) < far(best) ? spot : best));
			free = free.filter((spot) => spot !== nearest);
			quarters.set(key(...nearest), index);
			left[index]--;
			laid = true;
		});
	}
	return quarters;
}
