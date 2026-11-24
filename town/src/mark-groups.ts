// The marks seen from afar: the inhabitants gathered into groups, so that a full square shows one mark with its
// count and its share of each state, and a group comes apart as the camera nears.
// Groups are made in the town, never on the screen, as Supercluster makes its clusters per zoom level
// (github.com/mapbox/supercluster): a square's figures fall into the cells of a grid over the square, 2^k a side, and k
// changes only with the zoom, past a margin. Turning or sliding the camera never changes a group; it only moves where
// it shows. The previous marks were grouped by their place on the screen, again at every frame: they jumped in a turn.
import type { Figure } from "./kit";
import { T } from "./shapes";

export type Group = {
	id: number;
	// Indices of the figures, in `figures`.
	members: number[];
};

// How far past a threshold the zoom goes before the grid changes, in powers of two: a zoom that stops on one would
// make the groups come apart and back at every frame.
const MARGIN = 0.2;
// The finest grid: a square split in 2^5 a side holds one figure per cell.
const FINEST = 5;

// `figures`: the inhabitants. `group(pixelsPerMetre, room)` returns the groups for a camera where a metre on the ground
// is `pixelsPerMetre` CSS pixels at most, a group's cell being at least `room` pixels a side.
export function grouping(figures: Figure[]): (pixelsPerMetre: number, room: number) => Group[] {
	// Each square's figures and the box they stand in, read once: the squares do not move. A subject's crowd may stand on
	// several squares of its quarter (./quarters.ts): a group spanning them stood between them, off the screen at times
	// while its people were on it.
	const squares = new Map<string, { members: number[]; x0: number; z0: number; side: number; k: number }>();
	figures.forEach((figure, at) => {
		const key = `${figure.topic}:${Math.round(figure.at[0] / T)}:${Math.round(figure.at[2] / T)}`;
		const square = squares.get(key) ?? { members: [], x0: Infinity, z0: Infinity, side: 0, k: -1 };
		square.members.push(at);
		squares.set(key, square);
	});
	for (const square of squares.values()) {
		const xs = square.members.map((at) => figures[at]!.at[0]);
		const zs = square.members.map((at) => figures[at]!.at[2]);
		[square.x0, square.z0] = [Math.min(...xs), Math.min(...zs)];
		square.side = Math.max(1, Math.max(...xs) - square.x0, Math.max(...zs) - square.z0) * 1.001;
	}
	// Ids stay with a cell: a group seen again keeps its id, and the measures follow it from frame to frame.
	const ids = new Map<string, number>();
	let groups: Group[] = [];
	return (pixelsPerMetre, room) => {
		let changed = groups.length === 0;
		for (const square of squares.values()) {
			const wanted = Math.log2((square.side * pixelsPerMetre) / room);
			if (square.k >= 0 && wanted > square.k - MARGIN && wanted < square.k + 1 + MARGIN) continue;
			const k = Math.max(0, Math.min(FINEST, Math.floor(wanted)));
			if (k !== square.k) [square.k, changed] = [k, true];
		}
		if (!changed) return groups;
		// Each figure into its cell where it stands now: a walker that leaves its cell stays in its group until the grid
		// changes, its group's mark following the mean of its members.
		const cells = new Map<string, number[]>();
		for (const [topic, square] of squares) {
			const cell = square.side / 2 ** square.k;
			for (const at of square.members) {
				const [x, , z] = figures[at]!.at;
				const key = `${topic}:${square.k}:${Math.floor((x - square.x0) / cell)}:${Math.floor((z - square.z0) / cell)}`;
				const list = cells.get(key);
				if (list) list.push(at);
				else cells.set(key, [at]);
			}
		}
		groups = [...cells].map(([key, members]) => {
			if (!ids.has(key)) ids.set(key, ids.size);
			return { id: ids.get(key)!, members };
		});
		return groups;
	};
}
