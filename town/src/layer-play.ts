// An instance of a part with `layers` (./parts.ts#How) is born, or goes, in layers (./layers.ts), its matter from a
// point or back to it: a scaffold (./scaffolds.ts), a crane (./crane.ts).
import { FLY, grainsOf, type Stand } from "./layer-grains";
import { END } from "./layers";
import type { Stage } from "./live-steps";
import type { Part } from "./parts";
import type { G } from "./shapes";

type Point = [number, number, number];

const still = (): [Point, Point] => [
	[0, 0, 0],
	[0, 0, 0],
];

// What is born or goes: the instance `index` of `part`, of `model` standing at `stand` (no model: no grains), in the
// colour `tint`, its matter from `parent` or back to it. `dense`: the grains of a lattice's cell.
export type Played = { part: Part; index: number; model: G | null; stand: Stand; tint: string; parent: Point; dense: number };

// Played from the town's second `at`. Returns the second its layers end at.
export function playLayers({ part, index, model, stand, tint, parent, dense }: Played, born: boolean, at: number, on: Stage, random: () => number): number {
	// A birth starts once its first grains have flown (./births.ts#plays).
	const from0 = born ? at + FLY * 1.2 : at;
	part.mark(index, born ? from0 : -from0);
	if (model) {
		const grains = grainsOf(model, stand, tint, parent, from0, born, random, dense);
		on.add({ grains, born, parent, size: on.size(), until: from0 + END + FLY * 1.2 + 0.2, moved: still });
	}
	return from0 + END;
}
