// What draws the town's inhabitants: a person of each look, a robot, and what an agent carries or wears over its head.
// The town follows the fleet while it is open (./live.ts), and an instance is never put after the build (../render/lots.ts):
// each figure keeps its instances for as long as the town stands, each place has spare figures and spare robots for who
// comes, and each figure a second body, which goes from its place while the first is born in its new state.
import { abs, attribute, max, sin, step, vec3 } from "three/tsl";
import { ROBOT, sizeOf } from "./crowd";
import { bang, round } from "./bubbles";
import { LOOKS, crate, person, robot } from "./figures";
import { facing, headOf, nameOver, type Flown } from "./heaps";
import type { Agent, Figure, Kit } from "../render/kit";
import type { Stand } from "./layer-grains";
import { THREE, bob, working, type Node, type Vec3, type Vec4 } from "../render/nodes";
import type { Part } from "../render/parts";
import { piece, type G } from "../render/shapes";
import { STATE } from "./state-colours";
import { SWAP, codeOf, swing, tools } from "./tools";

// The spare figures and the spare robots of a place: who comes while the town is open takes one, who goes gives it
// back. Past them, a newcomer shows at the town's next opening.
export const [SPARE, HELPERS] = [12, 12];
// The top of a person's hair over its soles, at a scale of 1 (./figures.ts#person).
const TOP = 0.66;

// What draws one figure: its instances (the figure, then what it carries or wears over its head), its model, its
// colour and where it stands now. `k`: the scale of the crowd it is drawn in, none while it does not show; `along`:
// where it starts on its place's round, while it walks.
export type Body = { drawn: [Part, number][]; model: G; tint: string; stand: Stand; k?: number | undefined; along?: number | undefined };
// An agent's figure and its robots', in the order of its subagents; `figure` carries its name, which comes back at
// the town's second `named` after a birth. `person`, `ghost`, `crate`, `bubble`, `mark`: its instances, the ones it
// does not use at a scale of 0. `shown`: it stands on its place; `free`: it is a spare one, without an agent.
// `fading`: what its second body carries while it goes. `want`, `busy`: ./live-steps.ts.
// `tools`: its book, its hammer and its console (./tools.ts). `swap`: what it held before (`act`), the last of its
// `self.drawn`, gives its place to what it holds now since the town's second `since`.
// `heap`, `fly`: where its bubble rests in its group's large bubble, and its bubble on its way (./heaps.ts).
export type Life = Flown & {
	agent: Agent;
	figure: Figure;
	look: number;
	self: Body;
	robots: Body[];
	named?: number | undefined;
	person: number;
	ghost: number;
	crate: number;
	bubble: number;
	mark: number;
	shown: boolean;
	free: boolean;
	fading?: [Part, number] | undefined;
	tools: number[];
	swap?: { act: number; since: number } | undefined;
	want?: { name: string; state: number; children: number[]; act?: number } | null;
	busy?: { until: number; after: () => void } | undefined;
};
// Where a place's figures are put: its middle and its lot (../render/lots.ts).
export type Home = { x: number; z: number; lot: number; index: number };

// Who an agent looks like (one of the `LOOKS` of a person), from its seed.
export const lookOf = (agent: Agent): number => Math.floor(agent.seed * 97) % LOOKS;
// A robot at rest is grey.
const robotTint = (running: number): string => (running ? STATE[1]! : "#6b7079");

// Legs lift in turn to walk, the arms swing; who waits raises an arm and waves. The arms of one that holds a thing say
// which (./tools.ts#codeOf): both hold a book up, the right one swings a hammer, both tap on a console.
const gait =
	(time: Node) =>
	(data: Vec4): Vec3 => {
		const limb = attribute("aLimb", "float");
		const is = (which: number): Node => step(which - 0.5, limb).mul(step(limb, which + 0.5));
		const act = data.y.sub(1).mul(10);
		const holds = (which: number): Node => step(which - 0.5, act).mul(step(act, which + 0.5));
		const beat = sin(time.mul(11).add(data.z.mul(40)));
		const tap = sin(time.mul(14).add(data.z.mul(40)));
		const waits = step(1.5, data.y).mul(step(data.y, 2.5));
		const legs = is(1)
			.mul(max(beat, 0))
			.mul(0.07)
			.add(is(2).mul(max(beat.negate(), 0)).mul(0.07))
			.add(abs(beat).mul(0.018));
		const arms = is(3)
			.mul(max(beat.negate(), 0))
			.mul(0.04)
			.add(is(4).mul(max(beat, 0)).mul(0.04));
		const held = holds(1)
			.mul(is(3).add(is(4)))
			.mul(0.09)
			.add(holds(2).mul(is(4)).mul(swing(time, data).add(0.1)))
			.add(
				holds(3).mul(
					is(3)
						.mul(max(tap, 0).mul(0.05).add(0.07))
						.add(is(4).mul(max(tap.negate(), 0).mul(0.05).add(0.07))),
				),
			);
		const stride = legs.add(arms.mul(holds(0))).add(held);
		return vec3(0, stride.mul(working(data)).add(waits.mul(is(4)).mul(sin(time.mul(9)).mul(0.04).add(0.24))), 0);
	};

// The parts, each with room for its figures: `looks`, how many figures of each look; `helpers`, how many robots;
// `places`, how many places, each with a large bubble of its own (./crowd-heaps.ts).
export function figuresOf(kit: Kit, looks: number[], helpers: number, places = 0) {
	const agents = looks.reduce((sum, each) => sum + each, 0);
	// A figure does not stand on a block whose ground waits for its cubes (../arrival/delays.ts).
	const near = { people: true, lots: true, waits: "ground" } as const;
	const models = Array.from({ length: LOOKS }, (_, variant) => person(variant));
	const helper = robot();
	return {
		models,
		helper,
		// Two bodies a figure.
		people: models.map((model, look) => kit.part(model, 2 * looks[look]!, { moves: gait(kit.uTime), through: true, ...near })),
		robots: kit.part(helper, helpers, near),
		crates: kit.part(crate(), agents, { glow: 0, shadow: false, ...near }),
		bubbles: kit.part(bang(), agents, { moves: bob(kit.uTime), glow: 0.5, shadow: false, ...near }),
		marks: kit.part(piece(new THREE.OctahedronGeometry(0.13), "#ffffff", 1), agents, { moves: bob(kit.uTime), glow: 0.6, shadow: false, ...near }),
		tools: tools(kit.uTime).map(({ model, moves }) => kit.part(model, agents, { ...(moves && { moves }), glow: 0, shadow: false, ...near })),
		// The large bubbles, one a place.
		rounds: kit.part(round(), places, { moves: bob(kit.uTime), glow: 0.5, shadow: false, ...near }),
		// How the bubbles are turned now: to the camera's heading (./heaps.ts#facing).
		turn: facing(0),
	};
}
export type Parts = ReturnType<typeof figuresOf>;

// A robot of `home`, not shown yet.
export function robotOf(parts: Parts, home: Home): Body {
	const stand = { x: home.x, y: 0.08, z: home.z, ry: 0, s: 0 };
	return { drawn: [[parts.robots, parts.robots.put(stand, home.lot)]], model: parts.helper, tint: robotTint(0), stand };
}

// The figure of `agent` on `home`, with its robots, none of them shown yet. `free`: a spare one, which looks like `look`.
export function lifeOf(parts: Parts, home: Home, agent: Agent, look: number, free = false): Life {
	const unseen = { x: home.x, y: 0, z: home.z, s: 0 };
	const people = parts.people[look]!;
	const own = people.put(unseen, home.lot);
	const figure: Figure = { topic: home.index, agent, at: [home.x, 1.6, home.z], seenThrough: true, tall: 0, lot: home.lot, away: free };
	return {
		agent,
		figure,
		look,
		self: { drawn: [[people, own]], model: parts.models[look]!, tint: STATE[agent.state]!, stand: { x: home.x, y: 0.08, z: home.z, ry: 0, s: 0 } },
		robots: agent.children.map(() => robotOf(parts, home)),
		person: own,
		ghost: people.put(unseen, home.lot),
		crate: parts.crates.put(unseen, home.lot),
		bubble: parts.bubbles.put(unseen, home.lot),
		mark: parts.marks.put(unseen, home.lot),
		tools: parts.tools.map((part) => part.put(unseen, home.lot)),
		shown: !free,
		free,
	};
}

// Where what one at work holds is drawn: its crate before its chest, its tool's thing (`act` over 0) in its own frame.
type Held = { x: number; y: number; z: number; ry: number; s: number };
const heldAt = (act: number, { x, z, ry, s }: Stand): Held =>
	act ? { x, y: 0.08, z, ry, s } : { x: x + Math.sin(ry) * 0.17, y: 0.08 + 0.3 * s, z: z + Math.cos(ry) * 0.17, ry, s };

// What one that walks holds goes with it. While it changes tool (./live-steps.ts), what it held shrinks as the next
// grows.
export function carry(life: Life, seconds: number): void {
	const { stand, drawn } = life.self;
	const { swap } = life;
	const grown = swap ? Math.min(1, (seconds - swap.since) / SWAP) : 1;
	const [part, index] = drawn[1]!;
	const at = heldAt(life.agent.act ?? 0, stand);
	part.move(index, at.x, at.y, at.z, at.ry, at.s * grown);
	if (!swap) return;
	const [left, old] = drawn[2]!;
	const was = heldAt(swap.act, stand);
	if (grown < 1) {
		left.move(old, was.x, was.y, was.z, was.ry, was.s * (1 - grown));
		return;
	}
	// Written whatever the part shows now, and whole again for its next figure (../render/parts.ts#Part, `move`, `mark`).
	left.set(old, { x: was.x, y: 0, z: was.z, s: 0, w: 0 });
	drawn.length = 2;
	life.swap = undefined;
}

// The bubble of one that waits, its figure at (x, z): over its head, or on its way to its group's large bubble and
// back (./crowd-heaps.ts).
function bubbleAt(parts: Parts, life: Life, x: number, z: number, k: number): Held {
	const [bx, by, bz, s] = life.fly?.at ?? headOf(x, z, k);
	return { x: bx, y: by, z: bz, ry: parts.turn, s };
}

// What the swap under way of `life` leaves, none or one: it stays drawn when its place is laid again
// (./crowd-lay.ts#lay). One that no longer works ends its swap.
function leftOf(life: Life): [Part, number][] {
	if (life.agent.state === 1 && life.swap) return life.self.drawn.slice(2);
	life.swap = undefined;
	return [];
}

// The figure of `life` as its agent is now, at (x, z), turned by `ry`, in a crowd at the scale `k`: one at work with
// its crate or its tool's thing, one that waits for the user with a bubble, one to review with a mark, one at rest
// without.
export function drawSelf(parts: Parts, life: Life, x: number, z: number, ry: number, k: number): void {
	const { agent, self } = life;
	const { state, seed } = agent;
	const act = state === 1 ? (agent.act ?? 0) : -1;
	const left = leftOf(life);
	const color = STATE[state]!;
	const s = (state === 0 ? sizeOf(agent) * 0.96 : sizeOf(agent)) * k;
	const people = parts.people[life.look]!;
	Object.assign(self.stand, { x, y: 0.08, z, ry, s });
	[self.tint, self.k] = [color, k];
	people.set(life.person, { ...self.stand, color, state: codeOf(state, agent.act ?? 0), seed });
	self.drawn = [[people, life.person]];
	const carried: [Part, number, Held | false][] = [
		[parts.crates, life.crate, act === 0 && heldAt(0, self.stand)],
		...parts.tools.map((part, which): [Part, number, Held | false] => [part, life.tools[which]!, act === which + 1 && heldAt(act, self.stand)]),
		[parts.bubbles, life.bubble, state === 2 && bubbleAt(parts, life, x, z, k)],
		[parts.marks, life.mark, state === 3 && { x, y: 1.6 * k, z, ry: 0, s: 1.4 * k }],
	];
	for (const [part, index, at] of carried) {
		if (at) {
			part.set(index, { ...at, color, state, seed });
			self.drawn.push([part, index]);
		}
		// What its second body carries stays where it goes.
		else if (life.fading?.[0] !== part && left[0]?.[0] !== part) part.set(index, { x, y: 0, z, s: 0 });
	}
	self.drawn.push(...left);
	life.figure.at = [x, state === 2 ? nameOver(life.figure.bare) : 1.6, z];
	life.figure.tall = TOP * s;
}

// The robot of the subagent `child` of `life`, at (x, z): in its agent's colour of work while it runs.
export function drawRobot(parts: Parts, life: Life, child: number, x: number, z: number, ry: number, k: number): void {
	const body = life.robots[child]!;
	const running = life.agent.children[child]!;
	Object.assign(body.stand, { x, y: 0.08, z, ry, s: ROBOT * k });
	[body.tint, body.k] = [robotTint(running), k];
	parts.robots.set(body.drawn[0]![1], { ...body.stand, color: body.tint, state: running, seed: life.agent.seed + child * 0.1 });
}

// A body no longer shown, whole again for its next figure (../render/parts.ts#Part, `mark`).
export function hide(body: Body): void {
	for (const [part, index] of body.drawn) part.set(index, { x: body.stand.x, y: 0, z: body.stand.z, s: 0, w: 0 });
	[body.k, body.along] = [undefined, undefined];
}

// The second body of `life` takes its figure as it stands now, with what it carries: it goes from there (./layers.ts)
// while the figure is born elsewhere. One at work stops walking: it went on, on the spot.
export function ghostOf(parts: Parts, life: Life): Body {
	const people = parts.people[life.look]!;
	const { stand, tint, drawn } = life.self;
	people.set(life.ghost, { ...stand, color: tint, state: life.agent.state === 1 ? 0 : life.agent.state, seed: life.agent.seed, w: 0 });
	life.fading = drawn[1];
	return { drawn: [[people, life.ghost], ...drawn.slice(1)], model: parts.models[life.look]!, tint, stand: { ...stand } };
}
