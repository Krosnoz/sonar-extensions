// A subject that comes while the town is open is built on the block the town held for it (./plot.ts): a front of its
// own, bricks from what stood there, a building that rises, a scaffold that goes up with it. No process, no graphics
// card: the whole town is built on a kit that only records what it is asked to draw.
import { expect, test } from "bun:test";
import { uniform, vec3 } from "three/tsl";
import type { Grain } from "../arrival/dust";
import type { Agent, Kit, Topic } from "../render/kit";
import type { Stage, Wanted } from "../people/live-steps";
import { THREE } from "../render/nodes";
import type { How, Part } from "../render/parts";

const page = globalThis as Record<string, unknown>;
page["matchMedia"] ??= () => ({ matches: false });
page["document"] ??= { querySelectorAll: () => [], documentElement: { dataset: {} } };
page["getComputedStyle"] ??= () => ({ paddingTop: "0" });
await import("../test-page");
const { town } = await import("../plan/town");
const { cityGrid, layoutFor } = await import("../plan/layout");
const { growthOf } = await import("../plan/growth");
const { T } = await import("../render/shapes");

// An instance as its part draws it. `mark`: over 0 it is born at that second, under 0 it goes from it.
type Drawn = { x: number; y: number; z: number; mark: number };
type Recorded = { how: How; drawn: Drawn[] };
// What the town says of the block it holds: its middle, its front, the share of its building laid.
type Plot = { x: number; z: number; front: number; share: number };

const topicOf = (name: string, agents: number): Topic => ({
	name,
	agents: Array.from({ length: agents }, (_, at): Agent => ({
		name: `${name} ${at}`,
		state: 1,
		seed: 0.13 + at * 0.29,
		children: [],
		handle: `${name}-${at}`,
	})),
	working: agents,
	waiting: 0,
	reviewing: 0,
});
const NAMES = ["Cache", "Menu", "Voice"];
// The fleet of the town below, and a session of one more subject.
const fleet = (): Wanted[] =>
	NAMES.flatMap((topic) => [0, 1].map((at): Wanted => ({ handle: `${topic}-${at}`, topic, state: 1, name: `${topic} ${at}`, children: [], pulls: [] })));
const session = (topic: string, merges = 0): Wanted => ({ handle: `${topic}-0`, topic, state: 1, name: `${topic} 0`, children: [], pulls: [], merges });

// A town of three subjects, two agents each, and what it draws. `moves`: false with motion reduced.
function townOf(moves = true) {
	const parts: Recorded[] = [];
	const plots: Plot[] = [];
	let seed = 7;
	const kit = {
		night: false,
		aspect: 1.6,
		random: () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296,
		uTime: uniform(0),
		scene: new THREE.Scene(),
		blank: vec3(0, 0, 0),
		along: (x: number, _y: number, z: number) => (x - z) * Math.SQRT1_2,
		plot: (x: number, z: number, front: number, share: number) => void plots.push({ x, z, front, share }),
		part(_geometry, _count, how = {}): Part {
			const drawn: Drawn[] = [];
			parts.push({ how, drawn });
			return {
				put: (given) => drawn.push({ x: given.x, y: given.y, z: given.z, mark: 0 }) - 1,
				move: (index, x, y, z) => void Object.assign(drawn[index]!, { x, y, z }),
				set: (index, given) => void Object.assign(drawn[index]!, { x: given.x, y: given.y, z: given.z }),
				mark: (index, at) => void (drawn[index]!.mark = at),
			};
		},
	} satisfies Kit;
	const world = town.build(
		kit,
		NAMES.map((name) => topicOf(name, 2)),
	);
	const [poured, risen]: [Grain[][], number[]] = [[], []];
	let flown = 0;
	const stage: Stage = {
		add: () => void flown++,
		size: () => 0.02,
		// As the town's drawing says it (../render/kit.ts): with motion reduced, no place's figures are shown changing.
		seen: () => moves,
		moves: () => moves,
		bricks: (grains) => void poured.push(grains),
		rises: (top) => void risen.push(top),
		hear: (kind) => void heard.push(kind),
		knock: (_at, high) => void knocked.push(high),
	};
	// What the town's ear is told (../sound/town-sound.ts): each event, and how high each brick heard lands.
	const [heard, knocked]: [string[], number[]] = [[], []];
	let now = 0;
	// The scaffolds are the last part born in layers the town makes (../plan/town.ts#worksOf).
	const frames = parts.findLast((part) => part.how.layers)!;
	return {
		world,
		plots,
		poured,
		risen,
		heard,
		knocked,
		// The figures born or gone in layers and grains since the town opened.
		flown: () => flown,
		held: world.anchors.at(-1)!,
		old: parts.find((part) => part.how.plot === "old"),
		scaffold: () => frames.drawn.filter((each) => each.y > -1000),
		follow: (wanted: Wanted[], sudden = false) => world.follow(wanted, stage, sudden),
		// The town's frames until the second `until`, twenty a second. `each` sees what stands after each one.
		run(until: number, each: () => void = () => undefined): void {
			for (; now < until; now += 0.05) {
				world.tick(now);
				each();
			}
		},
	};
}

test("a town holds the block its next subject would take: what stood there stands, and its building is hidden", () => {
	const { world, plots, old, held } = townOf();
	expect(world.anchors.map(({ topic }) => topic.name)).toEqual([...NAMES, ""]);
	expect(held.topic.held).toBe(true);
	// The town's own decor stands on the block, in a part of its own.
	expect(old?.drawn.length).toBe(1);
	// Its front is far behind the block, and nothing of its building is laid.
	expect(plots.at(-1)).toMatchObject({ front: -100, share: -1 });
	// Nobody stands on its square: its spare figures are away.
	expect(world.figures.some((figure) => figure.topic === 3 && !figure.away)).toBe(false);
});

test("the block held is the one a town opened with one more subject gives it, and no other block changes", () => {
	const same = [0, 0];
	for (let count = 1; count <= 12; count++)
		for (const seed of [3, 41, 977])
			// Without a quarter, then with the first subject's crowd spilled onto two squares more (../plan/quarters.ts).
			for (const [crowded, spilled] of [0, 2].entries()) {
				const topics = Array.from({ length: count }, (_, at) => topicOf(`S${at}`, 2));
				const spills = topics.map((_, at) => (at === 0 ? spilled : 0));
				const growth = growthOf(count * 2);
				const layout = layoutFor(count, seed, growth, spills);
				const [plain, holding] = [cityGrid(topics, seed, layout, spills), cityGrid(topics, seed, layout, spills, true)];
				const spare = holding.all.find((block) => block.topic === count);
				// But for the block held, the town is the one it was.
				expect(holding.all.map((block) => (block === spare ? { ...block, topic: -1 } : block))).toEqual(plain.all);
				const more = [...topics, topicOf("New", 2)];
				const next = layoutFor(count + 1, seed, growthOf(count * 2 + 2), [...spills, 0]);
				if (!spare || next.side !== layout.side) continue;
				same[crowded]!++;
				const again = cityGrid(more, seed, next, [...spills, 0]);
				expect([spare.i, spare.j]).toEqual([again.of(count).i, again.of(count).j]);
				// The quarters stay where they were.
				expect(again.all.filter((block) => block.quarter !== undefined)).toEqual(holding.all.filter((block) => block.quarter !== undefined));
			}
	expect(same[0]).toBeGreaterThan(10);
	expect(same[1]).toBeGreaterThan(5);
});

test("a session of a subject the town has no building for: its block is built, bricks from what stood there, then its figure is born", () => {
	const town = townOf();
	town.follow(fleet());
	town.run(1);
	expect([town.held.topic.held, town.poured.length]).toEqual([true, 0]);
	const block = { x: town.plots[0]!.x, z: town.plots[0]!.z };
	town.follow([...fleet(), session("Journal")]);
	const seen = { fronts: [] as number[], shares: [] as number[], frames: [] as number[], revision: town.world.revision() };
	town.run(9, () => {
		const plot = town.plots.at(-1)!;
		seen.fronts.push(plot.front);
		seen.shares.push(plot.share);
		seen.frames.push(...town.scaffold().map((each) => each.y));
	});
	// The subject took the block, under its name.
	expect(town.held.topic).toMatchObject({ name: "Journal", held: false });
	// The block's front crossed it, then its building rose bottom-up; built, nothing of it waits.
	expect(seen.fronts.every((front, at) => at === 0 || front >= seen.fronts[at - 1]!)).toBe(true);
	expect(seen.shares.every((share, at) => at === 0 || share >= seen.shares[at - 1]!)).toBe(true);
	expect([seen.fronts[0]! < 0, seen.shares[0], town.plots.at(-1)]).toEqual([true, -1, { ...block, front: 100, share: 100 }]);
	// One throw of bricks in a low spray, each from the block to its building.
	expect(town.poured.length).toBe(1);
	const bricks = town.poured[0]!;
	expect(bricks.length).toBeGreaterThan(300);
	expect(bricks.every((brick) => brick.brick && brick.spray === 0.6 && brick.t1 - brick.t0 >= 0.6 - 1e-9)).toBe(true);
	const near = ([x, , z]: [number, number, number]): boolean => Math.abs(x - block.x) <= T / 2 + 0.5 && Math.abs(z - block.z) <= T / 2 + 0.5;
	expect(bricks.every((brick) => near(brick.start) && near(brick.end))).toBe(true);
	// Its scaffold was born on the ground, went up with the building, and is gone.
	expect(Math.min(...seen.frames)).toBeLessThan(0.2);
	expect(Math.max(...seen.frames)).toBeGreaterThan(Math.min(...seen.frames) + 0.5);
	town.run(12);
	expect(town.scaffold()).toEqual([]);
	// Its session's figure stands on its square, and its sign says it.
	expect(town.world.figures.some((figure) => figure.topic === 3 && figure.agent.handle === "Journal-0")).toBe(true);
	expect(town.world.revision()).toBeGreaterThan(seen.revision);
	expect(town.held.topic.agents.map((agent) => agent.handle)).toEqual(["Journal-0"]);
});

test("the town's ear hears the bricks of a block that comes as they land, higher as it rises, then its building done", () => {
	const town = townOf();
	town.follow(fleet());
	town.run(1);
	town.follow([...fleet(), session("Journal")]);
	town.run(12);
	// A frame heard bricks once at most: a row of them lands at once, a knock a row, from its foot to its top.
	expect(town.knocked.length).toBeGreaterThan(5);
	expect(town.knocked.length).toBeLessThan(3 * 20);
	expect(town.knocked.every((high, at) => at === 0 || high > town.knocked[at - 1]!)).toBe(true);
	expect([town.knocked[0]! < 0.1, town.knocked.at(-1)]).toEqual([true, 1]);
	// Its scaffold stood, a building site's (it has no pull request), its building is done, its session's figure is born.
	expect(town.heard).toEqual(["site", "built", "born"]);
});

test("the town's ear hears nothing of a block built at once", () => {
	for (const [moves, sudden] of [
		[false, false],
		[true, true],
	] as const) {
		const town = townOf(moves);
		town.follow([...fleet(), session("Journal")], sudden);
		// Built at once, its figure there at once: nothing is left to play after a second.
		town.run(1);
		expect(town.held.topic.held).toBe(false);
		expect([town.heard, town.knocked]).toEqual([[], []]);
	}
});

test("the figure of a subject being built waits for its building", () => {
	const town = townOf();
	town.follow([...fleet(), session("Journal")]);
	town.run(3);
	expect(town.held.topic.held).toBe(true);
	expect(town.world.figures.some((figure) => figure.agent.handle === "Journal-0")).toBe(false);
});

test("with motion reduced, or for what changed while the town was not looked at, the block is built at once", () => {
	for (const [moves, sudden] of [
		[false, false],
		[true, true],
	] as const) {
		const town = townOf(moves);
		town.follow([...fleet(), session("Journal")], sudden);
		town.run(0.1);
		expect(town.held.topic).toMatchObject({ name: "Journal", held: false });
		expect([town.poured, town.scaffold(), town.plots.at(-1)!.front]).toEqual([[], [], 100]);
		// Its session's figure is there at once too: no birth is played for it.
		town.run(1);
		expect(town.world.figures.some((figure) => figure.topic === 3 && figure.agent.handle === "Journal-0")).toBe(true);
		expect(town.flown()).toBe(0);
	}
});

test("a session not filed yet takes no block: the subject it is then filed under takes it", () => {
	const town = townOf();
	// A new session has no subject at first: the page files it a moment later, most often under a subject that exists.
	town.follow([...fleet(), { ...session("Unfiled"), handle: "new", unfiled: true }]);
	town.run(8);
	expect(town.held.topic).toMatchObject({ name: "", held: true });
	expect([town.poured.length, town.plots.at(-1)!.front]).toEqual([0, -100]);
	town.follow([...fleet(), { ...session("Journal"), handle: "new" }]);
	town.run(17);
	expect(town.held.topic).toMatchObject({ name: "Journal", held: false });
	expect(town.world.figures.some((figure) => figure.topic === 3 && figure.agent.handle === "new")).toBe(true);
});

test("one block a town's opening: a second new subject shows at the next one", () => {
	const town = townOf();
	town.follow([...fleet(), session("Journal"), session("Search")]);
	town.run(9);
	expect(town.world.anchors.map(({ topic }) => topic.name)).toEqual([...NAMES, "Journal"]);
	expect(town.world.figures.some((figure) => figure.agent.handle === "Search-0")).toBe(false);
	expect(town.poured.length).toBe(1);
});

test("a subject that comes with merges: its building rises as high as they make it, and no truck comes", () => {
	const [plain, merged] = [townOf(), townOf()];
	plain.follow([...fleet(), session("Journal")]);
	merged.follow([...fleet(), session("Journal", 9)]);
	plain.run(9);
	merged.run(9);
	expect(merged.held.at[1]).toBeGreaterThan(plain.held.at[1] + 1);
	// Its bricks alone: a merge's pallet pours none.
	expect(merged.poured.length).toBe(1);
});
