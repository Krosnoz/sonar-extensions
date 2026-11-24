// The page's edge. The page leaves along one edge, which follows the front that builds the town from left to right and
// wanders about it in tongues: its ground, its zones and its cards leave as the edge reaches them, at the same instant.
// ./cover.ts hides the page behind the edge, ./rim.ts lights the edge.

// How deep the tongues of the page's edge go, in pixels: the edge wanders in patches, never as a straight line.
const RAGGED = 230;
// How long a text stays after the background round it, in seconds: longer, it reads as left behind.
export const TEXT = 0.12;
// The earliest a point leaves: the page answers the click.
export const SOONEST = 0.1;
// How far apart the front's times are read, in pixels.
const LATTICE = 16;

// When the page's edge reaches a point of the screen, in the construction's time.
export type Reach = (x: number, y: number) => number;

const hash = (i: number, j: number): number => {
	const s = Math.sin(i * 127.1 + j * 311.7) * 43758.5453;
	return s - Math.floor(s);
};
const smooth = (t: number): number => t * t * (3 - 2 * t);
const layer = (u: number, v: number): number => {
	const [i, j] = [Math.floor(u), Math.floor(v)];
	const [fu, fv] = [smooth(u - i), smooth(v - j)];
	const top = hash(i, j) + (hash(i + 1, j) - hash(i, j)) * fu;
	const bottom = hash(i, j + 1) + (hash(i + 1, j + 1) - hash(i, j + 1)) * fu;
	return top + (bottom - top) * fv;
};
// A smooth noise over the page, 0 to 1: the page's edge and the order of a card's cells wander in patches.
export const patches = (x: number, y: number): number => layer(x / 40, y / 40) * 0.65 + layer(x / 15, y / 15) * 0.35;

// `reach` read on a lattice and smoothed between its points: it is read for every cell of the page, and each reading
// casts a ray into the town.
function latticed(box: DOMRect, reach: Reach): Reach {
	const [cols, rows] = [Math.ceil(box.width / LATTICE) + 1, Math.ceil(box.height / LATTICE) + 1];
	const read = new Float32Array(cols * rows).fill(Number.NaN);
	const at = (i: number, j: number): number => {
		const [ci, cj] = [Math.min(cols - 1, Math.max(0, i)), Math.min(rows - 1, Math.max(0, j))];
		// Read back from the lattice: the same point gives the same time at each reading, to the lattice's precision.
		if (Number.isNaN(read[cj * cols + ci]!)) read[cj * cols + ci] = reach(box.left + ci * LATTICE, box.top + cj * LATTICE);
		return read[cj * cols + ci]!;
	};
	return (x, y) => {
		const [u, v] = [(x - box.left) / LATTICE, (y - box.top) / LATTICE];
		const [i, j] = [Math.floor(u), Math.floor(v)];
		const [top, bottom] = [at(i, j) + (at(i + 1, j) - at(i, j)) * (u - i), at(i, j + 1) + (at(i + 1, j + 1) - at(i, j + 1)) * (u - i)];
		return top + (bottom - top) * (v - j);
	};
}

// When each point of the page over `box` leaves. `reach`: when the front that builds the town comes to a point of the
// screen. The edge goes at the front's pace, and wanders about it in patches.
export function edgeOf(box: DOMRect, reach: Reach): Reach {
	const smoothed = latticed(box, reach);
	const middle = box.top + box.height / 2;
	const pace = Math.max(0, (smoothed(box.right, middle) - smoothed(box.left, middle)) / Math.max(1, box.width));
	const ragged = Math.min(RAGGED, box.width * 0.16) * pace;
	return (x, y) => Math.max(SOONEST, smoothed(x, y) + (patches(x, y) - 0.5) * ragged);
}
