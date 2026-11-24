// A figure is born and goes in layers (./layers.ts): plate by plate from its top down, what gives its light with the
// last plates, a birth being the going run backwards. Its matter flies to its parent and comes from it
// (./layer-grains.ts): each grain leaves its plate as the plate's fill goes, and none shows at once in mid flight. An
// agent's figure and its subagents' are found by the agent's handle (./inhabitants.ts).

import { expect, test } from "bun:test";
import { uniform, vec3 } from "three/tsl";
import type { Agent, Kit, Topic } from "./kit";
import { THREE } from "./nodes";
import type { Part } from "./parts";

await import("./test-page");
const { END, GRID, LAST, SEAM, fillAt, orderOf } = await import("./layers");
const { FLY, grainsOf } = await import("./layer-grains");
const { person, robot } = await import("./figures");
const { inhabitants } = await import("./inhabitants");

const seeded = (): (() => number) => {
	let seed = 7;
	return () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;
};
const STAND = { x: 10, y: 0.08, z: -4, ry: 0.6, s: 1.7 };
const PARENT: [number, number, number] = [12, 0.5, -6];
const far = (a: readonly number[], b: readonly number[]): number => Math.hypot(a[0]! - b[0]!, a[1]! - b[1]!, a[2]! - b[2]!);

test("town: a figure goes from its top down, and what gives its light goes with the last cells", () => {
	const span: [number, number] = [0, 0.66];
	const [top, middle, bottom] = [orderOf(0, 0.64, 0, span), orderOf(0, 0.33, 0, span), orderOf(0, 0.01, 0, span)];
	expect(top).toBeLessThan(middle);
	expect(middle).toBeLessThan(bottom);
	for (let y = 0; y <= 0.66; y += 0.03)
		for (let x = -0.2; x <= 0.2; x += 0.05) {
			expect(orderOf(x, y, x / 2, span)).toBeGreaterThanOrEqual(0);
			expect(orderOf(x, y, x / 2, span)).toBeLessThanOrEqual(1);
		}
	// A robot's antenna is its highest piece: as its light, it still goes late, after the middle of its body.
	const robotSpan: [number, number] = [0, 0.45];
	expect(orderOf(0.06, 0.42, -0.04, robotSpan, true)).toBeGreaterThan(orderOf(0, 0.2, 0, robotSpan));
	expect(orderOf(0.06, 0.42, -0.04, robotSpan, true)).toBeLessThan(1);
});

test("town: a birth is the going run backwards, and both take the same time", () => {
	const [first, last] = [fillAt(0), fillAt(1)];
	expect(first).toBeCloseTo(SEAM);
	expect(last).toBeCloseTo(SEAM + LAST);
	// The cell that goes last comes first: its fill is back GRID after the birth starts, and the first gone at the end.
	expect(END - last).toBeCloseTo(GRID);
	expect(END - first).toBeCloseTo(LAST + GRID);
});

test("town: a figure that goes sends each grain to its parent as its plate's fill goes", () => {
	// Few enough to see the town between them: thousands flew as one ribbon that hid the figure.
	for (const [model, least, most] of [
		[person(0), 120, 600],
		[robot(), 40, 300],
	] as const) {
		const grains = grainsOf(model, STAND, "#27c2a8", PARENT, 20, false, seeded());
		expect(grains.length).toBeGreaterThan(least);
		expect(grains.length).toBeLessThan(most);
		const wrong = grains.filter(
			(grain) =>
				grain.t0 < 20 + SEAM - 1e-6 ||
				grain.t0 > 20 + SEAM + LAST + 1e-6 ||
				grain.t1 - grain.t0 < FLY * 0.8 - 1e-6 ||
				grain.t1 - grain.t0 > FLY * 1.2 + 1e-6 ||
				far(grain.end, PARENT) > 0.04 ||
				far(grain.start, [STAND.x, STAND.y + 0.6, STAND.z]) > 1,
		);
		expect(wrong).toEqual([]);
		// Most are sparks of light, the others chips in the figure's colours.
		const lights = grains.filter((grain) => grain.glows).length / grains.length;
		expect(lights).toBeGreaterThan(0.55);
		expect(lights).toBeLessThan(0.85);
		// The top leaves before the feet.
		const heights = grains.map((grain) => grain.start[1]);
		const [foot, tall] = [Math.min(...heights), Math.max(...heights) - Math.min(...heights)];
		const [high, low] = [grains.filter((grain) => grain.start[1] > foot + 0.75 * tall), grains.filter((grain) => grain.start[1] < foot + 0.25 * tall)];
		const mean = (list: typeof grains): number => list.reduce((sum, grain) => sum + grain.t0, 0) / list.length;
		expect(mean(high)).toBeLessThan(mean(low));
	}
});

test("town: a figure born gets each grain from its parent as its plate's fill comes", () => {
	const grains = grainsOf(person(2), STAND, "#ff9838", PARENT, 20, true, seeded());
	const wrong = grains.filter(
		(grain) => grain.t1 < 20 + GRID - 1e-6 || grain.t1 > 20 + GRID + LAST + 1e-6 || grain.t0 < 20 - FLY * 1.2 - 1e-6 || far(grain.start, PARENT) > 0.04,
	);
	expect(wrong).toEqual([]);
});

test("town: the plates of one height do not all go at once, and a plate goes whole", () => {
	const span: [number, number] = [0, 0.66];
	// Points of one height, across the figure: several plates, each with its own turn.
	const turns = new Set<number>();
	for (let x = -0.2; x <= 0.2; x += 0.01) turns.add(orderOf(x, 0.4, 0.05, span));
	expect(turns.size).toBeGreaterThan(2);
	expect(turns.size).toBeLessThan(12);
});

// A kit that draws nothing: it keeps the marks its parts' instances are given.
function marking(): { kit: Kit; marks: Map<Part, number[]> } {
	const marks = new Map<Part, number[]>();
	const kit = {
		night: false,
		aspect: 1.6,
		random: seeded(),
		uTime: uniform(0),
		scene: new THREE.Scene(),
		blank: vec3(0, 0, 0),
		along: () => 0,
		part(): Part {
			const given: number[] = [];
			let used = 0;
			const part: Part = { put: () => used++, move: () => {}, set: () => {}, mark: (index, at) => void (given[index] = at) };
			marks.set(part, given);
			return part;
		},
	} satisfies Kit;
	return { kit, marks };
}
const agentOf = (handle: string, state: number, children: number[]): Agent => ({ name: handle, state, seed: 0.37, children, handle });

test("town: an agent's figure, or a subagent's, is marked and its matter flies; the town says when it has no such figure", () => {
	const { kit, marks } = marking();
	const agents = [agentOf("s-walks", 1, [1, 0]), agentOf("s-waits", 2, [1])];
	const topic: Topic = { name: "Subject", agents, working: 1, waiting: 1, reviewing: 0 };
	const town = inhabitants(kit, [topic], { all: [], of: () => ({ i: 0, j: 0, x: 0, z: 0, topic: 0 }) });
	const marked = (): number[] => [...marks.values()].flat().filter((mark) => mark !== undefined);
	town.tick(3);

	// A subagent goes from now: its robot alone is marked, and its matter flies to its agent, who walks.
	const gone = town.play("s-walks", 1, false, 3, 0.05)!;
	expect(marked()).toEqual([-3]);
	expect(gone.grains.length).toBeGreaterThan(40);
	expect(gone.until).toBeGreaterThan(3 + END);
	const [left, landed] = gone.moved();
	expect([...left, ...landed]).toEqual([0, 0, 0, 0, 0, 0]);
	town.tick(4);
	const [after] = gone.moved();
	expect(Math.hypot(after[0], after[2])).toBeGreaterThan(0.5);

	// An agent that waits is born: its figure and its bubble are marked, once its first grains have flown.
	const born = town.play("s-waits", null, true, 5, 0.05)!;
	expect(marked().filter((mark) => mark > 0)).toEqual([5 + FLY * 1.2, 5 + FLY * 1.2]);
	expect(Math.min(...born.grains.map((grain) => grain.t0))).toBeGreaterThanOrEqual(5 - 1e-6);
	// Its name comes back once it is whole, not over an empty place; it goes at once with a figure that goes.
	const named = (): boolean => !town.figures.find((figure) => figure.agent.handle === "s-waits")!.away;
	expect(named()).toBe(false);
	town.tick(5 + FLY * 1.2 + END - 0.01);
	expect(named()).toBe(false);
	town.tick(5 + FLY * 1.2 + END);
	expect(named()).toBe(true);
	town.play("s-waits", null, false, 9, 0.05);
	town.tick(60);
	expect(named()).toBe(false);

	expect(town.play("s-unknown", null, false, 6, 0.05)).toBeNull();
	expect(town.play("s-waits", 3, false, 6, 0.05)).toBeNull();
});
