// A subject's place and its crowd as it stands now: who walks its round, who stands in its rows (./crowd.ts), each
// drawn there (./bodies.ts). Laid again when its crowd changes while the town is open (./live.ts): who only changes
// place glides to the new one, who walks takes its new place in the file as it walks.
import { crowdOf, onRound, turnOf, type Start, type Stand } from "./crowd";
import { HELPERS, SPARE, carry, drawRobot, drawSelf, hide, lifeOf, lookOf, robotOf, type Body, type Life, type Parts } from "./bodies";
import { bobAt, faces, flies, gathers } from "./crowd-heaps";
import { LOOKS } from "./figures";
import type { Grid } from "../plan/grid";
import { SQUARE, type Ground } from "./grounds";
import { facing, type Flown } from "./heaps";
import type { Agent, Heap, Topic } from "../render/kit";
import { blocksOf, venueOf } from "../plan/quarters";

// One file walks at one pace: walkers of their own speeds caught up with one another and went through.
const PACE = 0.9;
// How long one who only changes place takes to its new one, in seconds of the town.
const GLIDE = 0.4;

// Who walks a round: an agent's figure (`child` null) or one of its robots. `start`: where it starts on the round, in
// metres, which it glides to from `was` since the town's second `since`.
type Walker = { life: Life; child: number | null; body: Body; start: number; was: number; since: number; ground: Ground };
// One who glides to its place: from where and at which scale to where, since when, and how it is drawn on the way.
type Glide = { from: number[]; to: number[]; since: number; draw: (x: number, z: number, k: number) => void };
export type Glides = Map<Body, Glide>;

// A subject's square: where it is, its lamps, who stands and who walks there. A subject has its own and, when its crowd
// spills over (../plan/quarters.ts), squares of its quarter.
// `lives`: its figures, the spare ones last. `pool`: its spare robots. `shift`: where its file starts on its round.
// `next`: the town's second from which one more of its figures may be born or go (./live.ts).
export type Square = {
	index: number;
	// Its place in the town's squares: its inhabitants are one lot of each part (../render/lots.ts).
	lot: number;
	x: number;
	z: number;
	shift: number;
	agents: Agent[];
	lamps: number[];
	ground: Ground;
	walkers: Walker[];
	lives: Life[];
	pool: Body[];
	next: number;
	// The large bubble of those who wait on it (./crowd-heaps.ts): its instance, where it rests and flies, what the
	// page reads of it, and until which second of the town the square's bubbles fly (none: they rest).
	bubble: number;
	big: Flown;
	heap: Heap;
	flown?: number | undefined;
};

// The squares of every subject, each one a lot of the town's (../render/lots.ts), with no one on them yet.
export function squaresOf(topics: Topic[], grid: Grid, lamps: (index: number) => number[], quarters?: Agent[][][]): Square[] {
	const squares: Square[] = topics.flatMap((topic, index) => {
		const blocks = blocksOf(grid, index);
		// The squares' files do not all start at one point of their round.
		return (quarters?.[index] ?? [topic.agents]).map((agents, at) => {
			// A block of its quarter is a venue or a court, with its lamps (../plan/venues.ts).
			const ground = at ? venueOf(agents) : SQUARE;
			return {
				index,
				lot: -1,
				x: blocks[at]!.x,
				z: blocks[at]!.z,
				shift: index * 4.1 + at * 2.3,
				agents,
				ground,
				lamps: ground.lamps ?? lamps(index),
				walkers: [],
				lives: [],
				pool: [],
				next: 0,
				bubble: -1,
				big: {},
				heap: { on: false, count: 0, at: [blocks[at]!.x, 0, blocks[at]!.z], round: 0, lift: 0, shows: 0, people: [] },
			};
		});
	});
	squares.forEach((square, at) => void (square.lot = at));
	return squares;
}

// How many figures of each look, and how many robots, the squares need: their agents' and their spare ones.
export function roomOf(squares: Square[]): { looks: number[]; helpers: number } {
	const looks = Array.from({ length: LOOKS }, () => 0);
	let helpers = squares.length * HELPERS;
	for (const square of squares) {
		for (const agent of square.agents) {
			looks[lookOf(agent)]!++;
			helpers += agent.children.length;
		}
		for (let spare = 0; spare < SPARE; spare++) looks[spare % LOOKS]!++;
	}
	return { looks, helpers };
}

// The square's figures: its agents', then its spare ones and its spare robots, none of them shown yet. Each part's
// instances of a square are put in a row (../render/lots.ts).
export function people(parts: Parts, square: Square): void {
	for (const agent of square.agents) square.lives.push(lifeOf(parts, square, agent, lookOf(agent)));
	for (let spare = 0; spare < SPARE; spare++) {
		const nobody: Agent = { name: "", state: 0, seed: 0, children: [] };
		square.lives.push(lifeOf(parts, square, nobody, spare % LOOKS, true));
	}
	for (let spare = 0; spare < HELPERS; spare++) square.pool.push(robotOf(parts, square));
	square.bubble = parts.rounds.put({ x: square.x, y: 0, z: square.z, s: 0 }, square.lot);
	square.heap.people = square.lives.map((life) => life.figure);
}

// As many robots as the agent of `life` has subagents: taken from the square's spare ones, or given back to them.
export function staffed(square: Square, life: Life): void {
	while (life.robots.length > life.agent.children.length) {
		const body = life.robots.pop()!;
		hide(body);
		square.pool.push(body);
	}
	while (life.robots.length < life.agent.children.length) life.robots.push(square.pool.pop()!);
}

// Where a walker is at the town's second `seconds`: x, z, and where it looks.
function whereOf(square: Square, walker: Walker, seconds: number): [number, number, number] {
	const done = Math.min(1, (seconds - walker.since) / GLIDE);
	const [x, z, heading] = onRound(walker.was + (walker.start - walker.was) * done + seconds * PACE, walker.ground);
	return [square.x + x, square.z + z, heading];
}

// An agent at work, on the square's round with what it holds, its robots behind it.
function walks(parts: Parts, square: Square, life: Life, start: Start, k: number, seconds: number, glides: Glides | null): void {
	const ground = start.ground ?? square.ground;
	const walker = (body: Body, child: number | null, along: number): Walker => {
		const was = glides && body.k !== undefined ? (body.along ?? along) : along;
		body.along = along;
		glides?.delete(body);
		return { life, child, body, start: along + square.shift, was: was + square.shift, since: seconds, ground };
	};
	const file = [walker(life.self, null, start.at), ...life.robots.map((body, child) => walker(body, child, start.robots[child]!))];
	for (const each of file) {
		const [x, z, heading] = whereOf(square, each, seconds);
		if (each.child === null) drawSelf(parts, life, x, z, heading, k);
		else drawRobot(parts, life, each.child, x, z, heading, k);
	}
	square.walkers.push(...file);
}

// A body takes its place (x, z) at the scale `k`: at once, or gliding from where it shows now.
function takes(body: Body, x: number, z: number, k: number, seconds: number, glides: Glides | null, draw: Glide["draw"]): void {
	const from = [body.stand.x, body.stand.z, body.k ?? k];
	const moved = Math.abs(from[0]! - x) + Math.abs(from[1]! - z) + Math.abs(from[2]! - k) > 1e-6;
	body.along = undefined;
	glides?.delete(body);
	if (glides && body.k !== undefined && moved) {
		glides.set(body, { from, to: [x, z, k], since: seconds, draw });
		body.k = k;
	} else draw(x, z, k);
}

// An agent that stands, in its row with its sign, its robots at its right.
function stands(parts: Parts, square: Square, life: Life, place: Stand, k: number, seconds: number, glides: Glides | null): void {
	takes(life.self, square.x + place.x, square.z + place.z, k, seconds, glides, (x, z, scale) => drawSelf(parts, life, x, z, turnOf(life.agent), scale));
	for (const [child, body] of life.robots.entries()) {
		const beside = place.robots[child]!;
		takes(body, square.x + beside.x, square.z + beside.z, k, seconds, glides, (x, z, scale) => drawRobot(parts, life, child, x, z, Math.PI / 4, scale));
	}
}

// Draws each figure of the square's crowd where ./crowd.ts puts it, as its agents are at the town's second `seconds`.
// `glides`: who only changes place glides to the new one; without it, everyone is there at once.
export function lay(parts: Parts, square: Square, seconds: number, glides: Glides | null): void {
	const shown = square.lives.filter((life) => life.shown);
	square.agents = shown.map((life) => life.agent);
	const crowd = crowdOf(square.agents, square.lamps, 1, square.ground);
	gathers(square, crowd, seconds, !glides);
	square.walkers = [];
	let [standing, walking] = [0, 0];
	for (const life of shown) {
		if (life.agent.state === 1) walks(parts, square, life, crowd.starts[walking++]!, crowd.scale, seconds, glides);
		else stands(parts, square, life, crowd.stands[standing++]!, crowd.scale, seconds, glides);
	}
	if (square.flown !== undefined) flies(parts, square, seconds, !glides);
}

// Those who glide and those who walk, at the town's second `seconds`. `yaw`: the camera's heading, which the bubbles
// face.
export function strides(parts: Parts, squares: Square[], seconds: number, glides: Glides, yaw = 0): void {
	const turned = parts.turn !== facing(yaw);
	parts.turn = facing(yaw);
	for (const [body, glide] of glides) {
		// It left its place meanwhile (./bodies.ts#hide).
		if (body.k === undefined) {
			glides.delete(body);
			continue;
		}
		const linear = Math.min(1, (seconds - glide.since) / GLIDE);
		const done = linear * linear * (3 - 2 * linear);
		const [x, z, k] = glide.from.map((from, at) => from + (glide.to[at]! - from) * done);
		glide.draw(x!, z!, k!);
		if (linear >= 1) glides.delete(body);
	}
	for (const square of squares) {
		for (const walker of square.walkers) {
			const [x, z, heading] = whereOf(square, walker, seconds);
			const { stand } = walker.body;
			Object.assign(stand, { x, z, ry: heading });
			if (walker.child !== null) {
				parts.robots.move(walker.body.drawn[0]![1], x, 0.08, z, heading, stand.s);
				continue;
			}
			const { life } = walker;
			parts.people[life.look]!.move(life.person, x, 0.08, z, heading, stand.s);
			carry(life, seconds);
			life.figure.at = [x, 1.6, z];
		}
		// After those who glide: a bubble on its way follows its figure's head.
		if (square.flown !== undefined) flies(parts, square, seconds);
		if (turned) faces(parts, square, seconds);
		if (square.heap.shows > 0) square.heap.lift = bobAt(seconds);
	}
}
