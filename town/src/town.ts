// A town in isometric view, a diorama on the page's background, without a sea. A subject is a block with its building,
// its square and its street; its agents are the inhabitants (./inhabitants.ts). The building has more storeys when the
// subject has more agents, and more lit windows when more of them work. Around the subjects, the city's own blocks
// (./city.ts): houses, parks, water and a monument, without a figure, so that every figure is an agent.
import { HIGHEST, LOWEST, box, camera } from "./camera";
import { rising } from "./peaks";
import { R, type Block, type Grid } from "./grid";
import { inhabitants } from "./inhabitants";
import type { Kit, SceneDef, Topic, World } from "./kit";
import { lampsOf } from "./squares";
import { BD, BW, T, rnd } from "./shapes";
import { BOTTOM, edgeLight } from "./plinth";
import { decorate, type Old } from "./city";
import { styleFor } from "./styles";
import { cityGrid, layoutFor } from "./layout";
import { designsOf, type Design } from "./designs";
import { looksOf } from "./looks";
import { floorsOf, partsOf, raise, type Anchor, type Parts } from "./town-blocks";
import { quartersOf } from "./quarters";
import { quartersBuilt } from "./venues";
import { growthOf } from "./growth";
import { heightMap, type HeightMap } from "./heights";
import { shownProject } from "./sonar";
import { landing } from "./landing";
import type { Stage, Wanted } from "./live-steps";
import { plots } from "./plot";
import type { House } from "./rising";
import { scaffolds } from "./scaffolds";
import { sites } from "./sites";
import { finish } from "./steps";

// Higher than a lamp, a bench or a fence: a building, which the camera keeps on the screen.
const BUILT = 2;

// The roofs' main colour, for the cubes of the page to take it as they come.
const ROOFS = ["#56637a", "#a8a39a", "#b5654a"];

// The points the camera must see: every block's corners, from the sea to the ground, and the top of every building.
function seenOf(all: Block[], anchors: Anchor[]): [number, number, number][] {
	const corners = all.flatMap(({ x, z }) =>
		[
			[-1, -1],
			[1, -1],
			[1, 1],
			[-1, 1],
		].flatMap(([sx = 0, sz = 0]): [number, number, number][] => [
			[x + (sx * T) / 2, 0, z + (sz * T) / 2],
			[x + (sx * T) / 2, BOTTOM, z + (sz * T) / 2],
		]),
	);
	const tops = anchors.flatMap(({ at: [x, y, z] }): [number, number, number][] => [
		[x - BW / 2, y + 1.8, z - BD / 2],
		[x + BW / 2, y + 1.8, z + BD / 2],
	]);
	return [...corners, ...tops];
}

// The middle of each subject's block, and the colours of its building: walls, roof, paving.
function lotsOf(blocks: Grid, anchors: Anchor[], designs: Design[]): World["lots"] {
	return anchors.map(({ at, index }) => {
		const { x, z } = blocks.of(index);
		const house = {
			at: [at[0], at[2]] as [number, number],
			w: BW,
			d: BD,
			top: at[1] - 1.6,
			wall: designs[index]!.tint,
			roof: ROOFS[designs[index]!.roof]!,
			paving: "#dccfbb",
		};
		return { at: [x, z], side: T, house };
	});
}

type Topics = Topic[];
type Point = [number, number, number];

// What the town is made of before it is built: its style, seed and size, its subjects' looks and quarters, its layout
// and its blocks.
function planOf(topics: Topics) {
	const project = shownProject();
	const style = styleFor(project);
	const seed = Array.from(project).reduce((h, c) => h * 31 + c.charCodeAt(0), 3) % 9973;
	// The town's size follows its agents.
	const agents = topics.reduce((sum, topic) => sum + topic.agents.length, 0);
	const growth = growthOf(agents);
	const own = looksOf(topics);
	// The squares of each subject's crowd: the crowd its square cannot show spills onto its quarter.
	const spilling = quartersOf(topics, (index) => lampsOf(own[index]!.place).map(([lx]) => lx));
	const spills = spilling.map((squares) => squares.length - 1);
	const layout = layoutFor(topics.length, seed, growth, spills);
	const blocks = cityGrid(topics, seed, layout, spills, true);
	// The block the town holds for a subject to come (./plot.ts), when its plan has one: that subject is its last one,
	// without a name nor an agent, and the town's own decor stands on its block until it comes.
	const held = blocks.all.find((each) => each.topic === topics.length);
	const coming: Topic = { name: "", agents: [], working: 0, waiting: 0, reviewing: 0, held: true };
	const all = held ? [...topics, coming] : topics;
	// A subject's look is drawn after those before it: the others keep theirs.
	const looks = held ? looksOf(all) : own;
	const lamps = (index: number): number[] => lampsOf(looks[index]!.place).map(([lx]) => lx);
	const quarters = held ? [...spilling, [coming.agents]] : spilling;
	const fills = blocks.all.filter((each) => (each.topic < 0 && each.quarter === undefined) || each === held);
	const places = [...new Set(looks.map(({ place }) => place))];
	return { style, seed, growth, looks, lamps, quarters, layout, blocks, fills, places, all, held };
}

// The town's heights, which also note the buildings' corners on the ground, higher than a lamp or a bench: the camera
// keeps them on the screen.
function recording(heights: HeightMap): { recorded: HeightMap; built: Point[] } {
	const built: Point[] = [];
	const recorded: HeightMap = {
		...heights,
		add: (x0, z0, x1, z1, top) => {
			heights.add(x0, z0, x1, z1, top);
			if (top > BUILT) built.push([x0, 0, z0], [x1, 0, z0], [x0, 0, z1], [x1, 0, z1]);
		},
	};
	return { recorded, built };
}

// A town of 200 agents and more: its neighbours rise to four storeys (./growth.ts).
const cityOf = ({ growth }: ReturnType<typeof planOf>): boolean => growth.tier >= 3;

// A subject's house in the town's heights.
const hides = (heights: HeightMap, { at }: Anchor): void => heights.add(at[0] - BW / 2, at[2] - BD / 2, at[0] + BW / 2, at[2] + BD / 2, at[1]);

// The subjects' buildings, and their heights noted.
function raiseAll(
	kit: Kit,
	topics: Topics,
	parts: Parts,
	plan: ReturnType<typeof planOf>,
	recorded: HeightMap,
): { anchors: Anchor[]; houses: House[]; designs: Design[] } {
	const { blocks, looks } = plan;
	const least = cityOf(plan) ? 7 : 1;
	// In a city every subject has its fewest storeys (seven): its height may then tell it from the others.
	// Seen together: three blocks apart or less.
	const near = (a: number, b: number): boolean => Math.max(Math.abs(blocks.of(a).x - blocks.of(b).x), Math.abs(blocks.of(a).z - blocks.of(b).z)) <= 3 * T + 0.1;
	const designs = designsOf(
		looks,
		topics.map((topic) => floorsOf(topic, least)),
		least > 6,
		near,
	);
	// The building of a subject to come draws from a run of its own: the others keep their draws, with or without it.
	const apart = { ...kit, random: rnd(plan.seed + 7919) };
	const raised = topics.map((topic, index) => raise(topic.held ? apart : kit, parts, topic, index, blocks.of(index), looks[index], least, designs[index]));
	const anchors = raised.map(({ anchor }) => anchor);
	// The subjects' houses hide the figures behind them too: from the ground to the roof their sign stands on.
	for (const anchor of anchors) if (!anchor.topic.held) hides(recorded, anchor);
	return { anchors, houses: raised.map(({ house }) => house), designs };
}

// The block the town holds for a subject to come, and how it is built when that subject comes (./plot.ts); nothing
// when the town holds none. `high`: the town's top. `built`: its building and its square's lamps count in the town's
// heights from then on.
function comingOf(kit: Kit, plan: ReturnType<typeof planOf>, anchors: Anchor[], houses: House[], old: Old | undefined, high: number, heights: HeightMap) {
	const { all, held, looks } = plan;
	if (!held || !old) return null;
	const index = all.length - 1;
	const plot = plots(kit, { topic: all[index]!, index, house: houses[index]!, block: held, old, high }, all);
	const built = (): void => {
		hides(heights, anchors[index]!);
		for (const [lx, y, lz] of lampsOf(looks[index]!.place)) heights.lamps.push([held.x + lx, y, held.z + lz]);
	};
	return { ...plot, built };
}
type Coming = NonNullable<ReturnType<typeof comingOf>>;

// What the subjects' merges and open pull requests stand on their buildings, and how the town follows them. In a
// city, a subject's building keeps its storeys (./town-blocks.ts#raise): its merges lay nothing, and bring no truck.
// `coming`: the building of the subject to come, which its own scaffold goes up with.
function worksOf(kit: Kit, plan: ReturnType<typeof planOf>, anchors: Anchor[], houses: House[], heights: HeightMap, coming: Coming | null) {
	const merges = cityOf(plan) ? null : sites(kit, anchors, houses, plan.blocks, heights);
	const frames = scaffolds(kit, anchors, merges ?? undefined, coming ?? undefined);
	// The bar of a pull request merged stays on its sign while its storey is laid (./landing.ts).
	const bars = merges ? landing(plan.all, merges.pending) : null;
	return {
		follow(wanted: Wanted[], on: Stage, now?: boolean): void {
			merges?.follow(on, now);
			frames.follow(on, now);
			bars?.follow(wanted, on, now);
		},
		tick(seconds: number): void {
			merges?.tick(seconds);
			frames.tick(seconds);
			bars?.tick(seconds);
		},
		revision: (): number => bars?.revision() ?? 0,
	};
}

// The lamps of the subjects' squares, as those of the streets (./city.ts#decorate), then their quarters; and the
// subjects' squares, where their inhabitants walk and stand, among what the camera keeps.
function squaresAll(kit: Kit, topics: Topics, plan: ReturnType<typeof planOf>, heights: HeightMap, built: Point[]): void {
	const { blocks, looks, quarters } = plan;
	for (const block of topics.map((_, index) => blocks.of(index)))
		for (const [lx, y, lz] of lampsOf(looks[block.topic]!.place)) heights.lamps.push([block.x + lx, y, block.z + lz]);
	quartersBuilt(kit, blocks, quarters, heights);
	for (const { x, z } of blocks.all.filter((each) => each !== plan.held && (each.topic >= 0 || each.quarter !== undefined)))
		built.push([x - T / 2, 0, z - T / 2], [x + T / 2, 0, z - T / 2], [x - T / 2, 0, z + T / 2], [x + T / 2, 0, z + T / 2]);
}

// How the town follows the fleet: its figures, its sites, and the block of a subject to come.
function lifeOf(people: ReturnType<typeof inhabitants>, works: ReturnType<typeof worksOf>, coming: Coming | null) {
	let last: { wanted: Wanted[]; on: Stage } | null = null;
	let built = 0;
	// What changed while the town was not looked at, told since the last frame.
	let sudden = false;
	return {
		follow: (wanted: Wanted[], on: Stage, now?: boolean): void => {
			// A subject to come takes its name first: its merges and its pull requests are then its own.
			coming?.follow(wanted, on, now);
			people.follow(wanted, on, now);
			works.follow(wanted, on, now);
			last = { wanted, on };
			sudden ||= !!now;
		},
		// A subject just built is one more change to say (./signs.ts).
		revision: (): number => people.revision() + works.revision() + built,
		tick: (seconds: number): void => {
			const now = sudden;
			sudden = false;
			people.tick(seconds);
			works.tick(seconds);
			if (!coming?.tick(seconds) || !last) return;
			// Built: it counts among the town's subjects, and its sessions take their figures, born from its door; a
			// block built at once has its figures there at once too.
			coming.built();
			built++;
			people.follow(last.wanted, last.on, now);
		},
	};
}

export const town: SceneDef = {
	dir: [R, 0, -R],
	// In steps that give the browser its hand back (./steps.ts): built in one go, the town froze the page 2 to 3 s.
	*steps(kit, given) {
		const plan = planOf(given);
		const { style, seed, growth, lamps, quarters, layout, blocks, fills, places, held, all: topics } = plan;
		const parts = yield* partsOf(kit, topics.length, places, cityOf(plan) ? 0 : undefined);
		const heights = heightMap();
		const { recorded, built } = recording(heights);
		// The block held for a subject to come is one of the town's own until it comes: its neighbours are built as beside
		// any free block.
		const subjects = blocks.all.filter((each) => each !== held && (each.topic >= 0 || each.quarter !== undefined));
		const decor = yield* decorate(kit, fills, subjects, layout, style, seed, growth, recorded, held);
		const skyline = decor.highest;
		const { anchors, houses, designs } = raiseAll(kit, topics, parts, plan, recorded);
		squaresAll(kit, given, plan, heights, built);
		yield;
		const people = inhabitants(kit, topics, blocks, lamps, quarters);
		// What the camera frames and the town's top: the buildings that stand, not the one of a subject to come.
		const stand = anchors.filter(({ topic }) => !topic.held);
		const top = Math.max(3, skyline + 0.2, ...stand.map(({ at }) => at[1] + 0.2));
		const coming = comingOf(kit, plan, anchors, houses, decor.old, top, heights);
		const life = lifeOf(people, worksOf(kit, plan, anchors, houses, heights, coming), coming);
		yield;
		const seen = [...seenOf(blocks.all, stand), ...(skyline ? [[0, skyline, 0] as [number, number, number]] : [])];
		const bounds = box(seen);
		yield;
		edgeLight(kit, blocks.all);
		const { left, east, low, high, center } = bounds;
		// The camera frames the high points where they stand: the skyline over the town's middle let a spire at a corner
		// go under the page's top bar after a turn (13/11).
		const corners = seenOf(blocks.all, stand);
		const framed = [...corners, ...rising(decor.peaks, corners, LOWEST, HIGHEST)];
		return {
			...camera(
				kit,
				blocks,
				framed,
				built,
				stand.map(({ at }) => at),
			),
			range: [left - 0.5, east + 0.5],
			base: BOTTOM - 0.2,
			top,
			center: [center.x, 0, center.z],
			reach: Math.hypot(east - left, high - low) / 2 + 6,
			background: kit.night ? "#12100e" : "#f5f2ec",
			anchors,
			// Its figures, and how they are born, go and follow the fleet; the town's own `tick`, below, calls theirs.
			...people,
			follow: life.follow,
			revision: life.revision,
			lots: lotsOf(blocks, anchors, designs),
			heights,
			// By night, only what is really bright glows, and softly: the windows light the facades, they do not drown them.
			glow: kit.night ? [0.4, 1.15] : [0.2, 2.2],
			tick: (seconds) => {
				life.tick(seconds);
				decor.tick(seconds);
			},
		};
	},
	build: (kit, topics) => finish(town.steps!(kit, topics)),
};
