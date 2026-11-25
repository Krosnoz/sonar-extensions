// The town's size follows the project's number of agents. A few agents make a hamlet, a few dozen a
// village, a few hundred a town with a few towers. Past MOST buildings, the town grows no denser: it spreads in squares
// and parks, where the agents are still seen walking, and the page stays smooth at 10 000.
import type { Spec } from "../buildings/facades-kit";

// The most decor buildings drawn: about what the page draws today at 60 images a second.
const MOST = 300;
// About how many buildings a built block holds: two rows along its streets.
export const PER_BLOCK = 6;

export type Growth = {
	// How many decor buildings, at most MOST.
	houses: number;
	// 0 hamlet, 1 village, 2 town, 3 city, 4 metropolis.
	tier: number;
	// How many open blocks (squares, parks) for each built one: a town breathes, a metropolis spreads.
	open: number;
};

export function growthOf(agents: number): Growth {
	// About one building for each agent: the town reads as streets and squares around the subjects, not as a wall of
	// roofs where the people cannot be seen.
	const wanted = Math.max(3, Math.round(agents * 0.9));
	const tier = agents < 5 ? 0 : agents < 30 ? 1 : agents < 200 ? 2 : agents < 2000 ? 3 : 4;
	// From a village on, a block of squares for every two or three built ones, and more for each tenfold past MOST: the
	// town spreads instead of rising.
	const open = tier < 1 ? 0 : 0.3 + 0.3 * Math.max(0, Math.log10(wanted / MOST));
	return { houses: Math.min(MOST, wanted), tier, open };
}

export type Zone = { kind: Spec["kind"]; front: [number, number]; back: [number, number] };

// What a built block holds, from its rank among the built blocks: 0 the core (tallest), 1 the outskirts (lowest). Towers
// stay rare and stand in a few clusters: the town never becomes a wall that hides its people.
export function zoneOf({ tier }: Growth, rank: number, low: boolean, r: () => number): Zone {
	const core = rank < 0.3;
	if (tier >= 3 && core && !low && r() < 0.4) return { kind: "tower", front: [5, 8], back: [7, 11] };
	if (tier >= 2 && rank < 0.6) return { kind: "mid", front: [3, 5], back: [4, low ? 6 : 7] };
	if (tier >= 1 && core) return { kind: "mid", front: [2, 4], back: [3, 5] };
	return { kind: "row", front: [1, 3], back: [2, 3] };
}
