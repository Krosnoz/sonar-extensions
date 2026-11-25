// Where the people of a subject's square stand and walk, so that no two of them, nor two robots, stand in one another
// (./crowds.test.ts). Those at work walk round the square in one file, along the doors, the sides and the front; those
// who stand fill rows inside that round, from the back, around its middle (a fountain, a kiosk or a tree) and its
// terrace, each with its robots in columns of two at its right. When the square is short of room, the whole crowd
// stands smaller and closer, rather than in the walls or in the street.
// Six robots stood in a heap in front of a door, in their agent's legs (robots 0.3 apart at a scale of 1.15), and the
// rows of a crowd went through one another (0.15 between people 1.7 tall, rows 0.55 apart, walkers in three lanes
// 0.28 apart at speeds of their own).
import { SQUARE, type Ground } from "./grounds";
import type { Agent } from "../render/kit";

export const SIZE = 1.7;
export const ROBOT = 1.15;
// How tall an agent stands, 6 % under or over the usual size, from its seed.
export const sizeOf = (agent: Agent): number => SIZE * (0.94 + ((agent.seed * 31.7) % 1) * 0.12);
// How one who stands turns, a little aside from the camera.
export const turnOf = (agent: Agent): number => Math.PI / 4 + (agent.seed - 0.5) * 0.6;

// The half sizes of a person's and a robot's ground box at a scale of 1, along their own x (across) and z (ahead).
const PERSON = { x: 0.165, z: 0.142 };
const BOT = { x: 0.15, z: 0.115 };
// The half sizes along the square's x and z of a box turned by `ry`.
const halfOf = (box: { x: number; z: number }, ry: number, s: number): [number, number] => {
	const [c, n] = [Math.abs(Math.cos(ry)), Math.abs(Math.sin(ry))];
	return [s * (box.x * c + box.z * n), s * (box.x * n + box.z * c)];
};
// What is kept between two figures, a little more than the check's margin.
const GAP = 0.07;
// Between two people of a row, and between two rows: seen from above at an angle, rows 0.07 apart read as one heap,
// the faces of a row behind the hair of the row in front (12/11).
// Wider gaps shrink the crowd that fills a small square: these keep three agents at 0.4 of their size (0.54 with rows 0.07 apart and no lamp kept clear).
const [APART, ROW] = [0.1, 0.15];
// What a row keeps from the square's middle (a fountain 1 wide), its terrace and the line of sight of its lamps.
const CLEAR = 0.15;
// Under this scale, the gaps above shrink with the crowd. Fixed, they bounded what a square holds: past about 150 agents
// no scale left room for them all, and the search for one never ended (10 000 agents froze the page, 13/11). Every crowd
// that had room before keeps its gaps: the smallest scale one reached was 0.0034 (140 agents, a third with two robots).
const FLOOR = 0.003;
// What one keeps from a figure it would hide, seen from the camera (+x +z, 35° down): a robot behind its column hid in
// the legs of the next agent on its right or of the agent in front of it on its right, and the walkers behind a venue's
// rows in their first row's heads (./figures-visible.test.ts, 111 robots and 6 people of a town of 1 000).
const SIGHT = 0.3;
// A lamp's half width seen from the camera, its lantern and some air: a lamp stood before the faces of a row.
const LAMP = 0.3;
// Where a lamp's line of sight is reckoned from: a venue's lamps stand at z 2.1 (../plan/venues.ts), a square's at 2.3, behind
// its round (../plan/squares.ts#lampsOf), and its rows still keep out of their sight (./crowds.test.ts). Reckoned from 2.3, a
// square of 110 agents stood two steps of scale smaller (./crowd-size.test.ts).
const LAMP_Z = 2.1;
// How far behind a lamp (in z, along its line of sight) its pole and lantern, 1.86 high, still cross a figure's head.
const BEHIND = 1.9;

// The round of those at work on `ground` (./grounds.ts): its sides, its corners' arc and its length.
function roundOf({ round }: Ground) {
	const [wide, deep] = [round.right - round.left - 2 * round.bend, round.front - round.back - 2 * round.bend];
	const arc = (Math.PI / 2) * round.bend;
	return { ...round, wide, deep, arc, length: 2 * wide + 2 * deep + 4 * arc };
}
// Where a walker is `d` metres from the round's start: x, z, and where it looks.
export function onRound(d: number, ground = SQUARE): [number, number, number] {
	const { back, front, left, right, bend, wide: WIDE, deep: DEEP, arc: ARC, length: LENGTH } = roundOf(ground);
	const [west, east, top, bottom] = [left + bend, right - bend, front - bend, back + bend];
	// The four sides, each followed by its corner: where it starts, the way it goes, its length, the corner's middle.
	const legs: [number, number, number, number, number, number, number][] = [
		[west, front, 1, 0, WIDE, east, top],
		[right, top, 0, -1, DEEP, east, bottom],
		[east, back, -1, 0, WIDE, west, bottom],
		[left, bottom, 0, 1, DEEP, west, top],
	];
	let u = ((d % LENGTH) + LENGTH) % LENGTH;
	for (const [at, [x, z, dx, dz, length, cx, cz]] of legs.entries()) {
		const heading = Math.PI / 2 + (at * Math.PI) / 2;
		if (u < length) return [x + dx * u, z + dz * u, heading];
		u -= length;
		if (u < ARC) {
			const turned = heading + u / bend;
			return [cx - bend * Math.cos(turned), cz + bend * Math.sin(turned), turned];
		}
		u -= ARC;
	}
	return [west, front, Math.PI / 2];
}

// Where a standing agent and its robots stand.
export type Stand = { x: number; z: number; robots: { x: number; z: number }[] };
// Where an agent at work starts on the round, and its robots behind it, in metres along it. `ground`: the lane it walks,
// when not the ground's own round (./crowd.ts#walk).
export type Start = { at: number; robots: number[]; ground?: Ground };
export type Crowd = { scale: number; stands: Stand[]; starts: Start[] };

// The file of those at work: each takes its length along the round, its robots behind it, and the room left is shared
// between them. A person's slot is longer than its box: in a corner the one ahead has turned already. Each slot keeps
// GAP more, whatever the scale: at 0.17 two robots of a file touched in a corner. `room`: the share of the gaps kept.
function file(walking: Agent[], k: number, room: number, ground: Ground): Start[] | null {
	const [person, robot] = [0.82 * k + GAP * room, 0.5 * k + GAP * room];
	const LENGTH = roundOf(ground).length;
	const need = walking.reduce((sum, agent) => sum + person + agent.children.length * robot, 0);
	if (need > LENGTH) return null;
	const spare = walking.length ? (LENGTH - need) / walking.length : 0;
	let cursor = 0;
	return walking.map((agent) => {
		const robots = agent.children.map((_, child) => cursor + (child + 0.5) * robot);
		cursor += agent.children.length * robot;
		const at = cursor + person / 2;
		cursor += person + spare;
		return { at, robots };
	});
}

// A lane's tightest corner: one who turns at once stood across the one behind.
const BEND = 0.4;
// How much longer than its walkers' file a venue's lanes are, when no one stands there: they spread over the paving
// rather than keep to its edge.
const SPREAD = 2;
// The ground of a lane `inset` inside `ground`'s round. Its corners are those of the round, inset, or BEND: a lane is
// `inset` at least from the round everywhere, and no walker of one comes nearer one of another.
const laneOf = (ground: Ground, inset: number): Ground => {
	const { back, front, left, right, bend } = ground.round;
	const round = { back: back + inset, front: front - inset, left: left + inset, right: right - inset, bend: Math.max(Math.min(bend, BEND), bend - inset) };
	return { ...ground, round };
};

// Where those at work walk, and the round inside which those who stand keep (`inner`). On a ground with lanes
// (./grounds.ts#VENUE), the fewest lanes that hold them, each a row's depth inside the one before; when no one stands,
// as many as make the lanes SPREAD times their file's length, spread to the middle of the paving. Each walker takes the
// lane where the middle of its share of the file falls. Parades and city builders' promenades fill a ground the same
// way: files side by side, none round an empty middle (14/11).
function walk(walking: Agent[], standing: boolean, k: number, room: number, ground: Ground): { starts: Start[]; inner: Ground } | null {
	if (!ground.lanes || !walking.length) {
		const starts = file(walking, k, room, ground);
		return starts && { starts, inner: ground };
	}
	const [person, robot] = [0.82 * k + GAP * room, 0.5 * k + GAP * room];
	const needs = walking.map((agent) => person + agent.children.length * robot);
	const need = needs.reduce((sum, each) => sum + each, 0);
	// Between two lanes, SIGHT more: on a court full of walkers, one hid the walker of the lane behind it.
	const step = 2 * PERSON.x * SIZE * 1.06 * k + (GAP + ROW) * room + SIGHT * k;
	const { round } = ground;
	const deepest = Math.min(round.front - round.back, round.right - round.left) / 2 - BEND;
	const most = Math.max(1, Math.floor(deepest / step) + 1);
	lanes: for (let count = 1; count <= most; count++) {
		const apart = !standing && count > 1 ? deepest / (count - 1) : step;
		const lanes = Array.from({ length: count }, (_, at) => laneOf(ground, at * apart));
		const lengths = lanes.map((lane) => roundOf(lane).length);
		const total = lengths.reduce((sum, each) => sum + each, 0);
		if (total < (!standing && count < most ? SPREAD : 1) * need) continue;
		const files: Agent[][] = lanes.map(() => []);
		let [done, lane, edge] = [0, 0, lengths[0]! / total];
		walking.forEach((agent, at) => {
			const middle = (done + needs[at]! / 2) / need;
			while (middle > edge && lane < count - 1) edge += lengths[++lane]! / total;
			files[lane]!.push(agent);
			done += needs[at]!;
		});
		const starts: Start[] = [];
		for (const [at, walkers] of files.entries()) {
			const laid = file(walkers, k, room, lanes[at]!);
			if (!laid) continue lanes;
			starts.push(...laid.map(({ at: along, robots }) => ({ at: along, robots, ground: lanes[at]! })));
		}
		return { starts, inner: lanes.at(-1)! };
	}
	return null;
}

// Where the rows of those who stand may go, as x from, x to and z from, z to.
type Zone = { x: number[]; z: number[] };
// What a row keeps clear of on `ground`: `deep`, the depth of a row; `gap` and `clear`, the gaps kept; `lamps`, the x of
// the square's lamps.
type Row = { zones: Zone[]; deep: number; gap: number; clear: number; lamps: number[]; ground: Ground };

// One row in the back-left corner, in front of the doors' steps (further forward the corner tree's crown and the lamp
// hid them); and rows inside the round, with room at their ends for the walkers who cut its corners, turned across
// them. `walker`: a walker's half width; `pad`: what a row keeps from the round.
function zonesOf(ground: Ground, inner: Ground, k: number, walker: number, gap: number, deep: number, pad: number): Zone[] {
	const ROUND = inner.round;
	const corner = { x: [-5, ROUND.left - walker - gap], z: [-1.15 + gap + deep / 2, -0.3] };
	// On a venue, the first row keeps SIGHT more from the walkers behind it: its heads hid those of its back lane.
	const back = ROUND.back + pad + (ground.lanes ? SIGHT * k : 0);
	const inside = { x: [ROUND.left + walker + gap + 0.4, ROUND.right - walker - gap - 0.4], z: [back, ROUND.front - pad] };
	return ground.corner ? [corner, inside] : [inside];
}

// The stretches of the row at `z` free of what is kept.
function runsAt(z: number, { zones, deep, gap, clear, lamps, ground }: Row): [number, number][] {
	let runs = zones.filter((zone) => z >= zone.z[0]! && z <= zone.z[1]!).map((zone): [number, number] => [zone.x[0]!, zone.x[1]!]);
	const [near, far] = [z - deep / 2 - gap, z + deep / 2 + gap];
	// A lamp hides only who stands close behind it: further back, a head shows above its lantern.
	const lit = lamps.filter(() => LAMP_Z - z < BEHIND).map((x): [number, number, number] => [x, LAMP_Z, LAMP]);
	const shades = [...ground.tall, ...lit]
		.filter(([, cz]) => z < cz)
		.map(([cx, cz, w]): [number, number, number, number] => [near + cx - cz - w, far + cx - cz + w, near, far]);
	const cut = (x0: number, x1: number, air: number): void => {
		runs = runs
			.flatMap(([a, b]): [number, number][] => [
				[a, Math.min(b, x0 - air)],
				[Math.max(a, x1 + air), b],
			])
			.filter(([a, b]) => b > a);
	};
	for (const [x0, x1, z0, z1] of ground.kept) if (far + clear >= z0 && near - clear <= z1) cut(x0, x1, clear);
	for (const [x0, x1, z0, z1] of shades) if (far >= z0 && near <= z1) cut(x0, x1, gap);
	return runs;
}

// The rows of those who stand, inside the round: each agent, then its robots in columns of two at its right. `lamps`:
// the x of the square's lamps, whose line of sight no one stands in. `room`: the share of the gaps kept. `inner`: the
// innermost round walked (./crowd.ts#walk).
function rows(standing: Agent[], k: number, lamps: number[], room: number, ground: Ground, inner = ground): Stand[] | null {
	const [gap, apart, between, clear] = [GAP * room, APART * room, ROW * room, CLEAR * room];
	const walker = PERSON.x * SIZE * 1.06 * k;
	const [rx, rz] = halfOf(BOT, Math.PI / 4, ROBOT * k);
	const halves = standing.map((agent) => halfOf(PERSON, turnOf(agent), sizeOf(agent) * k));
	const deep = Math.max(2 * rz, ...halves.map(([, hz]) => 2 * hz), standing.some((agent) => agent.children.length > 1) ? 4 * rz + gap : 0);
	const pad = walker + gap + deep / 2;
	const zones = zonesOf(ground, inner, k, walker, gap, deep, pad);
	const row: Row = { zones, deep, gap, clear, lamps, ground };
	const last = Math.max(...zones.map((zone) => zone.z[1]!));
	let z = Math.min(...zones.map((zone) => zone.z[0]!));
	let [runs, run] = [runsAt(z, row), 0];
	let cursor = runs[0]?.[0] ?? Infinity;
	const stands: Stand[] = [];
	for (const [at, agent] of standing.entries()) {
		const [hx] = halves[at]!;
		const columns = Math.ceil(agent.children.length / 2);
		const width = 2 * hx + (columns ? gap + columns * (2 * rx + gap) - gap : 0);
		while (run < 0 || run >= runs.length || cursor + width > runs[run]![1]) {
			run++;
			if (run >= runs.length) {
				// On a venue, rows SIGHT further apart: a robot hid behind the agent in front of it on its right.
				z += deep + between + (ground.lanes ? SIGHT * k : 0);
				if (z > last) return null;
				[runs, run] = [runsAt(z, row), -1];
				continue;
			}
			cursor = runs[run]![0];
		}
		const x = cursor + hx;
		const twoDeep = agent.children.length > 1;
		stands.push({
			x,
			z,
			robots: agent.children.map((_, child) => ({
				x: x + hx + gap + rx + Math.floor(child / 2) * (2 * rx + gap),
				z: twoDeep ? z + (child % 2 ? 1 : -1) * (rz + gap / 2) : z,
			})),
		});
		// The robot behind its column stands in the line of sight of who stands next on the right: SIGHT more between them,
		// on a subject's square as on a venue.
		cursor += width + apart + (twoDeep ? SIGHT * k : 0);
	}
	return stands;
}

// Whether every one of `agents` has room on `ground` at `scale` (../plan/quarters.ts).
export function fits(agents: Agent[], lamps: number[], scale: number, ground = SQUARE): boolean {
	const standing = agents.filter((agent) => agent.state !== 1);
	const walked = walk(
		agents.filter((agent) => agent.state === 1),
		standing.length > 0,
		scale,
		1,
		ground,
	);
	return !!walked && !!rows(standing, scale, lamps, 1, ground, walked.inner);
}

// The square's crowd, at the largest scale (`most` at most) at which every one of it has room. `lamps`: the x of its
// lamps.
export function crowdOf(agents: Agent[], lamps: number[] = [], most = 1, ground = SQUARE): Crowd {
	const walking = agents.filter((agent) => agent.state === 1);
	const standing = agents.filter((agent) => agent.state !== 1);
	let scale = most;
	for (;;) {
		const room = Math.min(1, scale / FLOOR);
		const walked = walk(walking, standing.length > 0, scale, room, ground);
		const stands = walked && rows(standing, scale, lamps, room, ground, walked.inner);
		if (walked && stands) return { scale, stands, starts: walked.starts };
		scale *= 0.95;
	}
}
