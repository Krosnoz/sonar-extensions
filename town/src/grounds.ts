// The grounds a crowd stands on (./crowd.ts): a subject's square, in front of its building, and the venue of its
// quarter, a whole block paved for its crowd (./venues.ts). Each says where those at work walk round, what none may
// enter, what hides the ground behind it from the camera, and the lamps whose line of sight no one stands in.

// `round`: the walkers' round, its sides and its corners' radius. `kept`: x from, x to, z from, z to of what stands in the
// round. `tall`: the middle's x and z and how far aside of their line of sight what hides the ground behind it reaches.
// `corner`: whether a row stands in the back-left corner, out of the round. `lamps`: the x of the lamps of the front (z 2.1), when the ground sets them.
// `lanes`: whether those at work walk more rounds inside the first one when it is full or the ground would be bare
// (./crowd.ts#walk). `paved`: the slabs across and deep of a court's paving; without it, a venue is paved whole.
export type Ground = {
	round: { back: number; front: number; left: number; right: number; bend: number };
	kept: [number, number, number, number][];
	tall: [number, number, number][];
	corner: boolean;
	lamps?: number[];
	lanes?: boolean;
	paved?: [number, number];
};

// The round of those at work on a subject's square: round the middle and the terrace, along the doors' steps (they reach
// z -1.15), inside the square's right corner tree (x 5.15) and in front of the lamps and benches (they start at z 2.22,
// ./squares.ts#furniture). The square's
// back-left corner is left to those who stand: only there the building of the block in front hides none of them from the
// camera. Its corners are rounded: one who turns at once stood across the one behind.
// What stands in the round and none may enter: its middle (x -1.1 to 1.1) and the terrace on the right (./town-blocks.ts#raise).
// A robot at x 2.2 stood under the parasol and in the square's edge, out of sight (./figures-visible.test.ts). What hides
// the ground behind it: the middle and the parasol. A robot behind the kiosk went unseen.
export const SQUARE: Ground = {
	round: { back: -0.82, front: 1.85, left: -2, right: 4.3, bend: 0.9 },
	kept: [
		[-1.1, 1.1, -0.45, 1.65],
		[2.25, 3.9, -0.3, 1.6],
	],
	tall: [
		[0, 0.6, 1.3],
		[3.2, 0.65, 1.3],
	],
	corner: true,
};

// A venue: the whole block from its back (z -5.5) to its kerb (z 2.56), without a building, a garden or a middle. Its
// front lamp stands at its left corner, out of its rows and of its walkers' sight: one at the right corner stood
// between the camera and the round's corner, and hid a walker there (./figures-visible.test.ts). Its round keeps 0.6 from the block's sides: a walker cutting a
// corner stays on the paving. Its walkers file on rounds inside one another, as a parade's columns: on one round, a
// venue of walkers was a ring of 74 round an empty paving (14/11).
export const VENUE: Ground = {
	round: { back: -4.9, front: 1.85, left: -4.7, right: 4.7, bend: 0.9 },
	kept: [],
	tall: [],
	corner: false,
	lamps: [-4.9],
	lanes: true,
};

// A venue's slab, large as an esplanade's, and the z where its paving ends, in front (./venues.ts).
export const [SLAB, PAVED_TO] = [0.94, 2.17];
// A court: a venue paved for a small crowd only, `cols` slabs by `rows` at the block's front, the block's lawn round it.
// Its round keeps half a metre inside its paving. A whole block paved for the 2 or 3 agents a subject's square could
// not hold read as an empty lot: 6 of them in a town of 100 agents (14/11).
const court = (cols: number, rows: number): Ground => {
	const [half, back] = [(cols * SLAB) / 2 - 0.5, PAVED_TO - rows * SLAB + 0.5];
	return { ...VENUE, round: { back, front: 1.85, left: -half, right: half, bend: 0.9 }, paved: [cols, rows] };
};
// From the smallest: they hold about 20, 50 and 100 agents at the size one reads (./quarters.ts#venueOf).
export const COURTS: Ground[] = [court(5, 4), court(7, 5), court(9, 6)];
