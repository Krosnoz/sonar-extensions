// Where a figure's name stands over the town (./signs.ts): the screen's geometry, in pixels.

// The room kept around a figure's name, and how far above its head the name stands.
// The name's bottom edge stands NAME_LIFT + NAME_GAP = 6 px above the head. A sign keeps no room under it: a name under a
// sign is NAME_GAP from it, 4 px at least.
export const NAME_GAP = 4;
export const NAME_LIFT = 2;

// The most names shown in a zone of the screen (NAME_ZONE px wide and tall): a crowd of a thousand agents would stack its
// names over itself and the fountain.
export const NAMES_PER_ZONE = 2;
const NAME_ZONE = 120;
export const nameZone = (x: number, y: number): string => `${Math.floor(x / NAME_ZONE)}:${Math.floor(y / NAME_ZONE)}`;
// A figure's turn for a name: waiting for the user (state 2), to review (3), at work (1), then the others.
export const nameRank = (state: number): number => [3, 2, 0, 1][state] ?? 3;
// The box [left, top, right, bottom] a figure's name keeps, above the figure's head at (x, y), for a name of `w` × `h` (its
// size with the room around it).
export const nameBox = (x: number, y: number, w: number, h: number): [number, number, number, number] => [
	x - w / 2,
	y - NAME_LIFT - h,
	x + w / 2,
	y - NAME_LIFT,
];
// Each figure's name, whole then cut (.world-cut), with its room: only the whole one when cutting it saves nothing.
// All the names take a form, then all are read: a size read after a class changed lays the page out again, and read
// name after name, 10 000 inhabitants laid it out 20 000 times and the page crashed.
export function measureNames(nodes: HTMLElement[]): [number, number][][] {
	// A name not placed yet takes no place in the page (.world-unplaced): it does for the reading, and not after.
	const unplaced = nodes.filter((node) => node.classList.contains("world-unplaced"));
	for (const node of unplaced) node.classList.remove("world-unplaced");
	const read = (cut: boolean): [number, number][] => {
		for (const node of nodes) node.classList.toggle("world-cut", cut);
		return nodes.map((node) => [node.offsetWidth + 2 * NAME_GAP, node.offsetHeight + 2 * NAME_GAP]);
	};
	const [wholes, cuts] = [read(false), read(true)];
	for (const node of nodes) node.classList.remove("world-cut");
	for (const node of unplaced) node.classList.add("world-unplaced");
	return wholes.map((whole, at) => (cuts[at]![0] < whole[0] ? [whole, cuts[at]!] : [whole]));
}
// Whether a name's box (with its room) stands on a screen `width` × `tall` under a top bar at `bar`, its own box `edge`
// pixels in from the edges: the design system's margin, as for the subjects' signs. A name 5 px from the edge read as cut
// by it.
export const nameInside = ([left, above, right, below]: number[], width: number, tall: number, bar: number, edge: number): boolean =>
	left! + NAME_GAP >= edge && right! - NAME_GAP <= width - edge && above! + NAME_GAP >= bar + edge && below! - NAME_GAP <= tall - edge;
