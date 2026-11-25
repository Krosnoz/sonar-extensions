// The bubbles of a crowd that waits (./heaps.ts): from four agents that wait on a place, one large bubble that says how
// many. No process, no graphics card: the inhabitants are built on a kit that only records what it is asked to draw.
import { expect, test } from "bun:test";
import { uniform, vec3 } from "three/tsl";
import type { Agent, Figure, Heap, Kit, Topic } from "../render/kit";
import type { Stage, Wanted } from "./live-steps";
import type { Badges } from "../marks/mark-heaps";
import { THREE } from "../render/nodes";
import type { Part } from "../render/parts";

await import("../test-page");
const { inhabitants } = await import("./inhabitants");
const { LOOKS } = await import("./figures");
const { BIRTH } = await import("./births");
const { BIG, FLY, TICK, beat, facing, hop, leftOf, swollen } = await import("./heaps");
const { badges, hiddenOf } = await import("../marks/mark-heaps");
const { forgetFont } = await import("../marks/mark-paint");
const { READ } = await import("../marks/mark-share");

// A bubble as its part draws it: where, how big (0: it does not show) and how it is turned.
type Drawn = { x: number; y: number; z: number; s: number; ry?: number | undefined };
// The part of the bubbles over the heads, in the order ./bodies.ts#figuresOf makes them; the large ones' is the last.
const BUBBLES = LOOKS + 2;

// One session per state given, in one subject; under 0, that session is closed.
const fleetOf = (states: number[]): Wanted[] =>
	states.flatMap((state, at) => (state < 0 ? [] : [{ handle: `s${at}`, topic: "Cache", state, name: `Agent ${at}`, children: [], pulls: [] }]));

// A town of one subject whose agents are in `states`. `seen`: whether the camera shows its place.
function townOf(states: number[], seen = true) {
	const parts: Drawn[][] = [];
	// The camera's heading (../camera/camera.ts), and whether it is so far that the people's parts do not show: a part that
	// does not show is not moved (../render/parts.ts#Part).
	const camera = { yaw: 0, far: false };
	let seed = 7;
	const size = (s: number | number[] | undefined): number => (typeof s === "number" ? s : 1);
	const kit = {
		night: false,
		aspect: 1.6,
		random: () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296,
		uTime: uniform(0),
		scene: new THREE.Scene(),
		blank: vec3(0, 0, 0),
		along: () => 0,
		part(): Part {
			const drawn: Drawn[] = [];
			parts.push(drawn);
			return {
				put: (given) => drawn.push({ x: given.x, y: given.y, z: given.z, s: size(given.s) }) - 1,
				move: (index, x, y, z, ry, s = 1) => void (camera.far || Object.assign(drawn[index]!, { x, y, z, s, ry })),
				set: (index, given) => void Object.assign(drawn[index]!, { x: given.x, y: given.y, z: given.z, s: size(given.s), ry: given.ry }),
				mark: () => undefined,
			};
		},
		heading: () => camera.yaw,
	} satisfies Kit;
	const agents = fleetOf(states).map((each, at): Agent => ({ ...each, seed: 0.13 + at * 0.29 }));
	const topics: Topic[] = [{ name: "Cache", agents, working: 0, waiting: 0, reviewing: 0 }];
	const world = inhabitants(kit, topics, { all: [], of: (index) => ({ i: index * 3, j: 0, x: index * 40, z: 0, topic: index }) });
	const stage: Stage = { add: () => undefined, size: () => 0.02, seen: () => seen };
	return {
		world,
		camera,
		follow: (next: number[], now = false) => world.follow(fleetOf(next), stage, now),
		// The bubbles over the heads, then the large ones at their full size.
		own: () => parts[BUBBLES]!.filter((each) => each.s > 0),
		big: () => parts.at(-1)!.filter((each) => each.s === BIG),
		// The place's large bubble as it is drawn now, whatever its size.
		round: () => parts.at(-1)![0]!,
		// Every frame of the town from its second `from` to `to`.
		run: (from: number, to: number) => {
			for (let frame = 0; from + frame / 60 <= to; frame++) world.tick(from + frame / 60);
		},
	};
}

// A large bubble half way of its flight: as it comes, as it goes.
const [COMING, GOING] = [swollen(0, BIG, 0.5), swollen(BIG, 0, 0.5)];

test("heaps: under four agents that wait on a place, each one keeps its bubble over its head", () => {
	const town = townOf([2, 2, 2, 0, 3]);
	town.world.tick(1);
	expect([town.own().length, town.big().length, town.world.heaps.map((heap) => heap.on)]).toEqual([3, 0, [false]]);
});

test("heaps: from four that wait, their bubbles are one large bubble that says how many, in a town just opened as in one that followed", () => {
	const opened = townOf([2, 2, 2, 2, 2, 0]);
	opened.world.tick(1);
	expect([opened.own().length, opened.big().length]).toEqual([0, 1]);
	expect(opened.world.heaps[0]).toMatchObject({ on: true, count: 5, shows: 1 });
	const followed = townOf([2, 2, 2, 0, 0, 0]);
	followed.world.tick(1);
	followed.follow([2, 2, 2, 2, 2, 0]);
	followed.run(1, 1 + 2 * BIRTH);
	expect([followed.own().length, followed.big().length]).toEqual([0, 1]);
	expect(followed.world.heaps[0]).toMatchObject({ on: true, count: 5, shows: 1 });
	// Over the middle of the same places.
	const [one, other] = [opened.big()[0]!, followed.big()[0]!];
	expect([other.x - one.x, other.y - one.y, other.z - one.z].map((gap) => gap.toFixed(3))).toEqual(["0.000", "0.000", "0.000"]);
});

test("heaps: a fourth that comes to wait sends the bubbles into the large one in 0.45 s, and one answered sends each back over its head", () => {
	const town = townOf([2, 2, 2, 0]);
	town.world.tick(1);
	const heads = town.own().map((each) => [each.y, each.s]);
	town.follow([2, 2, 2, 2]);
	town.world.tick(1);
	// Nothing has moved yet: three bubbles whole, the large one not there. The bubble of who comes starts over its head,
	// where it is born with it.
	expect([town.own().map((each) => [each.y, each.s]), town.round().s]).toEqual([[...heads, heads[0]!], 0]);
	town.world.tick(1 + FLY / 2);
	// Half way: the large one as large as it comes then, the others smaller than they were and higher.
	expect(town.round().s).toBeCloseTo(COMING, 6);
	expect(town.own().filter((each) => each.s < heads[0]![1]! && each.y > heads[0]![0]!).length).toBe(4);
	// What stands over the heads of those that wait (a name, a card: ./note-under.ts) comes down with the bubbles, and
	// goes back up with them: how far each bubble has left, and how high its name stands.
	const over = (): number[][] =>
		town.world.figures.filter((figure) => !figure.away && figure.agent.state === 2).map((figure) => [figure.bare ?? 0, figure.at[1]]);
	const between = (): boolean => over().every(([bare, name]) => bare! > 0.2 && bare! < 0.8 && name! > 1.7 && name! < 2.15);
	expect(between()).toBe(true);
	town.world.tick(1 + FLY + 0.02);
	expect([town.own().length, town.big().length, town.world.heaps[0]!.count]).toEqual([0, 1, 4]);
	// The fourth is born meanwhile; then the user answers it.
	town.run(1 + FLY + 0.02, 2 + BIRTH);
	expect(over()).toEqual([1, 1, 1, 1].map((bare) => [bare, 1.6]));
	const then = 3 + BIRTH;
	town.follow([2, 2, 2, 0]);
	town.world.tick(then);
	town.world.tick(then + FLY / 2);
	expect(town.round().s).toBeCloseTo(GOING, 6);
	// The three that still wait have their bubbles on their way back; the one answered has none.
	expect([town.own().length, town.world.heaps[0]!.on, over().length, between()]).toEqual([3, false, 3, true]);
	town.world.tick(then + FLY + 0.02);
	town.world.tick(then + FLY + 0.04);
	expect([town.own().map((each) => [each.y, each.s]), town.round().s, town.world.heaps[0]!.shows]).toEqual([heads, 0, 0]);
	expect(
		over()
			.flat()
			.map((value) => value.toFixed(6)),
	).toEqual([0, 2.25, 0, 2.25, 0, 2.25].map((value) => value.toFixed(6)));
	// A crowd that changes its scale while a bubble flies draws it past its whole size: it has not left more than all.
	expect([leftOf(1.5, 1.5), leftOf(0.75, 1.5), leftOf(0, 1.5), leftOf(1.6, 1.5), leftOf(-0.1, 1.5)]).toEqual([0, 0.5, 1, 0, 1]);
});

test("heaps: the large bubble comes a tenth past its size and settles, and leaves slowly then faster", () => {
	const coming = Array.from({ length: 101 }, (_, step) => swollen(0, BIG, step / 100));
	const most = Math.max(...coming);
	expect([most > BIG * 1.05, most < BIG * 1.12, coming[0], coming[100]]).toEqual([true, true, 0, BIG]);
	// Half its way out, it has lost an eighth of its size.
	expect([swollen(BIG, 0, 0), GOING, swollen(BIG, 0, 1)]).toEqual([BIG, BIG * 0.875, 0]);
});

test("heaps: a small bubble hops on its way, and lands where it goes", () => {
	expect([hop(0), hop(0.5) > 0.25, hop(1), hop(2)]).toEqual([0, true, 0, 0]);
	// Half way to the large bubble that comes, each one is that hop over the straight line from its head to it.
	const town = townOf([2, 2, 2, 0]);
	town.world.tick(1);
	const heads = town.own().map((each) => each.y);
	town.follow([2, 2, 2, 2]);
	town.world.tick(1.1);
	town.world.tick(1.1 + FLY / 2);
	const rest = town.world.heaps[0]!.at[1];
	expect(
		town
			.own()
			.slice(0, 3)
			.map((each, at) => (each.y - ((heads[at]! + rest) / 2 + hop(0.5))).toFixed(6)),
	).toEqual(["0.000000", "0.000000", "0.000000"]);
});

test("heaps: where the camera shows no figure, and for what changed while the town was not looked at, the large bubble is there at once", () => {
	for (const [seen, now] of [
		[false, false],
		[true, true],
	] as const) {
		const town = townOf([2, 2, 2, 0], seen);
		town.follow([2, 2, 2, 2], now);
		town.world.tick(1);
		expect([town.own().length, town.big().length, town.world.heaps[0]!.shows]).toEqual([0, 1, 1]);
	}
});

test("heaps: one whose session closes is no longer counted, and the last three take their bubbles back", () => {
	const town = townOf([2, 2, 2, 2, 2]);
	town.follow([2, 2, 2, 2, -1]);
	town.run(1, 2 + BIRTH);
	expect([town.world.heaps[0]!.count, town.own().length, town.big().length]).toEqual([4, 0, 1]);
	town.follow([2, 2, 2, -1, -1]);
	town.run(2 + BIRTH, 4 + 2 * BIRTH);
	expect([town.world.heaps[0]!.on, town.own().length, town.big().length]).toEqual([false, 3, 0]);
});

test("heaps: a count that changes on a bubble that stays makes it beat once and its figures roll from the count before", () => {
	const town = townOf([2, 2, 2, 2, 2]);
	town.world.tick(1);
	town.follow([2, 2, 2, 2, 0]);
	town.world.tick(2);
	expect(town.world.heaps[0]).toMatchObject({ on: true, count: 4, ticked: 2, roll: { from: 5, done: 0 } });
	town.world.tick(2 + TICK / 2);
	// Half its beat: an eighth larger, and its count with it.
	expect([town.round().s, town.world.heaps[0]!.shows]).toEqual([BIG * beat(TICK / 2), beat(TICK / 2)]);
	expect(beat(TICK / 2)).toBeCloseTo(1.12, 6);
	town.run(2 + TICK / 2, 2 + FLY + 0.04);
	expect([town.big().length, town.world.heaps[0]!.shows]).toEqual([1, 1]);
});

test("heaps: a count that changed while the town was not looked at is there at once, with no beat and no roll", () => {
	const town = townOf([2, 2, 2, 2, 2]);
	town.world.tick(1);
	town.follow([2, 2, 2, 2, 0], true);
	town.world.tick(2);
	expect([town.world.heaps[0]!.count, town.world.heaps[0]!.roll, town.world.heaps[0]!.ticked, town.big().length]).toEqual([4, undefined, undefined, 1]);
});

test("heaps: a bubble faces the camera however it is turned, over a head as over a group", () => {
	const few = townOf([2, 2, 2, 0]);
	few.world.tick(1);
	expect(few.own().map((each) => each.ry)).toEqual([facing(0), facing(0), facing(0)]);
	const heads = few.own().map((each) => [each.x, each.y, each.z, each.s]);
	few.camera.yaw = Math.PI / 2;
	few.world.tick(1.1);
	// Turned where they are.
	expect(few.own().map((each) => each.ry)).toEqual([facing(Math.PI / 2), facing(Math.PI / 2), facing(Math.PI / 2)]);
	expect(few.own().map((each) => [each.x, each.y, each.z, each.s])).toEqual(heads);
	const many = townOf([2, 2, 2, 2]);
	many.world.tick(1);
	many.camera.yaw = Math.PI;
	many.world.tick(1.1);
	expect([many.round().ry, many.round().s]).toEqual([facing(Math.PI), BIG]);
	// A large bubble that comes after the turn is drawn turned too.
	few.follow([2, 2, 2, 2]);
	few.run(1.1, 1.1 + FLY + 0.1);
	expect([few.round().ry, few.round().s]).toEqual([facing(Math.PI / 2), BIG]);
});

test("heaps: a camera turned from afar, where the people do not show, leaves the bubbles turned to it once they show", () => {
	for (const states of [
		[2, 2, 2, 0],
		[2, 2, 2, 2],
	]) {
		const town = townOf(states);
		town.world.tick(1);
		town.camera.far = true;
		town.camera.yaw = Math.PI / 2;
		town.world.tick(1.1);
		// The camera comes near again, its heading kept: nothing turns any more.
		town.camera.far = false;
		town.world.tick(1.2);
		expect([...town.own(), ...town.big()].map((each) => each.ry)).toEqual((states[3] ? [0] : [0, 0, 0]).map(() => facing(Math.PI / 2)));
	}
});

// A pen that records what it is asked to write: the texts, how much each is scaled, and the font's last size.
function penOf(): { pen: CanvasRenderingContext2D; texts: string[]; scales: number[] } {
	const [texts, scales]: [string[], number[]] = [[], []];
	const nothing = (): undefined => undefined;
	const pen = {
		measureText: () => ({ width: 8 }),
		beginPath: nothing,
		arc: nothing,
		clip: nothing,
		save: nothing,
		restore: nothing,
		translate: nothing,
		scale: (by: number) => void scales.push(by),
		strokeText: nothing,
		fillText: (text: string) => void texts.push(text),
		font: "",
	};
	return { pen: pen as unknown as CanvasRenderingContext2D, texts, scales };
}

// A large bubble of twelve, whose smallest people stand half a metre tall, and its counts. `behind`: a building hides it.
function badged(behind = false) {
	Object.assign(globalThis, { devicePixelRatio: 1 });
	const figure = (tall: number, away = false): Figure => ({ topic: 0, agent: { name: "", state: 2, seed: 0, children: [] }, at: [0, 0, 0], tall, away });
	const heap: Heap = { on: true, count: 12, at: [1, 2, 3], round: 0.4, lift: 0.05, shows: 1, people: [figure(0.6), figure(0.5), figure(0, true)] };
	const kept: Badges = { heaps: [heap], hidden: () => behind, reads: [] };
	const palette = { surface: "#fff", ink: "#000", font: "sans-serif" };
	// A frame of the counts, at 100 px a metre; `up`: a metre up on the screen. `turned` -1: the camera has gone half a
	// turn round the town. `dt`: the seconds since the frame before.
	const drawn = (up: number, turned = 1, dt = 0.016): { next: number[][]; texts: string[]; scales: number[]; font: string } => {
		const { pen, texts, scales } = penOf();
		forgetFont();
		const [next, draws]: [number[][], (() => void)[]] = [[], []];
		badges(kept, { project: ([x, y]) => [x * 100 * turned, y * 100], pen, palette }, [1, up, 100, dt], next, draws);
		for (const draw of draws) draw();
		return { next, texts, scales, font: pen.font };
	};
	return { heap, drawn };
}
// A metre up on the screen: the people read (READ pixels tall or more), or are specks counted by their place's mark.
const [READS, SPECKS] = [READ / 0.5, READ / 0.5 - 1];
const middle = (mark: number[]): [number, number] => [mark[0]! + mark[2]! / 2, mark[1]! + mark[3]! / 2];

test("heaps: the count is written on the large bubble once the place's people read, and not while their mark counts them from afar", () => {
	const near = badged().drawn(READS);
	expect([near.texts, near.next.map((mark) => [mark[4], mark[6]])]).toEqual([["12"], [[1, 12]]]);
	const far = badged().drawn(SPECKS);
	expect([far.texts, far.next]).toEqual([[], []]);
});

test("heaps: the count is written on the middle of its ball however the camera is turned, and follows it as it bobs", () => {
	// 2.05 m up, where the ball's middle is.
	expect([middle(badged().drawn(READS).next[0]!), middle(badged().drawn(READS, -1).next[0]!)]).toEqual([
		[100, 205],
		[-100, 205],
	]);
});

test("heaps: the count's figures are as tall as the ball's radius on the screen, and grow and beat with the ball", () => {
	const { heap, drawn } = badged();
	// A ball of 0.4 m at 100 px a metre: figures of 42 px.
	expect([drawn(READS).font.includes(" 42px "), drawn(READS).scales]).toEqual([true, [1]]);
	heap.shows = 0.25;
	const small = drawn(READS);
	expect([small.scales, small.texts, small.next[0]![7]]).toEqual([[0.25], ["12"], 0.25]);
	heap.shows = 1.12;
	const beating = drawn(READS);
	// What the next frame clears holds the ball as large as it is drawn.
	expect([beating.scales, beating.next[0]![2]! >= 2 * 40 * 1.12]).toEqual([[1.12], true]);
});

test("heaps: when the count changes, its figures roll in 0.3 s: the count before goes, the new one comes", () => {
	const { heap, drawn } = badged();
	[heap.count, heap.roll] = [11, { from: 12, done: 0 }];
	const first = drawn(READS, 1, TICK / 3);
	expect([first.texts, first.next[0]![8]! > 0, first.next[0]![8]! < 1]).toEqual([["12", "11"], true, true]);
	drawn(READS, 1, TICK / 3);
	const last = drawn(READS, 1, TICK / 2);
	expect([last.texts, last.next[0]![8], heap.roll]).toEqual([["11"], 1, undefined]);
});

test("heaps: a large bubble that went while it read, and comes back seen from afar, does not show its count for an instant", () => {
	const { heap, drawn } = badged();
	drawn(READS);
	heap.shows = 0;
	drawn(SPECKS);
	heap.shows = 1;
	expect(drawn(SPECKS).next).toEqual([]);
});

test("heaps: the count of a large bubble a building hides is not left alone over the roof", () => {
	expect(badged(true).drawn(READS).next).toEqual([]);
});

test("heaps: whether a building hides a large bubble is worked out again only once its count or the camera's axis has moved", () => {
	const { heap } = badged();
	const matrix = Array.from({ length: 16 }, () => 0.5);
	let cast = 0;
	const hidden = hiddenOf(
		() => ++cast > 0,
		() => matrix,
	);
	// Frame after frame of a town at rest: one ray.
	expect([hidden(heap), hidden(heap), hidden(heap), cast]).toEqual([true, true, true, 1]);
	matrix[8] = 0.6;
	hidden(heap);
	heap.at = [1, 2, 4];
	hidden(heap);
	expect(cast).toBe(3);
});

test("heaps: a change during the flight turns the bubbles round from where they are", () => {
	const town = townOf([2, 2, 2, 2, 0]);
	town.world.tick(1);
	town.follow([2, 2, 2, 0, 0]);
	town.world.tick(2);
	town.world.tick(2 + FLY / 2);
	expect(town.round().s).toBeCloseTo(GOING, 6);
	const flying = town.own().map((each) => [each.y, each.s]);
	town.follow([2, 2, 2, 0, 2]);
	// The large bubble grows again from the size it had, and the small ones turn back from where they were, the one
	// that comes apart: with no jump.
	town.world.tick(2 + FLY / 2);
	expect(town.round().s).toBeCloseTo(GOING, 6);
	expect(
		town
			.own()
			.slice(0, 3)
			.map((each) => [each.y, each.s]),
	).toEqual(flying);
	town.world.tick(2 + FLY / 2 + FLY + 0.02);
	expect([town.own().length, town.big().length, town.world.heaps[0]]).toMatchObject([0, 1, { on: true, count: 4, shows: 1 }]);
});
