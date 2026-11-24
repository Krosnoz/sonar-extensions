// Where the camera may look, as a zoomable map bounds it: d3-zoom's `translateExtent` (its `defaultConstrain` keeps the
// viewport inside the extent, and centres it on an axis where the viewport is larger) and MapLibre's `maxBounds` (the
// viewport, not its centre, stays inside the bounds). The town's extent is its island, a convex polygon: past the level
// where the island can cover the screen, the visible rectangle stays on it, but for a margin of about 15 % on each side.
// Keeping only the middle of the screen on the island left a screen two thirds empty near a corner (12/11).
type Point = [number, number];

// The share of the screen's width and height that must lie over the island: 15 % of background at most on each side.
const KEEP = 0.7;
// The share of the kept rectangle the island's outline holds at the whole town's level; all of it from the level `from`
// where the island covers the kept screen. Held from nothing at half of `from`, a notch of ×1.9 brought all of it at once,
// and moved a phone's town by 47 px more than the notch before (13/11); 0.15 and 0.4 left jumps of 47 and 94 px.
const HELD = 0.25;

// The part of a convex polygon where n · p ≤ limit (Sutherland–Hodgman, one edge).
function clip(polygon: Point[], n: Point, limit: number): Point[] {
	const out: Point[] = [];
	const side = (p: Point): number => n[0] * p[0] + n[1] * p[1] - limit;
	for (let index = 0; index < polygon.length; index++) {
		const [a, b] = [polygon[index]!, polygon[(index + 1) % polygon.length]!];
		const [sa, sb] = [side(a), side(b)];
		if (sa <= 0) out.push(a);
		if (sa * sb < 0) {
			const t = sa / (sa - sb);
			out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
		}
	}
	return out;
}

// Where the middle of a rectangle of half sizes `half` may be so that the rectangle lies in `outline` (convex,
// counter-clockwise): each edge moves inwards by the rectangle's reach across it. Empty when the rectangle does not fit.
function eroded(outline: Point[], half: Point): Point[] {
	let out = outline;
	for (let index = 0; index < outline.length && out.length; index++) {
		const [a, b] = [outline[index]!, outline[(index + 1) % outline.length]!];
		const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
		if (length === 0) continue;
		// Outwards: the inside of a counter-clockwise polygon is on each edge's left.
		const n: Point = [(b[1] - a[1]) / length, -(b[0] - a[0]) / length];
		out = clip(out, n, n[0] * a[0] + n[1] * a[1] - Math.abs(n[0]) * half[0] - Math.abs(n[1]) * half[1]);
	}
	return out;
}

// The point of a convex polygon (counter-clockwise, maybe flat) nearest to `at`: `at` itself when inside.
function into(polygon: Point[], at: Point): Point {
	let [best, far, inside] = [at, Infinity, true];
	for (let index = 0; index < polygon.length; index++) {
		const [a, b] = [polygon[index]!, polygon[(index + 1) % polygon.length]!];
		const [ex, ey] = [b[0] - a[0], b[1] - a[1]];
		if (ex * (at[1] - a[1]) - ey * (at[0] - a[0]) >= 0) continue;
		inside = false;
		const t = Math.min(1, Math.max(0, ((at[0] - a[0]) * ex + (at[1] - a[1]) * ey) / (ex * ex + ey * ey || 1)));
		const near: Point = [a[0] + ex * t, a[1] + ey * t];
		const gap = Math.hypot(near[0] - at[0], near[1] - at[1]);
		if (gap < far) [best, far] = [near, gap];
	}
	return inside ? at : best;
}

// Whether a point lies on a convex polygon (counter-clockwise): the island's ground holds every place an inhabitant stands.
export const onIsland = (outline: Point[], at: Point): boolean => outline.length >= 3 && into(outline, at) === at;

// The largest share λ ≤ 1 of the kept rectangle at level 1 (`half`) that fits in the island: the island covers the kept
// screen from the level 1 / λ. Kept for the last outline and screen: it is asked at every frame of a turn.
let last: { outline: Point[]; half: Point; fit: number } | null = null;
function fitOf(outline: Point[], half: Point): number {
	if (last && last.outline === outline && last.half[0] === half[0] && last.half[1] === half[1]) return last.fit;
	let [low, high] = [0, 1];
	if (eroded(outline, half).length < 3)
		// To 1 / 65 536 of the level: far under a pixel.
		for (let step = 0; step < 16; step++) {
			const mid = (low + high) / 2;
			if (eroded(outline, [half[0] * mid, half[1] * mid]).length >= 3) low = mid;
			else high = mid;
		}
	else low = 1;
	last = { outline, half, fit: low };
	return low;
}

// The level from which the island covers the screen but its margins: the bound is then the visible rectangle's.
export function coverFrom(outline: Point[], screen: Point, unit: number): number {
	return 1 / fitOf(outline, [(KEEP * screen[0] * unit) / 2, (KEEP * screen[1] * unit) / 2]);
}

// d3-zoom's `defaultConstrain` on one axis: the screen's middle `at` held so the screen of half size `half` stays over
// the extent `low` to `high`, and on `middle` where the screen is wider.
function constrain(at: number, low: number, high: number, half: number, middle: number): number {
	return high - low <= 2 * half ? middle : Math.min(high - half, Math.max(low + half, at));
}

// The aim nearest to `aim` where the camera may look at the level `scale`. `screen`: the framed band's width and height
// (CSS px); `unit`: the world's units per CSS px at level 1. Two holds, both continuous in the level, so no notch jumps:
// - on each axis, the screen stays over the island's extent, and centred where the island is shorter (d3-zoom). On the
//   whole town's middle `whole` at level 1, as it is framed with its roofs; towards the ground's middle as the zoom
//   grows, so the ground keeps the balance it had on the screen;
// - the kept rectangle (the screen less its margins) lies on the island from the level `from` = coverFrom(…). Below,
//   the share HELD of it lies there at the whole town's level, and more at each notch up to all of it at `from`. It
//   shrank as the square of the level before: a phone's town stayed a quarter off-centre, then jumped 70 px at the third
//   notch (13/11).
export function bound(outline: Point[], whole: Point, aim: Point, scale: number, screen: Point, unit: number): Point {
	if (outline.length < 3) return whole;
	const half: Point = [(KEEP * screen[0] * unit) / 2, (KEEP * screen[1] * unit) / 2];
	const fit = fitOf(outline, half);
	const from = 1 / fit;
	const on = (axis: 0 | 1): number => {
		const [low, high] = [Math.min(...outline.map((each) => each[axis])), Math.max(...outline.map((each) => each[axis]))];
		const [mid, seen] = [(low + high) / 2, (screen[axis] * unit) / (2 * scale)];
		// Shorter than the screen, the island keeps on the screen the offset it had at the whole town's level (its middle
		// drawn towards it as the level grows), as far as it stays whole there: it reaches the island's middle when it
		// fills the screen, continuously. An extent made symmetric about that middle was longer than the island, and cut it
		// by up to 221 px while it was shorter than the screen (13/11).
		const room = Math.max(0, seen - (high - low) / 2);
		const middle = mid + Math.min(room, Math.max(-room, (whole[axis] - mid) / scale));
		return constrain(aim[axis], low, high, seen, middle);
	};
	const held: Point = [on(0), on(1)];
	// The share of the screen's kept rectangle held on the island: HELD at the whole town's level, all of it from `from`,
	// in between multiplied by the same factor at each step of the level's log, so a notch adds to it but a bounded part.
	// Just under it: at `from` exactly, the largest rectangle that fits leaves no room, and the bound held nothing.
	const grown = from > 1 ? HELD ** Math.max(0, 1 - Math.log(scale) / Math.log(from)) : 1;
	const share = (0.999 * grown) / scale;
	const allowed = eroded(outline, [half[0] * share, half[1] * share]);
	return allowed.length ? into(allowed, held) : held;
}
