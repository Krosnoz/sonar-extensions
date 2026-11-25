// The agents, as the town's inhabitants. An agent is an inhabitant, a subagent a small robot that follows it. An
// inhabitant at work walks round the square with what its tool has it hold (./tools.ts), a crate that glows without
// one; the others stand in rows inside that round: one that waits for the user with a bubble, one to review with a
// mark, one at rest without. From four that wait on a place, their bubbles are one large bubble (./heaps.ts). Where each one goes: ./crowd.ts; how it is drawn: ./bodies.ts; how the town follows the
// fleet while it is open: ./live.ts.
import { played, type Point } from "./births";
import { figuresOf } from "./bodies";
import { lay, people, roomOf, squaresOf, strides, type Glides } from "./crowd-lay";
import type { Grid } from "../plan/grid";
import type { Agent, Figure, Heap, Kit, Topic } from "../render/kit";
import type { Flight } from "./layer-grains";
import { living } from "./live";
import type { Stage, Wanted } from "./live-steps";
import { BD } from "../render/shapes";
import { blocksOf } from "../plan/quarters";
import { BX, BZ } from "../plan/town-blocks";

// `lamps`: the x of the lamps of a subject's square, by its index, which its crowd keeps out of their line of sight.
// `quarters`: the agents of each subject's squares, its own first (../plan/quarters.ts), its others on the blocks of its
// quarter, nearest first; without it, each subject's crowd stands on its own square.
export function inhabitants(
	kit: Kit,
	topics: Topic[],
	grid: Grid,
	lamps: (index: number) => number[] = () => [],
	quarters?: Agent[][][],
): {
	figures: Figure[];
	heaps: Heap[];
	tick: (seconds: number) => void;
	play: (handle: string, child: number | null, born: boolean, at: number, size: number) => Flight | null;
	follow: (wanted: Wanted[], on: Stage, now?: boolean) => void;
	revision: () => number;
} {
	const squares = squaresOf(topics, grid, lamps, quarters);
	const { looks, helpers } = roomOf(squares);
	const parts = figuresOf(kit, looks, helpers, squares.length);
	for (const square of squares) {
		people(parts, square);
		lay(parts, square, 0, null);
	}
	const lives = squares.flatMap((square) => square.lives);
	// Each agent's door is its subject's building's, in the middle of its front.
	const doorOf = (index: number): Point => {
		const { x, z } = blocksOf(grid, index)[0]!;
		return [x + BX, 0.5, z + BZ + BD / 2];
	};
	const glides: Glides = new Map();
	const life = living(parts, squares, topics, glides, doorOf, kit.random);
	return {
		// The spare figures too: one shows once an agent takes it (./bodies.ts#Life).
		figures: lives.map(({ figure }) => figure),
		heaps: squares.map(({ heap }) => heap),
		tick(seconds) {
			life.tick(seconds);
			for (const each of lives) if (each.figure.away && seconds >= (each.named ?? Infinity)) each.figure.away = false;
			strides(parts, squares, seconds, glides, kit.heading?.());
		},
		play(handle, child, born, at, size) {
			const found = lives.find((each) => !each.free && each.agent.handle === handle);
			return played(found, found ? doorOf(found.figure.topic) : [0, 0, 0], child, born, at, size, kit.random);
		},
		follow: life.follow,
		revision: life.revision,
	};
}
