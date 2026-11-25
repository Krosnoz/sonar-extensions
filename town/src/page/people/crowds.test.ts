// No two figures of a subject's square stand in one another: the ground boxes of its people and robots, each turned as
// the figure faces, keep apart by a margin, at 1, 3, 9 and 20 agents and up to six subagents each, those who stand as
// those who walk round the square. And those who stand keep to the square: none in the building's wall or on its steps.
// Six robots stood in a heap in front of a door, in their agent's legs, and the people of a crowd went through one another (11/11).

import { expect, test } from "bun:test";
import { uniform, vec3 } from "three/tsl";
import type { Agent, Kit, Topic } from "../render/kit";
import { THREE } from "../render/nodes";
import type { Part } from "../render/parts";

await import("../test-page");
const { inhabitants } = await import("./inhabitants");
const { LOOKS } = await import("./figures");
const { PLACES, furniture, lampsOf } = await import("../plan/squares");
const { crowdOf, onRound } = await import("./crowd");
const { VENUE } = await import("./grounds");
const { LEGIBLE } = await import("../plan/quarters");

type Put = { x: number; z: number; ry: number; s: number };
type Recorded = { box: THREE.Box3; figure: boolean; puts: Put[] };
// A place keeps figures for who comes while the town is open, and each figure a second body (./bodies.ts), at a scale
// of 0: they do not show.
const shownOf = (part: Recorded): Put[] => part.puts.filter((put) => put.s > 0);

// A kit that draws nothing: it keeps where each part's instances stand and how they turn.
function recording(): { kit: Kit; parts: Recorded[] } {
	const parts: Recorded[] = [];
	const kit = {
		night: false,
		aspect: 1.6,
		random: () => 0.5,
		uTime: uniform(0),
		scene: new THREE.Scene(),
		blank: vec3(0, 0, 0),
		along: () => 0,
		part(geometry, _count, how = {}): Part {
			geometry.computeBoundingBox();
			const recorded: Recorded = { box: geometry.boundingBox!.clone(), figure: how.people === true, puts: [] };
			parts.push(recorded);
			return {
				put: (given) => recorded.puts.push({ x: given.x, z: given.z, ry: given.ry ?? 0, s: typeof given.s === "number" ? given.s : 1 }) - 1,
				move: (index, x, _y, z, ry = 0, s = 1) => {
					recorded.puts[index] = { x, z, ry, s };
				},
				set: (index, given) => {
					recorded.puts[index] = { x: given.x, z: given.z, ry: given.ry ?? 0, s: typeof given.s === "number" ? given.s : 1 };
				},
			};
		},
	} satisfies Kit;
	return { kit, parts };
}

// A figure's ground box: its middle, its two axes and its half sizes along them.
type Box = { cx: number; cz: number; axes: [number, number][]; half: [number, number] };
const boxOf = (box: THREE.Box3, { x, z, ry, s }: Put): Box => {
	const [ux, uz] = [Math.cos(ry), -Math.sin(ry)];
	const [vx, vz] = [Math.sin(ry), Math.cos(ry)];
	const [mx, mz] = [((box.min.x + box.max.x) / 2) * s, ((box.min.z + box.max.z) / 2) * s];
	return {
		cx: x + ux * mx + vx * mz,
		cz: z + uz * mx + vz * mz,
		axes: [
			[ux, uz],
			[vx, vz],
		],
		half: [((box.max.x - box.min.x) / 2) * s, ((box.max.z - box.min.z) / 2) * s],
	};
};
// Two turned boxes overlap unless one of their four axes separates them (each grown by half the margin).
const MARGIN = 0.04;
function touch(p: Box, q: Box): boolean {
	const reach = (box: Box, [ax, az]: [number, number]): number =>
		box.axes.reduce((sum, [bx, bz], at) => sum + Math.abs(ax * bx + az * bz) * (box.half[at]! + MARGIN / 2), 0);
	return [...p.axes, ...q.axes].every((axis) => Math.abs((q.cx - p.cx) * axis[0] + (q.cz - p.cz) * axis[1]) < reach(p, axis) + reach(q, axis));
}

// Subagents per agent, cycling: six, none, three, one, five, two.
const CHILDREN = [6, 0, 3, 1, 5, 2];
const topicOf = (agents: number, stateOf: (at: number) => number): Topic => {
	const list = Array.from({ length: agents }, (_, at): Agent => ({
		name: `Agent ${at}`,
		state: stateOf(at),
		seed: (0.13 + at * 0.29) % 1,
		children: Array.from({ length: CHILDREN[at % CHILDREN.length]! }, (_, child) => child % 2),
	}));
	const count = (state: number): number => list.filter((agent) => agent.state === state).length;
	return { name: "Subject", agents: list, working: count(1), waiting: count(2), reviewing: count(3) };
};

// The pairs of figures that touch, and the standing ones out of the square, at each of `seconds`. `venue`: the topic's
// crowd stands on a venue of its quarter (./grounds.ts#VENUE), its own square left empty.
function measure(topic: Topic, seconds: number[], venue = false): { pairs: number; out: number } {
	const { kit, parts } = recording();
	const own = { i: 0, j: 0, x: 0, z: 0, topic: 0 };
	const world = venue
		? inhabitants(kit, [topic], { all: [{ i: 0, j: 1, x: 0, z: 0, topic: -1, quarter: 0 }], of: () => own }, () => [], [[[], topic.agents]])
		: inhabitants(kit, [topic], { all: [], of: () => own });
	// The people of each look, then the robots, in the order inhabitants.ts makes them.
	const figures = parts.filter((part) => part.figure).slice(0, LOOKS + 1);
	let [pairs, out] = [0, 0];
	for (const second of seconds) {
		world.tick(second);
		const boxes = figures.flatMap((part) => shownOf(part).map((put) => boxOf(part.box, put)));
		// The circle round each box, grown as it: two boxes whose circles do not meet cannot touch. A venue of 150 agents
		// holds 160 000 pairs at each second, and the test passed its time limit on a busy machine (14/11).
		const round = boxes.map((box) => Math.hypot(box.half[0] + MARGIN / 2, box.half[1] + MARGIN / 2));
		for (let a = 0; a < boxes.length; a++)
			for (let b = a + 1; b < boxes.length; b++) {
				const [p, q] = [boxes[a]!, boxes[b]!];
				if (Math.hypot(q.cx - p.cx, q.cz - p.cz) < round[a]! + round[b]! && touch(p, q)) pairs++;
			}
		// The doors' steps reach z -1.15; the paved square x ±5.3. A venue's paving reaches z -5.5 and x ±5.5.
		const [back, side] = venue ? [-5.5, 5.5] : [-1.16, 5.3];
		const reach = (box: Box, at: 0 | 1): number => box.axes.reduce((sum, axis, side) => sum + Math.abs(axis[at]) * box.half[side]!, 0);
		out += boxes.filter((box) => box.cz - reach(box, 1) < back || Math.abs(box.cx) + reach(box, 0) > side).length;
	}
	return { pairs, out };
}

const ROUND = Array.from({ length: 20 }, (_, at) => at * 1.3);
const CASES = [
	["at rest, waiting and to review", (at: number) => [0, 2, 3][at % 3]!, [0]],
	["at work", () => 1, ROUND],
	["at work and standing", (at: number) => [1, 0, 2, 1, 3][at % 5]!, ROUND],
] as const;
for (const [name, stateOf, seconds] of CASES)
	for (const agents of [1, 3, 9, 20])
		test(`crowds: ${agents} agent${agents > 1 ? "s" : ""} ${name}, no two figures touch`, () => {
			expect(measure(topicOf(agents, stateOf), [...seconds])).toEqual({ pairs: 0, out: 0 });
		});

// On a venue, the crowds a venue holds (../plan/quarters.ts): a few, a ring's worth (74) and a full venue, every state mixed
// or all at work. No one touches, and no walker goes through one who stands.
for (const [name, stateOf] of [CASES[1], CASES[2]] as const)
	for (const agents of [20, 74, 150])
		test(`crowds: on a venue, ${agents} agents ${name}, no two figures touch`, () => {
			expect(measure(topicOf(agents, stateOf), ROUND.slice(0, 8), true)).toEqual({ pairs: 0, out: 0 });
		});

// A venue whose crowd is at work is no ring round an empty paving: some walk near its middle. Its walkers on one round
// stood 3.4 m from it at least, round a bare paving (14/11).
test("crowds: on a venue, those at work fill the paving to its middle", () => {
	const { round } = VENUE;
	const [mx, mz] = [(round.left + round.right) / 2, (round.back + round.front) / 2];
	const nearest = [20, 63, 150].map((agents) => {
		const { starts } = crowdOf(topicOf(agents, () => 1).agents, VENUE.lamps, LEGIBLE, VENUE);
		return Math.min(
			...starts.map((start) => {
				const [x, z] = onRound(start.at, start.ground ?? VENUE);
				return Math.hypot(x - mx, z - mz);
			}),
		);
	});
	expect(nearest.every((metres) => metres < 2)).toBe(true);
});

// No one who stands is within NEAR of a lamp of its square seen from the camera (it looks from +x +z): on the ground, or
// across the lamp's line of sight when the lamp stands in front and close enough for its pole and lantern to cross the
// figure. A lamp stood before the faces of a row heaped by a fountain (12/11).
const NEAR = 0.15;
// The lamps' glass stands at z 2.3 (../plan/squares.ts#lampsOf); 1.9 behind it in z, a head shows above the lantern.
const [LAMP_Z, BEHIND] = [2.3, 1.9];
function nearLamps(topic: Topic, lamps: number[]): number {
	const { kit, parts } = recording();
	inhabitants(kit, [topic], { all: [], of: () => ({ i: 0, j: 0, x: 0, z: 0, topic: 0 }) }, () => lamps);
	const boxes = parts
		.filter((part) => part.figure)
		.slice(0, LOOKS + 1)
		.flatMap((part) => shownOf(part).map((put) => boxOf(part.box, put)));
	// How far a box reaches along an axis of the ground.
	const reach = (box: Box, [ax, az]: [number, number]): number => box.axes.reduce((sum, [bx, bz], at) => sum + Math.abs(ax * bx + az * bz) * box.half[at]!, 0);
	const across: [number, number] = [Math.SQRT1_2, -Math.SQRT1_2];
	let near = 0;
	for (const box of boxes)
		for (const x of lamps) {
			const ground = Math.hypot(box.cx - x, box.cz - LAMP_Z) - Math.max(reach(box, [1, 0]), reach(box, [0, 1]));
			const behind = box.cz < LAMP_Z && LAMP_Z - box.cz < BEHIND;
			const sight = Math.abs((box.cx - x) * across[0] + (box.cz - LAMP_Z) * across[1]) - reach(box, across);
			if (ground < NEAR || (behind && sight < NEAR)) near++;
		}
	return near;
}

// What stands on a square and is not walked through: the ground box of each part of its furniture (a bench, a lamp, a
// kiosk, a stall, a table, a bin, a tree, a fountain) and how high it starts. A pool of light, a flat disc, is walked over.
const furnitureOf = (variant: number): { box: Box; from: number }[] => {
	const { furniture: kind, mirror } = PLACES[variant]!;
	return furniture(kind, mirror, () => 0.5).flatMap((part) => {
		part.computeBoundingBox();
		const { min, max } = part.boundingBox!;
		return max.y - min.y < 0.01 ? [] : [{ box: boxOf(part.boundingBox!, { x: 0, z: 0, ry: 0, s: 1 }), from: min.y }];
	});
};
// No one of a square's crowd, walking or standing, nor a robot, stands in its furniture, at two moments of the round and
// at rest. A part higher than the figure (a lamp's head, a tree's crown) passes over it. Those at work walked round the
// square through a bench and a lamp of its front, at 100 and 1 000 agents (14/11).
function inFurniture(topic: Topic, variant: number): string[] {
	const { kit, parts } = recording();
	const lamps = lampsOf(variant).map(([x]) => x);
	const world = inhabitants(kit, [topic], { all: [], of: () => ({ i: 0, j: 0, x: 0, z: 0, topic: 0 }) }, () => lamps);
	const figures = parts.filter((part) => part.figure).slice(0, LOOKS + 1);
	const things = furnitureOf(variant);
	const hit: string[] = [];
	for (const second of [0, 4.1, 9.7]) {
		world.tick(second);
		for (const part of figures)
			for (const put of shownOf(part)) {
				const box = boxOf(part.box, put);
				const top = part.box.max.y * put.s;
				if (things.some((thing) => thing.from < top && touch(box, thing.box))) hit.push(`${second} s: ${box.cx.toFixed(2)}, ${box.cz.toFixed(2)}`);
			}
	}
	return hit;
}
for (const variant of PLACES.keys())
	test(`crowds: in place ${variant}, no figure stands in a bench, a lamp or the furniture of its square`, () => {
		const counts = [1, 3, 9, 20].flatMap((agents) =>
			CASES.map(([name, stateOf]) => `${agents} ${name}: ${inFurniture(topicOf(agents, stateOf), variant).slice(0, 2).join(" | ")}`),
		);
		expect(counts.filter((each) => !each.endsWith(": "))).toEqual([]);
	});

for (const variant of PLACES.keys())
	test(`crowds: in place ${variant}, no one who stands is within ${NEAR} of a lamp seen from the camera`, () => {
		const lamps = lampsOf(variant).map(([x]) => x);
		const counts = [1, 3, 5, 9, 14, 20].map((agents) =>
			nearLamps(
				topicOf(agents, (at) => [0, 2, 3][at % 3]!),
				lamps,
			),
		);
		expect(counts).toEqual([0, 0, 0, 0, 0, 0]);
	});
