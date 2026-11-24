// One step of a figure towards what is wanted of it (./live.ts): what a change of its agent plays, by the layers and
// the grains of ./layers.ts. A session that closes: its figure goes back to its building's door. One that opens, or
// whose state changes: it goes from its old place while it is born at the new one. In the same state: its robots are
// born from its chest or go back to it, and the rest is written at once.
import { BIRTH, played, plays, type Point } from "./births";
import { drawSelf, ghostOf, hide, type Life, type Parts } from "./bodies";
import { staffed, type Square } from "./crowd-lay";
import type { Grain } from "./dust";
import type { Flight } from "./layer-grains";
import { END } from "./layers";
import type { Pull } from "./pulls";
import type { Kind } from "./town-sound";

// An agent as the page shows it now: its session, its subject, its state (0 at rest, 1 at work, 2 it waits for the
// user, 3 to review), its name, its subagents, 1 for one at work, its open pull requests (./pulls.ts), its subject's
// merges as its session says them (none: 0), and the addresses of its merged pull requests (./landing.ts). `unfiled`:
// the page has not filed its session under a subject yet (./plot.ts). `act`: what its last tool has it hold while it
// works (./sources.ts#actOf).
export type Wanted = {
	handle: string;
	topic: string;
	state: number;
	name: string;
	children: number[];
	pulls: Pull[];
	merges?: number;
	merged?: string[];
	unfiled?: boolean;
	act?: number;
};
// What the town's drawing gives its life: where the grains fly, a grain's size in metres, and whether the camera shows
// a place's figures; where it does not, a change is there at once, without layers nor grains. `moves`: false with
// motion reduced; what shows at every level (./scaffolds.ts) then changes at once too. `bricks`: bricks fly until the
// town's second `until` (./stage.ts). `rises`: the town stands as high as `top` now, and what is laid up there is built.
// `hear`: an event the town plays at a place, heard if the screen shows it; `knock`: bricks land there, `high` up their
// building (./town-sound.ts). Told only of what is played, never of what is there at once.
export type Stage = {
	add: (flight: Flight) => void;
	size: () => number;
	seen: (lot: number) => boolean;
	moves: () => boolean;
	bricks: (grains: Grain[], until: number) => void;
	rises: (top: number) => void;
	hear?: (kind: Exclude<Kind, "laid">, at: Point) => void;
	knock?: (at: Point, high: number) => void;
};

// The town's life, as its steps share it. `homes`: each figure's place. `active`: who does not show what is wanted of
// it yet. `changed`: the places to lay again. `births`: who is born once they are laid. `doorOf`: where the matter of
// a subject's inhabitants comes from and goes back to, by the subject's index. `busy`: the figures born or going now.
// `sudden`: what changed while the town was not looked at is there at once. `began`: the figures that started to play
// at this frame.
export type Lives = {
	parts: Parts;
	homes: Map<Life, Square>;
	active: Set<Life>;
	changed: Set<Square>;
	births: (() => void)[];
	doorOf: (index: number) => Point;
	random: () => number;
	busy: number;
	sudden: boolean;
	began: number;
};
// One step of one figure: at the town's second `at`; `quick`, without layers nor grains.
type Turn = { town: Lives; life: Life; square: Square; on: Stage; at: number; quick: boolean };

// Between two figures of one place born or going, in seconds: twelve sessions opened together come as a wave of two
// seconds, not as a flash.
const WAVE = 0.18;
// The figures born or going at once in the whole town: past them, a change is there at once.
const MOST = 40;
// The figures that start to play in one frame, in the whole town; the others start at the next ones. A figure's grains
// take some 10 ms to make (./layer-grains.ts#grainsOf): forty agents of forty subjects that changed in one message
// froze the town for a second (18/11). Two: one that goes from a subject and one born on another start together.
const AT_ONCE = 2;

// Whether `life` shows what is wanted of it, with as many robots as its place has (`room`).
function same(life: Life, room: number): boolean {
	const { agent, want } = life;
	if (!life.shown || !want) return false;
	const children = want.children.slice(0, room);
	return (
		want.state === agent.state &&
		want.name === agent.name &&
		children.length === agent.children.length &&
		children.every((running, child) => running === agent.children[child])
	);
}

// The agent of `life` becomes what is wanted of it, with as many robots as its place has.
function becomes(town: Lives, life: Life, square: Square): void {
	const { name, state, children, act = 0 } = life.want!;
	life.agent = life.figure.agent = { ...life.agent, name, state, act, children: children.slice(0, life.robots.length + square.pool.length) };
	staffed(square, life);
	town.changed.add(square);
}

// The figure of `life` and its robots leave their place, whole again for who comes next.
function leaves(town: Lives, life: Life, square: Square): void {
	hide(life.self);
	life.agent = life.figure.agent = { ...life.agent, children: [] };
	staffed(square, life);
	[life.shown, life.figure.away, life.named, life.swap] = [false, true, undefined, undefined];
	town.changed.add(square);
}

// `life` takes no other step before the town's second `until`; `after` ends what it played.
function waits(town: Lives, life: Life, until: number, after: () => void = () => undefined): void {
	life.busy = { until, after };
	town.busy++;
}

// Whether `life` plays nothing any more at `seconds`: what it played has just ended, or it played nothing.
function rested(town: Lives, life: Life, seconds: number): boolean {
	if (!life.busy) return true;
	if (seconds < life.busy.until) return false;
	const { after } = life.busy;
	life.busy = undefined;
	town.busy--;
	after();
	return true;
}

// The figure of the turn (`child` null) or one of its robots is born or goes, in layers and grains.
function fly({ town, life, square, on, at }: Turn, child: number | null, born: boolean): void {
	const flight = played(life, town.doorOf(square.index), child, born, at, on.size(), town.random);
	if (flight) on.add(flight);
}

// Its session closed: it goes back to the door with its robots, then leaves its place.
function goes(turn: Turn): void {
	const { town, life, square } = turn;
	if (turn.quick) return leaves(town, life, square);
	turn.on.hear?.("left", town.doorOf(square.index));
	fly(turn, null, false);
	for (const child of life.robots.keys()) fly(turn, child, false);
	waits(town, life, turn.at + END, () => leaves(town, life, square));
}

// Its session opened, or its state changed: its second body goes from its old place while it is born at the new one.
function comes(turn: Turn): void {
	const { town, life, square, on, at, quick } = turn;
	const door = town.doorOf(square.index);
	const ghost = life.shown && !quick ? ghostOf(town.parts, life) : null;
	if (ghost) on.add(plays(ghost, () => door, false, at, on.size(), town.random));
	const [had, opened] = [life.shown ? life.robots.length : 0, !life.shown];
	becomes(town, life, square);
	[life.shown, life.self.k] = [true, undefined];
	if (quick) return void (life.figure.away = false);
	// A session that opens is heard; one that only changes its state is not: agents do so every few seconds.
	if (opened) on.hear?.("born", door);
	town.births.push(() => {
		fly(turn, null, true);
		for (let child = had; child < life.robots.length; child++) fly(turn, child, true);
	});
	waits(town, life, at + BIRTH, () => {
		if (ghost) hide(ghost);
		life.fading = undefined;
	});
}

// In the same state: its robots, their colour, its name.
function staffs(turn: Turn): void {
	const { town, life, square, at, quick } = turn;
	const [had, kept] = [life.robots.length, Math.min(life.want!.children.length, life.robots.length + square.pool.length)];
	if (kept < had && !quick) {
		for (let child = kept; child < had; child++) fly(turn, child, false);
		return waits(town, life, at + END, () => {
			life.agent = life.figure.agent = { ...life.agent, children: life.agent.children.slice(0, kept) };
			staffed(square, life);
			town.changed.add(square);
		});
	}
	becomes(town, life, square);
	if (kept <= had || quick) return;
	town.births.push(() => {
		for (let child = had; child < kept; child++) fly(turn, child, true);
	});
	waits(town, life, at + BIRTH);
}

// Its agent, still at work, took another tool: what it held gives its place to the next (./bodies.ts#carry). No birth,
// no grain, and its place is not laid again: an agent changes tool every few seconds. Where it is not
// `seen`, and for what changed while the town was not looked at, the next is there at once.
function holds(town: Lives, life: Life, seconds: number, seen: () => boolean): void {
	const { agent, self, want } = life;
	if (!life.shown || want?.state !== agent.state) return;
	const [was, act] = [agent.act ?? 0, want.act ?? 0];
	if (act === was) return;
	// Its agent stays the same one: its name says nothing of its tool, and is not written again (./sign-nodes.ts#nameOf).
	agent.act = act;
	// Not laid yet: its place's next laying draws it (./crowd-lay.ts#lay).
	if (self.k === undefined) return;
	const left = self.drawn[1]!;
	// A swap it had not ended is cut: what that one left goes at once.
	life.swap = undefined;
	drawSelf(town.parts, life, self.stand.x, self.stand.z, self.stand.ry, self.k);
	if (town.sudden || !seen()) return;
	self.drawn.push(left);
	life.swap = { act: was, since: seconds };
}

// One step of `life` towards what is wanted of it, at the town's second `seconds`.
export function step(town: Lives, life: Life, seconds: number, on: Stage): void {
	const square = town.homes.get(life)!;
	if (!rested(town, life, seconds)) return;
	const { want } = life;
	if (!life.shown && !want) life.free = true;
	if (life.free) return void town.active.delete(life);
	holds(town, life, seconds, () => on.seen(square.lot));
	if (same(life, life.robots.length + square.pool.length)) return void town.active.delete(life);
	const quick = town.sudden || !on.seen(square.lot) || town.busy >= MOST;
	if (!quick && (seconds < square.next || town.began >= AT_ONCE)) return;
	if (!quick) [square.next, town.began] = [seconds + WAVE, town.began + 1];
	// A mark of 0 says a figure is there (./parts.ts#Part): the town's first instant is not one.
	const turn: Turn = { town, life, square, on, at: Math.max(seconds, 0.001), quick };
	if (!want) goes(turn);
	else if (!life.shown || want.state !== life.agent.state) comes(turn);
	else staffs(turn);
}
