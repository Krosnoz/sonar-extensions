// A subject's crowd spreads over its quarter. A square holds only what it shows at a size one reads: at the block's level
// (the nearest zoom, ../camera/camera.ts), its smallest inhabitant stands 16 px tall at least on a computer of 1440 × 900, the
// size at which the marks seen from afar have faded out (../marks/far-marks.ts). The rest goes to venues of its own near the
// subject's block (./venues.ts, ./layout.ts#cityGrid), which the town grows for them. Its most urgent agents stay on
// the subject's square: those who wait for the user, then those to review, those at work, those at rest.
// Laid on its one square, a crowd of 110 agents stood at 3 % of its size: 3 px at the block's level, and its marks never
// came apart (13/11). Strategy games lay their crowds the same way: a formation's slot is sized for what stands in it,
// by measure, and the troops it cannot hold widen its rows; no soldier shrinks (adamdjellouli.com, "Formation
// Architecture" of Standard of Iron; jbernardic.github.io/CrowdToolkit, "Formations": slots spaced in agent diameters).
import { fits } from "../people/crowd";
import type { Block, Grid } from "./grid";
import { COURTS, SQUARE, VENUE, type Ground } from "../people/grounds";
import type { Agent, Topic } from "../render/kit";

// The smallest scale of a crowd at which its smallest inhabitant stands 16 px tall at the block's level: a metre there
// shows 40.1 px at 1440 × 900 (measured, ./quarters.test.ts), the smallest inhabitant stands 1.01 m at a scale of 1
// (6 % under the usual size, 4 % less at rest), so 16.97 px at 0.95 ** 17, a step of ../people/crowd.ts#crowdOf.
export const LEGIBLE = 0.95 ** 17;
// A subject's own square is laid one step smaller, its smallest inhabitant still 16 px tall (16.1): there a row of
// agents with two robots finds room between the doors and the square's middle. At LEGIBLE, a square kept 2 or 3 such
// agents of a crowd, and each subject of a town of 100 agents sent 2 or 3 alone to a venue at the town's edge (14/11).
const OWN = 0.95 ** 18;
// More than a square ever holds at that scale (about 20 without robots): the search never tries a whole crowd of thousands.
const MOST = 64;
// More than a venue ever holds (./venues.ts): 196 of the tests' crowd, 321 walkers without robots on its lanes
// (../people/crowd.ts#walk), measured.
const VENUE_MOST = 400;
// The fewest agents a subject's crowd sends off its square: one of a crowd of 12 stood alone on a court (14/11).
const COMPANY = 4;
// More than the largest court ever holds (123 without robots, measured).
const COURT_MOST = 130;

// The ground of a crowd of a subject's quarter: the smallest court that holds it at a legible scale, else a venue.
export const venueOf = (agents: Agent[]): Ground =>
	(agents.length <= COURT_MOST ? COURTS.find((court) => fits(agents, court.lamps!, LEGIBLE, court)) : undefined) ?? VENUE;

// The blocks of a subject's squares: its own, then those of its quarter, the nearest first.
export function blocksOf(grid: Grid, index: number): Block[] {
	const own = grid.of(index);
	const far = (block: Block): number => Math.hypot(block.x - own.x, block.z - own.z);
	return [own, ...grid.all.filter((block) => block.quarter === index).toSorted((one, other) => far(one) - far(other))];
}
// The order in which agents keep the subject's own square, by state: 2 waits for the user, 3 to review, 1 at work, 0 rests.
const URGENCY = [3, 2, 0, 1];

// How many of `agents`, in their order, a square holds at `scale`: one at least, so every agent stands.
function held(agents: Agent[], lamps: number[], ground: Ground, scale: number): number {
	let [low, high] = [1, Math.min(agents.length, ground === SQUARE ? MOST : VENUE_MOST)];
	if (fits(agents.slice(0, high), lamps, scale, ground)) return high;
	while (high - low > 1) {
		const middle = (low + high) >> 1;
		if (fits(agents.slice(0, middle), lamps, scale, ground)) low = middle;
		else high = middle;
	}
	return low;
}

// Each subject's squares, its own first, and the agents on each. A crowd its square holds stays as it was, in its order.
// `lamps`: the x of the lamps of a subject's square. The other blocks of its quarter are venues, with a venue's lamps.
export function quartersOf(topics: Topic[], lamps: (index: number) => number[]): Agent[][][] {
	return topics.map(({ agents }, index) => {
		const kept = lamps(index);
		if (agents.length <= MOST && fits(agents, kept, OWN)) return [agents];
		let rest = agents.toSorted((one, other) => URGENCY[one.state]! - URGENCY[other.state]!);
		const squares: Agent[][] = [];
		while (rest.length) {
			const own = !squares.length;
			// The subject's square leaves COMPANY at least to its first court: no agent stands there alone.
			const count = own ? Math.max(1, Math.min(held(rest, kept, SQUARE, OWN), rest.length - COMPANY)) : held(rest, VENUE.lamps ?? kept, VENUE, LEGIBLE);
			squares.push(rest.slice(0, count));
			rest = rest.slice(count);
			// A venue takes the rest in the subject's order, every state mixed: given by urgency, one took only walkers, a
			// ring of 74 round an empty paving, and its crowd stood on more venues (258 of a mixed crowd, measured).
			if (own) rest = agents.filter((agent) => !squares[0]!.includes(agent));
		}
		return squares;
	});
}
