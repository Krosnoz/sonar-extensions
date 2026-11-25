// The town's traffic: the cars, their colours, the signals of the avenue's crossings and the lanes they drive.
import { BRIDGE_END } from "./avenue";
import { RAMP_DOWN, RAMP_UP, deckAt } from "./canals";
import type { Layout } from "./layout";
import type { Kit } from "../render/kit";
import { merge } from "../render/nodes";
import { b, cyl, rnd, T, type G } from "../render/shapes";
import { ROAD, EDGE } from "./street";

const key = (i: number, j: number): string => `${i},${j}`;

// What drives along the streets and the avenue: cars of every colour, at their own speed, looping across the town. The
// model is drawn at 0.95 long and grown by `CAR_SCALE`: a car must read as a car next to a 1.3 storey, not as a toy. At
// 1.4 it is 0.64 wide, in a lane 1.1 wide (the road is 2.34), and 1.33 long. Its wheels stay under its body (their
// outer face 0.005 inside its side): standing out of it, they came 0.13 from the kerb, and the kerb's top, seen from the
// camera's pitch, covered them.
const CAR_SCALE = 1.4;
function car(): G {
	return merge([
		b("#ffffff", 0.95, 0.26, 0.46, 0, 0.1, 0, 1),
		b("#ffffff", 0.52, 0.2, 0.42, -0.06, 0.36, 0, 1),
		b("#2f4a63", 0.5, 0.15, 0.44, -0.06, 0.38, 0, 6.1),
		b("#2f4a63", 0.04, 0.15, 0.38, 0.21, 0.38, 0, 6.1),
		...[-0.3, 0.3].flatMap((x) => [-0.185, 0.185].map((z) => cyl("#24262b", 0.11, 0.11, 0.08, x, 0.11, z, 8, 0, [Math.PI / 2, 0, 0]))),
		b("#ffe7a0", 0.03, 0.06, 0.08, 0.48, 0.24, 0.14, 4),
		b("#ffe7a0", 0.03, 0.06, 0.08, 0.48, 0.24, -0.14, 4),
	]).scale(CAR_SCALE, CAR_SCALE, CAR_SCALE);
}
// Seven colours apart from each other: red, yellow, blue, white, charcoal, green, silver. A yellow (#f2c14e) beside an
// orange (#e98a3a) read as two orange cars.
const CARS = ["#d8453a", "#f2d64b", "#3f6fb0", "#f4f2ee", "#2c303b", "#4f9d69", "#9aa4ae"];
// The n-th car takes the colour `STRIDE` after the one before it: the cars of a lane, made one after the other, never
// share a colour, nor those of the next lane, as a draw gave three orange ones side by side.
const STRIDE = 3;

// The signals. At each crossing of the avenue and a street the avenue's cars go (GREEN s), then both wait (PAUSE s, so
// that what is inside clears), then the street's go, then both wait. A car treats a signal as red a little before it is
// (AHEAD s), so that it has room to stop. Each crossing has its own phase, so that the town's cars do not all start at once.
const GREEN = 7;
const PAUSE = 2.5;
const CYCLE = 2 * (GREEN + PAUSE);
const AHEAD = 1.2;
const mod = (value: number, by: number): number => ((value % by) + by) % by;
const avenueGoes = (t: number, j: number): boolean => mod(t + 3 * j, CYCLE) < GREEN;
const streetGoes = (t: number, j: number): boolean => mod(t + 3 * j, CYCLE) >= GREEN + PAUSE && mod(t + 3 * j, CYCLE) < 2 * GREEN + PAUSE;
// A street's crossing (x ±0,65 in a block, z 2,92 to 5,0) is used for 3 s in 18 s, at a time of its own.
const walking = (t: number, i: number, j: number): number => mod(t + 5 * i + 3 * j, 18);
// A crossing is closed to cars from 0 to 5 s of its cycle (the walkers are on it from 1.5 to 4.5), and from WALK_LEAD s
// before that for a car on its way: one that entered the stripes at the last moment was still on them when the first
// walker stepped on (2 s to clear them).
const WALK_LEAD = 1.6;
const blocked = (t: number, i: number, j: number): boolean => walking(t, i, j) < 5 || walking(t + WALK_LEAD, i, j) < 5;

// A lane's stop line: where it is along the lane's axis, when it is closed, and how far beyond it (`hold`) a car or a
// closed gate must stand for a car to cross what the line guards without stopping on it. A car stops its front short of it.
type Gate = { at: number; closed: (t: number) => boolean; hold: number };
// `lo` to `hi` is where the lane shows (just inside the first block's edge and the last one's); the lane runs on 3 beyond
// each end, hidden, so that a car comes back from the void, never out of a crossing.
type Lane = { fixed: number; along: "x" | "z"; sign: number; from: number; span: number; lo: number; hi: number; bridges: [number, number][]; gates: Gate[] };
type Car = { lane: Lane; pos: number; v: number; max: number };
// `LENGTH` is the room a car takes along its lane (its body and a margin: 1.3 at the old size), `CAR_FRONT` how far its
// front is from the position it is given (0.5 at the old size), `CAR_BEHIND` how far its body reaches behind a line
// (0.45). Each follows `CAR_SCALE`, and so do the gates' `hold`s below (`GROWN` more), which keep the room of one car past a line.
const [ACCEL, BRAKE, HARD, STANDOFF, STEP] = [1.5, 3, 6, 0.1, 0.05];
const [LENGTH, CAR_FRONT, CAR_BEHIND, GROWN] = [1.3 * CAR_SCALE, 0.5 * CAR_SCALE, 0.45 * CAR_SCALE, 1.3 * (CAR_SCALE - 1)];
// The air kept between two bodies of one lane, and a lane's distance from the road's middle: a car keeps 0.23 off the
// kerb (its top shows 0.16 beyond its foot from the camera), and two cars of opposite lanes pass 0.6 apart (a body
// being 0.64 wide).
const [FOLLOW, LANE] = [0.25, 0.62];
// How far a waiting car's line is from the stripes of a crossing: its front stops STANDOFF short of it, so its whole body keeps
// 0.6 off the stripes (it was 0.3 for a line, 0.4 for the body, and the car then touched them from the camera).
const KEEP = 0.5;
// In the avenue's block the carrefour (x 2.7) is 2.05 from the stripes (x 0.65): a car that comes from the carrefour (going -x)
// cannot wait between them off both, so it keeps 0.3 (its rear stays out of the carrefour); one that comes from the other side has room.
const keepOff = (i: number, avenue: number, sign: number): number => (i === avenue && sign < 0 ? 0.3 : KEEP);
// The body of a car, drawn 0.95 long.
const CAR_LENGTH = 0.95 * CAR_SCALE;
// How far in from a block's edge a lane is shown to its end: the low wall that ends a street stands from 0.21 short of the
// edge (its inner face at 5.29), and a body is 1.33 long, so its centre stays 1.1 in: its end keeps 0.2 off the wall. At
// 0.9 it came out of the wall, 0.01 off it, and the wall's top covered it from the camera.
const WALL_INSET = 1.1;

// A car waits with its front `STANDOFF` short of a gate's line: when its body would then lie on a bridge's ramp, the
// line moves back against the way of the lane, so that the car waits on the deck, never on a slope.
function offRamps(gates: Gate[], sign: number, bridges: [number, number][]): Gate[] {
	for (const gate of gates)
		for (const [lo, hi] of bridges)
			for (const [from, to] of [
				[lo, lo + RAMP_UP],
				[hi - RAMP_DOWN, hi],
			] as const) {
				const front = gate.at - sign * STANDOFF;
				const [low, high] = [Math.min(front, front - sign * CAR_LENGTH), Math.max(front, front - sign * CAR_LENGTH)];
				if (low >= to || high <= from) continue;
				const line = sign > 0 ? from + 0.05 : to - 0.05;
				gate.hold += Math.abs(line - gate.at);
				gate.at = line;
			}
	return gates;
}

// A lane loops over the blocks that exist along it, shown from just inside the first one's edge (where the street ends
// in a wall) to just inside the last one's, never over the void. `bridges` are the stretches where it rides a deck.
const along = (blocks: number[]) => {
	const [lo, hi] = [Math.min(...blocks) * T - T / 2 + WALL_INSET, Math.max(...blocks) * T + T / 2 - WALL_INSET];
	return { from: lo - 3, span: hi - lo + 6, lo, hi };
};

// The lanes of the town: two along each street, two along the avenue.
function lanesOf({ side, avenue, bay, river, canal }: Layout): Lane[] {
	const lanes: Lane[] = [];
	const indices = Array.from({ length: side }, (_, n) => n);
	const column = indices.filter((j) => !bay.has(key(avenue, j)));
	for (let j = 0; j < side; j++) {
		const row = indices.filter((i) => !bay.has(key(i, j)));
		const bridges = row.filter((i) => i === river).map((i): [number, number] => [i * T + EDGE - T, i * T + 2]);
		if (!row.length) continue;
		for (const sign of [1, -1]) {
			const gates: Gate[] = [];
			// Short of the avenue's carriageway (x 2,7 to 5,04 of its block), and of each crossing.
			if (column.includes(j))
				gates.push({
					at: avenue * T + (sign > 0 ? 2.7 - 0.25 : 5.04 + 0.25),
					closed: (t) => !streetGoes(t, j) || !streetGoes(t + AHEAD, j),
					hold: 3.7 + GROWN,
				});
			for (const i of row)
				if (i !== river && !bay.has(key(i, j + 1)) && j + 1 < side)
					gates.push({
						at: i * T + (sign > 0 ? -0.65 - keepOff(i, avenue, sign) : 0.65 + keepOff(i, avenue, sign)),
						closed: (t) => blocked(t, i, j),
						hold: 2.6 + keepOff(i, avenue, sign) + GROWN,
					});
			lanes.push({ fixed: j * T + 3.87 + sign * LANE, along: "x", sign, ...along(row), bridges, gates: offRamps(gates, sign, bridges) });
		}
	}
	const bridges = column.filter((j) => j === canal).map((j): [number, number] => [j * T + EDGE - T, j * T + BRIDGE_END]);
	for (const sign of column.length ? [1, -1] : []) {
		// Coming down (+z) a car stops short of the crossing before the street (z 1,25), or of the street's carriageway
		// over the bridge, where there is none; going up it stops short of the carriageway: the crossing is then behind it.
		const gates = column.map((j): Gate => ({
			at: j * T + (sign > 0 ? (j === canal ? 2.7 - 0.25 : 1.25 - KEEP) : 5.04 + 0.25),
			closed: (t) => !avenueGoes(t, j) || !avenueGoes(t + AHEAD, j),
			hold: (sign > 0 ? 5.1 + KEEP : 3.9) + GROWN,
		}));
		lanes.push({ fixed: avenue * T + 3.87 - sign * LANE, along: "z", sign, ...along(column), bridges, gates: offRamps(gates, sign, bridges) });
	}
	return lanes;
}

// Cars start spread along their lane, at a speed of their own.
function carsOf(lanes: Lane[], r: () => number): Car[] {
	return lanes.flatMap((lane) => {
		const count = lane.along === "z" ? 3 : 1 + Math.floor(r() * 2);
		return Array.from({ length: count }, (_, k) => {
			const max = 1.6 + r() * 1.4;
			return { lane, pos: ((k + r() * 0.5) * lane.span) / count, v: 0.7 * max, max };
		});
	});
}

// How far the front of a car is short of a gate, along its way (negative: past it).
const short = ({ lane, pos }: Car, gate: Gate): number => lane.sign * (gate.at - (lane.from + pos + lane.sign * CAR_FRONT));

// The traffic's own time, in seconds.
type Clock = { now: number };

// Would the car, crossing `gate`, have to stop inside what it guards? Yes when a car stands, or a gate beyond is
// closed, less than `hold` past the line: the car waits short of it, so that none stops on a crossing or in a carrefour.
function held(cars: Car[], clock: Clock, driven: Car, gate: Gate): boolean {
	const { lane } = driven;
	const beyond = (at: number): number => lane.sign * (at - gate.at);
	// A car between the line and the next gate close behind it (a carrefour's) will queue there: the car behind it would
	// then stand on the crossing, so it waits too.
	const walls = lane.gates.filter((next) => next !== gate && beyond(next.at) > 0 && beyond(next.at) < gate.hold + LENGTH).map((next) => beyond(next.at));
	const wall = walls.length ? Math.min(...walls) : 0;
	return (
		cars.some(
			(other) =>
				other !== driven &&
				other.lane === lane &&
				beyond(lane.from + other.pos) > -CAR_BEHIND &&
				(beyond(lane.from + other.pos) - CAR_FRONT < gate.hold || beyond(lane.from + other.pos) < wall),
		) || lane.gates.some((next) => next !== gate && beyond(next.at) > 0 && beyond(next.at) < gate.hold && next.closed(clock.now))
	);
}

// One step of `dt` seconds of every car.
function step(cars: Car[], clock: Clock, dt: number): void {
	const moves = cars.map((driven) => {
		const { lane } = driven;
		// The speed it may have: its own, and what lets it stop short of a closed gate and of the car ahead.
		let limit = driven.max;
		let room = Infinity;
		for (const gate of lane.gates) {
			const d = short(driven, gate);
			if (d > -0.02 && (gate.closed(clock.now) || (d < 6 && held(cars, clock, driven, gate)))) {
				limit = Math.min(limit, Math.sqrt(2 * BRAKE * Math.max(d - STANDOFF, 0)));
				room = Math.min(room, Math.max(d - 0.02, 0));
			}
		}
		for (const other of cars)
			if (other !== driven && other.lane === lane) {
				const gap = mod((other.pos - driven.pos) * lane.sign, lane.span) - LENGTH;
				limit = Math.min(limit, other.v + Math.sqrt(2 * BRAKE * Math.max(gap - FOLLOW, 0)));
				room = Math.min(room, Math.max(gap - FOLLOW, 0));
			}
		driven.v = Math.max(0, driven.v + Math.min(ACCEL * dt, Math.max(limit - driven.v, -HARD * dt)));
		return Math.min(driven.v * dt, room);
	});
	cars.forEach((driven, n) => {
		driven.pos = mod(driven.pos + driven.lane.sign * moves[n]!, driven.lane.span);
		if (moves[n]! < driven.v * dt - 1e-9) driven.v = moves[n]! / dt;
	});
	clock.now += dt;
}

export function traffic(kit: Kit, layout: Layout, seed: number): (seconds: number) => void {
	const r = rnd(seed + 99);
	const lanes = lanesOf(layout);
	const cars = carsOf(lanes, r);
	// A car does not cross a block whose street waits for its cubes (../arrival/delays.ts).
	const part = kit.part(car(), cars.length, { waits: "ground" });
	const first = Math.floor(r() * CARS.length);
	const placed = cars.map((_, n) => part.put({ x: 0, y: ROAD, z: 0, color: CARS[(first + n * STRIDE) % CARS.length]! }));
	const clock: Clock = { now: 0 };
	let last: number | undefined;
	return (seconds) => {
		// The cars start 20 s before the first image, so that none is caught on a crossing by where it was first put.
		if (last === undefined) {
			clock.now = seconds - 20;
			for (let n = 0; n < 400; n++) step(cars, clock, STEP);
			last = seconds;
		}
		// A long pause (a hidden page) does not run the cars all the time it lasted.
		for (let left = Math.min(Math.max(seconds - last, 0), 2); left > 1e-9; left -= STEP) step(cars, clock, Math.min(STEP, left));
		last = seconds;
		cars.forEach(({ lane, pos }, n) => {
			const real = lane.from + pos;
			const at = Math.min(Math.max(real, lane.lo), lane.hi);
			const [x, z] = lane.along === "x" ? [at, lane.fixed] : [lane.fixed, at];
			const heading = lane.along === "x" ? (lane.sign > 0 ? 0 : Math.PI) : lane.sign > 0 ? -Math.PI / 2 : Math.PI / 2;
			// On a bridge, the car follows its ramps and its deck.
			const deck = lane.bridges.find(([lo, hi]) => at >= lo && at <= hi);
			part.move(placed[n]!, x, deck ? deckAt(at - deck[0], deck[1] - deck[0]) : ROAD, z, heading, real === at ? 1 : 0.001);
		});
	};
}
