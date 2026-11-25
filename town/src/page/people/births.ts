// A figure is born, or goes, in layers (./layers.ts): its instances are marked, and its matter flies from its parent or
// back to it (./layer-grains.ts), a robot's to its agent, an inhabitant's to its building's door.
import type { Body, Life } from "./bodies";
import { FLY, grainsOf, type Flight, type Stand } from "./layer-grains";
import { CELLS, END } from "./layers";

export type Point = [number, number, number];

// Where a robot's matter comes from and goes back to: its agent's chest.
const chest = ({ x, y, z, s }: Stand): Point => [x, y + 0.33 * s, z];
// How long a birth lasts from the town's second it is asked at: its grains fly, then its layers fill.
export const BIRTH = FLY * 1.2 + END;

// `body` is born, or goes, from the town's second `at`, its matter from `parent` or back to it. `size`: a grain's, in
// metres. Returns its grains' flight.
export function plays(body: Body, parent: () => Point, born: boolean, at: number, size: number, random: () => number): Flight {
	// A birth starts once its first grains have flown: marked at once, they showed already half way.
	const from0 = born ? at + FLY * 1.2 : at;
	for (const [part, index] of body.drawn) part.mark(index, born ? from0 : -from0);
	const [from, to] = [{ ...body.stand }, parent()];
	const grains = grainsOf(body.model, from, body.tint, to, from0, born, random);
	const walked = (): Point => [body.stand.x - from.x, 0, body.stand.z - from.z];
	const led = (): Point => {
		const now = parent();
		return [now[0] - to[0], now[1] - to[1], now[2] - to[2]];
	};
	// A grain is 0.4 of a cell of the figure's lattice wide, and a pixel of the drawing at least.
	const wide = Math.max(size, (body.stand.s * 0.4) / CELLS);
	return { grains, born, parent: to, size: wide, until: from0 + END + FLY * 1.2 + 0.2, moved: () => (born ? [led(), walked()] : [walked(), led()]) };
}

// The figure of an agent (`child` null) or of one of its subagents is born, or goes, from the town's second `at`. Null
// when the town has no such figure.
export function played(
	life: Life | undefined,
	door: Point,
	child: number | null,
	born: boolean,
	at: number,
	size: number,
	random: () => number,
): Flight | null {
	const body = child === null ? life?.self : life?.robots[child];
	if (!life || !body) return null;
	// An agent's name goes with its figure, and comes back once the figure is whole: at once, it stood over an empty
	// place. The signs fade it (../signs/signs.ts).
	if (child === null) [life.figure.away, life.named] = [true, born ? at + BIRTH : Infinity];
	return plays(body, () => (child === null ? door : chest(life.self.stand)), born, at, size, random);
}
