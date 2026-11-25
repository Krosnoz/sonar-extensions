// Where a subject's sign stands over the town, and its line to its roof (./signs.ts): the screen's geometry, in pixels.

// The room kept around a sign, in pixels.
export const GAP = 10;
// How far above its roof a sign on it stands: the line between them says which roof it names, as a sign beside it does.
export const STEM = 6;
// The longest line from a sign to its roof, in sign heights: a farther roof is named by the sign's own place instead.
const LEAD_MAX = 1.5;
// Where a sign may stand, by preference, as [column, row] in its own widths and heights: on its roof, then above it, then
// beside it (left, right, one more out), then higher still. Never across its roof's point: there it covered the roof and
// its chimney, its line rising to the anchor above it. A sign off its roof is joined to it by a line.
// Before those, the sign slid along its own width, its roof still under it, the line rising from near one of its ends: a
// long name blocked by a neighbour on one side slid to the other. Beside its roof, a whole width away, a sign longer
// than its line is detached, so a long name found no place but cut ("Old applicati…" with room on its right).
// Past half its width the roof leaves the sign's span, its line rising from the sign's end: up to a whole width, as far as
// its line stays short (`attached`, below). A long name still cut at 0.45 had room a little farther ("Public API and
// inte…" by the screen's edge, room on its left).
const SIDES = [-1, 1, -2, 2];
const SLIDES = [0.25, -0.25, 0.45, -0.45, 0.6, -0.6, 0.75, -0.75, 0.9, -0.9];
export const SPOTS: [number, number][] = [
	[0, 0],
	[0, -1],
	...[0, -1].flatMap((row) => SLIDES.map((column): [number, number] => [column, row])),
	...[0, -1].flatMap((row) => SIDES.map((column): [number, number] => [column, row])),
	...[-2, -3].flatMap((row) => [0, ...SIDES].map((column): [number, number] => [column, row])),
	// Last, when every place above is blocked (the top bar, near, on a phone): under its anchor, on the facade, a stem
	// below it (./signs.ts), never straddling it. Near, a building filled the top of a phone without its sign.
	...[0, ...SLIDES].map((column): [number, number] => [column, 1]),
];
// The spots in the order a sign tries them, its slides and sides toward the screen's middle first (`toward`: 1 rightward,
// -1 leftward): a sign by an edge, pushed in by it, found its other side only after the first.
const ordered = (toward: number): number[] =>
	SPOTS.map(([column, row], at) => {
		const pair = SPOTS.findIndex(([c, r]) => c === -column && r === row);
		const first = Math.min(at, pair);
		return column !== 0 && Math.abs(pair - at) === 1 && Math.sign(SPOTS[first]![0]) !== toward ? pair : at;
	});
export const ORDER = { [1]: ordered(1), [-1]: ordered(-1) } as Record<number, number[]>;
// The room kept around a lamp's head a sign must not cover, in pixels.
const POINT = 4;
export const around = ([px, py]: [number, number]): number[] => [px - POINT, py - POINT, px + POINT, py + POINT];
// Another subject's anchor, as it shows (.world-dot: 5 px, its margin of -3.5 px puts it a pixel up and left of its point):
// a sign keeps off the dot itself, no farther. Four pixels of room round it refused a long name every place near a crowded
// roof, and it was cut with room beside it.
export const dotOf = ([px, py]: [number, number]): number[] => [px - 3.5, py - 3.5, px + 1.5, py + 1.5];
// Whether a lamp's head is drawn: its post is 0.06 wide and goes, its head with it, under 1.5 pixels of the drawing
// (../render/parts.ts#parts). `unit`: a length of 1 in the town, in CSS pixels; `step`: a pixel of the drawing, in CSS pixels.
export const headsDrawn = (unit: number, step: number): boolean => 0.06 * unit >= 1.5 * step;

// Whether a sign is joined to its roof by a line: on its roof (`stem` above it) as beside it, so that every sign says which
// roof it names. The line is longer than a dot, not longer than LEAD_MAX heights of the sign (`height`, without its room)
// past the stem, and the roof is on the screen: a line to a roof out of frame would cross the town. The stem is longer
// over a roof with a hut or a tank taller than the sign would stand (./signs.ts).
export const joins = (length: number, height: number, anchorOn: boolean, stem = STEM): boolean => length > 3 && length <= LEAD_MAX * height + stem && anchorOn;
// The point of a sign's own box (the box [cx ± (w - GAP) / 2] × [top + GAP, top + h], without its room) nearest to the
// roof at (x, y), and the distance to it: a line starts on the sign's edge, never in the room around it, or it shows as a
// dash apart from its sign.
export const leadFrom = (x: number, y: number, cx: number, w: number, top: number, h: number): [number, number, number] => {
	const half = (w - GAP) / 2;
	const [nx, ny] = [Math.min(Math.max(x, cx - half), cx + half), Math.min(Math.max(y, top + GAP), top + h)];
	return [nx, ny, Math.hypot(x - nx, y - ny)];
};
// Whether a sign off its roof stays near it: its edge is within LEAD_MAX heights of the roof, so that its line is drawn.
// Farther, it would name another house, or none, and a long name pushed beside its roof went to the screen's edge: a sign
// that cannot stay near its roof is hidden, never left far from it.
export const stays = (x: number, y: number, cx: number, w: number, top: number, h: number, stem = STEM): boolean =>
	leadFrom(x, y, cx, w, top, h)[2] <= LEAD_MAX * (h - GAP) + stem;
// Whether a sign is still joined to ITS roof: on it (the roof under the sign's bottom edge, a stem below, which a sign pushed
// into the screen by `keep` loses when the roof is out of frame), or beside it with the roof on the screen and near enough for
// its line. Out of those it is hidden: a sign pushed to the screen's edge, far from its roof, would name another house.
export const attached = (spot: number, roofOn: boolean, x: number, y: number, cx: number, w: number, top: number, h: number, stem = STEM): boolean =>
	spot === 0 ? leadFrom(x, y, cx, w, top, h)[2] <= stem + 3 : roofOn && stays(x, y, cx, w, top, h, stem);
// A sign's own box on the screen, without its room: the room is above it (its bottom edge is the spot's bottom).
export const pinOf = (cx: number, w: number, top: number, h: number): number[] => [cx - (w - GAP) / 2, top + GAP, cx + (w - GAP) / 2, top + h];
// Where a sign's line starts: on the sign's middle line, a half height in from its ends, under the sign. The sign covers the
// line's start, so the line shows from the sign's own edge whatever its shape: a pill, a diamond, a bubble with a tail. From
// the corner of its box, it stood apart from a diamond.
export const leadStart = (x: number, cx: number, w: number, top: number, h: number): [number, number] => {
	const [half, radius] = [(w - GAP) / 2, (h - GAP) / 2];
	const inset = Math.min(radius, half);
	return [Math.min(Math.max(x, cx - half + inset), cx + half - inset), top + GAP + radius];
};
// The box a figure takes on the screen, from its feet to its head: a sign keeps clear of it, as it would cover the person it
// stands over. A person is about 0.45 as wide as tall.
export const bodyBox = (x: number, feet: number, head: number): [number, number, number, number] => {
	const half = Math.max(2, (feet - head) * 0.22);
	return [x - half, head, x + half, feet];
};
// Whether a box [left, top, right, bottom] is clear of the boxes already taken.
export const fits = (taken: number[][], x: number, y: number, w: number, h: number): boolean =>
	!taken.some(([a, b, c, d]) => x < c! && x + w > a! && y < d! && y + h > b!);
// Whether a box is clear of others, squeezed by `slack` on each side (a negative slack asks for room to spare).
// `skip`: the box of its own figure, which a name stands above.
export const clear = (boxes: number[][], x: number, y: number, w: number, h: number, slack: number, skip = -1): boolean =>
	!boxes.some(([a, b, c, d], at) => at !== skip && x + slack < c! && x + w - slack > a! && y + slack < d! && y + h - slack > b!);
