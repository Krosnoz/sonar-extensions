// Which bubble goes where on a place whose agents wait for the user (./heaps.ts): each over its head, or all in the
// place's large bubble once enough of them wait. A place is told when its crowd is laid (./crowd-lay.ts#lay); its
// bubbles then fly for under half a second, and nothing is worked out for a place whose bubbles rest.
import type { Life, Parts } from "./bodies";
import type { Crowd } from "./crowd";
import type { Square } from "./crowd-lay";
import { BALL, BIG, FLY, HEAP, beat, flown, headOf, hop, leftOf, nameOver, restOf, rests, swollen } from "./heaps";
import type { Heap } from "./kit";
import { STATE } from "./state-colours";

// The large bubble's seed: how it bobs (./nodes.ts#bob), and its count with it.
const SEED = 0.5;
export const bobAt = (seconds: number): number => Math.sin(seconds * 3.2 + SEED * 40) * 0.07;

// Where the bubble of each one that waits on the square rests from the town's second `seconds`: over its head, or in
// the large bubble of its group once HEAP of them wait, over the middle of their places. Told before the crowd is
// drawn. `sudden`: every bubble is in place at once.
export function gathers(square: Square, crowd: Crowd, seconds: number, sudden: boolean): void {
	const waiting: [Life, number, number][] = [];
	let standing = 0;
	for (const life of square.lives) {
		const place = life.shown && life.agent.state !== 1 ? crowd.stands[standing++] : undefined;
		if (place && life.agent.state === 2) waiting.push([life, square.x + place.x, square.z + place.z]);
		else [life.heap, life.fly] = [undefined, undefined];
	}
	const count = waiting.length;
	const middle = (axis: 1 | 2): number => waiting.reduce((sum, each) => sum + each[axis], 0) / count;
	const rest = count >= HEAP ? restOf(middle(1), middle(2), crowd.scale) : undefined;
	for (const [life, x, z] of waiting) {
		life.heap = rest;
		// One whose bubble never left its head has no flight: it is drawn with its figure (./bodies.ts#drawSelf).
		if (rest || life.fly) flown(life, headOf(x, z, crowd.scale), seconds, sudden);
		else life.figure.bare = 0;
	}
	square.big.heap = rest && [rest[0], rest[1], rest[2], BIG];
	if (rest) counts(square.heap, count, seconds, sudden);
	square.heap.on = !!rest;
	if (rest || square.big.fly) square.flown = seconds + FLY;
}

// `count` wait in the large bubble from the town's second `seconds`. The count of a bubble that stays changes: the
// bubble beats and its figures roll from the count before. Not for what is in place at once.
function counts(heap: Heap, count: number, seconds: number, sudden: boolean): void {
	if (heap.on && heap.count !== count && !sudden) [heap.ticked, heap.roll] = [seconds, { from: heap.count, done: 0 }];
	heap.count = count;
}

// The square's large bubble grows and shrinks where it rests: it has no place of its own out of a heap.
function swells(parts: Parts, square: Square, seconds: number, sudden: boolean): void {
	const { big, heap } = square;
	const [x0, y0, z0] = big.heap ?? big.fly?.at ?? [square.x, 0, square.z];
	const [x, y, z] = flown(big, [x0, y0, z0, 0], seconds, sudden);
	const fly = big.fly!;
	const size = swollen(fly.from[3], fly.to[3], (seconds - fly.since) / FLY);
	// Where it is now is where it goes from, should its group change meanwhile: its size as it is drawn.
	fly.at = [x, y, z, size];
	const s = size * beat(seconds - (heap.ticked ?? -1));
	parts.rounds.set(square.bubble, { x, y, z, ry: parts.turn, s, color: STATE[2]!, state: 2, seed: SEED });
	// Its count is written on the middle of its ball, and grows and beats with it (./mark-heaps.ts).
	[heap.at, heap.round, heap.shows] = [[x, y, z], BALL * BIG, s / BIG];
	if (!big.heap && rests(big, seconds)) big.fly = undefined;
}

// The square's bubbles on their way, and its large bubble, at the town's second `seconds`; once they all rest, the
// square has nothing more to fly.
export function flies(parts: Parts, square: Square, seconds: number, sudden = false): void {
	for (const life of square.lives) {
		if (!life.fly) continue;
		const { stand, k } = life.self;
		const head = headOf(stand.x, stand.z, k ?? 1);
		const [x, straight, z, s] = flown(life, head, seconds);
		const y = straight + hop((seconds - life.fly.since) / FLY);
		// Where it is now is where it goes from, should its group change meanwhile.
		life.fly.at = [x, y, z, s];
		// What stands over its head (its name, its card: ./note-under.ts) comes down as its bubble leaves, and goes back
		// up with it.
		life.figure.bare = leftOf(s, head[3]);
		life.figure.at[1] = nameOver(life.figure.bare);
		parts.bubbles.set(life.bubble, { x, y, z, ry: parts.turn, s });
		// Back over its head: it is drawn with its figure again.
		if (!life.heap && rests(life, seconds)) life.fly = undefined;
	}
	if (square.big.heap || square.big.fly) swells(parts, square, seconds, sudden);
	if (seconds > (square.flown ?? 0)) square.flown = undefined;
}

// The square's bubbles that rest, turned to the camera's new heading (`parts.turn`, ./heaps.ts#facing): those on
// their way are turned as they fly.
export function faces(parts: Parts, square: Square, seconds: number): void {
	for (const life of square.lives) {
		if (!life.shown || life.agent.state !== 2 || life.fly) continue;
		const { stand, k } = life.self;
		const [x, y, z, s] = headOf(stand.x, stand.z, k ?? 1);
		// Set, not moved: a part that does not show is not moved (./parts.ts#Part), and a camera turned in the far view,
		// where the people do not show, would leave the bubbles turned to its former heading once they show again.
		parts.bubbles.set(life.bubble, { x, y, z, ry: parts.turn, s });
	}
	if (square.flown === undefined && square.big.heap) swells(parts, square, seconds, false);
}
