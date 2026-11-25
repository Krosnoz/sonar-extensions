// A large crowd spreads over its quarter: at the block's level (the closest zoom), each inhabitant is seen one by one,
// the smallest on 16 px at least at 1440 × 900, the size at which the grouped marks fade out (../marks/far-marks.ts). A square
// of 110 agents held them at 3 % of their size: 3 px from near, and their marks never came apart (13/11). The crowd
// that does not fit on its subject's square goes to squares nearby, its own only; the town grows as much.
import { expect, test } from "bun:test";
import { uniform, vec3 } from "three/tsl";
import type { Agent, Kit, Topic } from "../render/kit";
import { THREE } from "../render/nodes";
import type { Part } from "../render/parts";

const page = globalThis as Record<string, unknown>;
page["matchMedia"] ??= () => ({ matches: false });
page["document"] ??= { querySelectorAll: () => [], documentElement: { dataset: {} } };
page["getComputedStyle"] ??= () => ({ paddingTop: "0" });
await import("../test-page");
const { town } = await import("./town");
const { T } = await import("../render/shapes");
const { COURTS, PAVED_TO, SLAB } = await import("../people/grounds");

let seed = 7;
const kit = {
	night: false,
	aspect: 1.6,
	random: () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296,
	uTime: uniform(0),
	scene: new THREE.Scene(),
	blank: vec3(0, 0, 0),
	along: () => 0,
	part: (): Part => {
		let count = 0;
		return {
			put: () => count++,
			move: () => {},
			set: () => {},
		};
	},
} as Kit;

// Nine subjects, as the project the town is judged on, and `agents` agents dealt among them in turn: each its state, a
// sixth of them with two robots when `robots`.
function topicsOf(agents: number, robots: boolean): Topic[] {
	const topics: Topic[] = Array.from({ length: 9 }, (_, index) => ({ name: `Subject ${index}`, agents: [], working: 0, waiting: 0, reviewing: 0 }));
	for (let at = 0; at < agents; at++)
		topics[at % 9]!.agents.push({
			name: `Agent ${at}`,
			state: at % 4,
			seed: (0.13 + at * 0.618034) % 1,
			children: robots && at % 6 === 0 ? [1, 0] : [],
		} as Agent);
	return topics;
}

function built(agents: number, robots = true) {
	seed = 7;
	const topics = topicsOf(agents, robots);
	const began = performance.now();
	const world = town.build(kit, topics);
	const ms = performance.now() - began;
	world.frame(1440, 900, 0, []);
	const { view } = world;
	// The smallest inhabitant's height on the screen at the block's level, in CSS px.
	// Not the figures a place keeps for who comes while the town is open (../people/bodies.ts).
	const figures = world.figures.filter((figure) => !figure.away);
	const tall = Math.min(...figures.map((figure) => figure.tall ?? 0));
	const smallest = (tall * Math.cos(view.pitch)) / view.unit(view.most);
	// The subjects of each block's people, by the block they stand on.
	const blocks = new Map<string, Set<number>>();
	for (const figure of figures) {
		const key = `${Math.round(figure.at[0] / T)},${Math.round(figure.at[2] / T)}`;
		blocks.set(key, (blocks.get(key) ?? new Set()).add(figure.topic));
	}
	const agentsOf = topics.flatMap((topic) => topic.agents);
	return { world, figures, ms, smallest, blocks, agentsOf };
}

for (const agents of [100, 1000, 10_000])
	test(`${agents} agents: at the block's level, each one is seen on 16 px at least, once, and no two subjects share a square`, () => {
		const { figures, smallest, blocks, agentsOf, ms } = built(agents);
		expect(smallest).toBeGreaterThanOrEqual(16);
		// Each agent stands once, and none is lost.
		expect(figures.length).toBe(agents);
		expect(new Set(figures.map((figure) => figure.agent)).size).toBe(agentsOf.length);
		expect([...blocks.values()].filter((topics) => topics.size > 1).length).toBe(0);
		// Built, with its crowd laid, in a bounded time: 3.4 s at 10 000 agents on one square each (13/11).
		expect(ms).toBeLessThan(20_000);
	}, 60_000);

// A small overflow stands on a court paved to its size, 4 agents at least. Each subject of a town of 100 agents kept 9
// agents on its square (2 or 3 when they have robots) and sent the others, 2 or 3 at times, to an esplanade of a whole
// block at the town's edge: 6 esplanades for 14 agents (14/11).
test("100 agents: a small overflow stands 4 at least on a court paved to its size, not on an esplanade", () => {
	const { world, figures, smallest } = built(100);
	expect(smallest).toBeGreaterThanOrEqual(16);
	// The agents of each subject, by the block they stand on: its own square holds the most.
	const crowds = new Map<number, Map<string, typeof world.figures>>();
	for (const figure of figures) {
		const [i, j] = [Math.round(figure.at[0] / T), Math.round(figure.at[2] / T)];
		const blocks = crowds.get(figure.topic) ?? new Map<string, typeof world.figures>();
		crowds.set(figure.topic, blocks.set(`${i},${j}`, [...(blocks.get(`${i},${j}`) ?? []), figure]));
	}
	const off = [...crowds.values()].flatMap((blocks) => [...blocks].toSorted((one, other) => other[1].length - one[1].length).slice(1));
	// Two subjects whose agents have the most robots spill, the seven others keep their crowd.
	expect(off.length).toBe(2);
	const [half, back] = [(COURTS[0]!.paved![0] * SLAB) / 2, PAVED_TO - COURTS[0]!.paved![1] * SLAB];
	for (const [block, figures] of off) {
		expect(figures.length).toBeGreaterThanOrEqual(4);
		const [i, j] = block.split(",").map(Number) as [number, number];
		// Each stands on the smallest court's paving.
		for (const { at } of figures) {
			expect(Math.abs(at[0] - i * T)).toBeLessThan(half);
			expect(at[2] - j * T).toBeGreaterThan(back);
			expect(at[2] - j * T).toBeLessThan(PAVED_TO);
		}
	}
});

// The town of 10 and 100 agents without robots: each square is enough for its crowd, and the smallest inhabitant there
// measures 16 px at least.
test("10 and 100 agents without robots: each square is enough, each inhabitant is seen on 16 px at least", () => {
	for (const agents of [10, 100]) expect(built(agents, false).smallest).toBeGreaterThanOrEqual(16);
});
