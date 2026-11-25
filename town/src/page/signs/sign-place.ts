// Where each subject's sign stands at a frame (./signs.ts): a spot beside its roof, in the richest form that fits, off
// the other signs, the figures, the names and the page's controls; then its line and its anchor on the roof.
import { crosses, through } from "./crossing";
import { GAP, ORDER, STEM, SPOTS, around, attached, clear, dotOf, joins, leadFrom, leadStart, pinOf } from "./sign-geometry";
import type { bodyGrid } from "./sign-bodies";
import { applyLook, looksFor } from "./sign-looks";
import { fadeIn, follow, formOf, lift } from "./sign-motion";
import type { signOf } from "./sign-nodes";
import type { Sizes } from "./sign-sizes";

// How far a sign or a name already shown may be squeezed and keep its place, in pixels: a new place must be free and
// SLACK inside the screen, one held stays while it is free with SLACK of overlap on its room. A place on the edge of free
// changed at every frame of a turn. The room around a sign (GAP) keeps two signs 6 px apart even then.
export const SLACK = 2;
// How long a sign's own place must stay free before it goes back to it: a place that frees and fills at every frame would
// make it jump.
const RETURN_AFTER = 300;

export type Mark = ReturnType<typeof signOf>;
type Form = [number, number, string];
// What a frame reads to place the signs, and what it changes as each is placed: `taken` the boxes placed (signs, then
// names), `room` what is left of the share a phone's signs and names may cover, `pins` the signs placed (their own
// boxes, without their room) and `leads` their lines: a new line crosses neither, a new sign covers no line.
// `roofs`: each roof's point on the screen; `crowns`: what stands higher on each roof; `lamps`: the lamps' heads;
// `spared`: the names a sign keeps off; `anchored`: the point of each roof its anchor stands on.
export type SignFrame = {
	level: number;
	now: number;
	width: number;
	tall: number;
	bar: number;
	margin: number;
	fresh: number;
	phone: boolean;
	step: number;
	marks: Mark[];
	sizes: Sizes["sizes"];
	floating: number[][];
	taken: number[][];
	room: number;
	bodies: ReturnType<typeof bodyGrid>;
	pins: number[][];
	leads: [number, number, number, number][];
	roofs: [number, number][];
	crowns: [number, number][][];
	lamps: [number, number][];
	spared: number[][];
	anchored: number[];
};
// One sign being placed: `x` and `roof` its roof's point (`roof` where the spots are counted from: a stem above it),
// `points` the other roofs' and the lamps' heads, `crown` what stands on its roof, `roofOn` whether its anchor is whole
// on the screen. `spare`: the names it keeps off.
type Placing = { each: Mark; x: number; roof: number; points: number[][]; crown: [number, number][]; roofOn: boolean; spare: number[][] };

// A sign's own box (without its room) whole on the screen, under the top bar, `edge` pixels in from it.
const inside = ({ width, tall, bar }: SignFrame, cx: number, w: number, top: number, h: number, edge: number): boolean =>
	cx - (w - GAP) / 2 >= edge && cx + (w - GAP) / 2 <= width - edge && top + GAP >= bar + edge && top + h <= tall - edge;

// Where the spots are counted from, for a sign `w` wide at `cx`: a stem above its roof, or above what stands on it
// (a hut, a tank) that would reach into the sign. A sign over its roof never hides its water tank. With it, what it is
// read from: the stem (-1) or a point of the crown.
const baseAt = ({ crown, roof }: Placing, cx: number, w: number): [number, number] =>
	crown.reduce<[number, number]>((base, [px, py], at) => (Math.abs(px - cx) < (w - GAP) / 2 && py - 2 < base[0] ? [py - 2, at] : base), [roof - STEM, -1]);

// Where a sign `w` × `h` at `cx` stands for a spot's row, and the stem between its roof and it: above, from
// `baseAt`; under its anchor (on the front wall, a row below), its own box a stem under the anchor. Last, what its
// height is read from (-2 under its anchor).
function placed(s: Placing, cx: number, w: number, h: number, row: number): [number, number, number] {
	if (row > 0) return [s.roof + STEM - GAP, STEM, -2];
	const [y, under] = baseAt(s, cx, w);
	return [y + row * h - h, s.roof - y, under];
}

// A sign the screen shows a part of comes whole into it, the margin in from the edge and SLACK more, which a new place
// needs (`inside`): cut at the edge, a name does not read.
function keep({ width, margin }: SignFrame, cx: number, w: number): number {
	const half = (w - GAP) / 2 + margin + SLACK;
	return cx > -w / 2 && cx < width + w / 2 ? Math.min(Math.max(cx, half), width - half) : cx;
}

// Whether `spot` is open for a size and a form. `crowded`: over the figures too.
function open(f: SignFrame, s: Placing, [w, h, look]: Form, crowded: boolean, spot: number): boolean {
	const { state } = s.each;
	const [column, row] = SPOTS[spot]!;
	const cx = keep(f, s.x + column * w, w);
	const [top, stem] = placed(s, cx, w, h, row);
	// The place and form it shows in keep it with SLACK to spare; another must be free with SLACK more while the
	// camera moves (`fresh`).
	const slack = state.shown && spot === state.place && formOf(f.level, look) === state.look ? SLACK : f.fresh;
	if (
		!s.roofOn ||
		!inside(f, cx, w, top, h, f.margin + Math.max(0, -slack)) ||
		!clear(f.taken, cx - w / 2, top, w, h, slack) ||
		!(
			crowded ||
			(f.bodies.clear(cx - w / 2, top, w, h, slack) && clear(s.spare, cx - w / 2, top, w, h, slack) && clear(s.points, cx - w / 2, top, w, h, slack))
		) ||
		!attached(spot, s.roofOn, s.x, s.roof, cx, w, top, h, stem)
	)
		return false;
	// Its line, from its edge to its roof, passes under no other sign and no control, and crosses no other line;
	// its own box covers no other line.
	const [nx, ny] = leadFrom(s.x, s.roof, cx, w, top, h);
	const line = [nx, ny, s.x, s.roof] as const;
	const pin = pinOf(cx, w, top, h);
	return ![...f.pins, ...f.floating].some((other) => through(line, other)) && !f.leads.some((other) => crosses(line, other) || through(other, pin));
}

// Tries the spots for a size and a form, the one held first: returns the spot taken, or -1. `crowded`: over the figures too.
function find(f: SignFrame, s: Placing, form: Form, crowded = false): number {
	const { state } = s.each;
	const [w, h] = form;
	const free = (spot: number): boolean => open(f, s, form, crowded, spot);
	// Back to its own place only once that has stayed free long enough.
	if (state.spot !== 0) {
		if (!free(0)) state.since = 0;
		else if (state.since === 0) state.since = f.now;
		else if (f.now - state.since >= RETURN_AFTER) state.spot = 0;
	}
	const spot = crowded ? (free(0) ? 0 : -1) : ([state.spot, ...ORDER[s.x < f.width / 2 ? 1 : -1]!].find(free) ?? -1);
	if (spot < 0) return -1;
	const [column, row] = SPOTS[spot]!;
	const left = keep(f, s.x + column * w, w) - w / 2;
	const [top] = placed(s, left + w / 2, w, h, row);
	f.taken.push([left, top, left + w, top + h]);
	return spot;
}

// The forms it may take, largest first (looksFor); a cut that changes nothing (a short name) is not tried again.
function formsOf(f: SignFrame, each: Mark): Form[] {
	const at = f.marks.indexOf(each);
	return looksFor(f.level, f.phone, each.kind !== null)
		.map((look): Form => [f.sizes.get(look)![at]![0], f.sizes.get(look)![at]![1], look])
		.filter((form, index, all) => index === 0 || form[0] !== all[index - 1]![0] || form[1] !== all[index - 1]![1]);
}

// Its spot and its form. The names it keeps off: all of them first, none for a sign that finds no place off them, which
// then goes over one rather than vanish.
function chosen(f: SignFrame, s: Placing, forms: Form[]): { spot: number; form: Form } {
	const wanted = f.level > 0 || s.each.kind !== null;
	let [spot, form] = [-1, forms[0]!];
	for (const spare of f.spared.length > 0 ? [f.spared, []] : [f.spared]) {
		s.spare = spare;
		for (const candidate of wanted ? forms : []) {
			const area = (candidate[0] - GAP) * (candidate[1] - GAP);
			// Past the phone's share, only the smallest form still shows: a subject whose building is on the screen keeps
			// at least its pictogram while a place is free.
			if (area > f.room && candidate !== forms.at(-1)) continue;
			spot = find(f, s, candidate);
			// Nothing is free, even for its pictogram: a sign that waits stays on its roof, over the figures there, rather
			// than vanish; never over another sign.
			if (spot < 0 && s.each.urgent && candidate === forms.at(-1)) spot = find(f, s, candidate, true);
			if (spot < 0) continue;
			[form, f.room] = [candidate, f.room - area];
			break;
		}
		if (spot >= 0) break;
	}
	return { spot, form };
}

// Shown, the sign glides to its place: its height over its roof glides where what it is read from changes, and follows
// the roof otherwise.
function moved(f: SignFrame, s: Placing, anew: boolean, [cx, top, h, under]: [number, number, number, number], look: string): void {
	const { state, node } = s.each;
	const height = s.roof - top - h;
	state.slip = anew ? 0 : lift(under === state.under ? state.slip : state.height - height, 0);
	[state.height, state.under] = [height + state.slip, under];
	state.at = [follow(state.at[0], cx, devicePixelRatio, f.step), follow(state.at[1], top + h - state.slip, devicePixelRatio, f.step)];
	node.style.transform = `translate3d(${state.at[0]}px, ${state.at[1]}px, 0)`;
	applyLook(node, look);
}

// The line, from under the sign to its roof: its length past the sign's edge is what `joins` reads.
function leadTo(f: SignFrame, s: Placing, spot: number, [cx, w, top, h, stem]: [number, number, number, number, number]): void {
	const { each, x, roof } = s;
	const { state } = each;
	const [nx, ny, length] = leadFrom(x, roof, cx, w, top, h);
	const joined = spot >= 0 && joins(length, h - GAP, s.roofOn, stem);
	each.lead.classList.toggle("world-off", !joined);
	each.dot.classList.toggle("world-off", !joined);
	if (spot >= 0) f.pins.push(pinOf(cx, w, top, h));
	if (!joined) return;
	f.leads.push([nx, ny, x, roof]);
	// From where the sign shows, held still (../camera/steady.ts): from its computed place, the line left its edge by up to
	// the pixel and a half the sign is held within.
	const [sx, sy] = leadStart(x, state.at[0] ?? cx, w, (state.at[1] ?? top + h) - h, h);
	each.dot.style.transform = `translate(${x.toFixed(1)}px, ${roof.toFixed(1)}px)`;
	each.lead.style.transform = `translate(${sx.toFixed(1)}px, ${sy.toFixed(1)}px) rotate(${Math.atan2(roof - sy, x - sx)}rad) scaleX(${Math.hypot(x - sx, roof - sy).toFixed(1)})`;
}

// The sign at its spot and in its form, or hidden; then its line and its anchor.
function shown(f: SignFrame, s: Placing, spot: number, [w, h, look]: Form): void {
	const { each, x } = s;
	const { state } = each;
	const on = spot >= 0;
	const [anchor, kept] = [f.anchored[each.index]!, formOf(f.level, look)];
	// A new place, form or point of its roof starts from its own place, faded in, its line and its anchor with it.
	const anew = on && (!state.shown || spot !== state.place || kept !== state.look || anchor !== state.anchor);
	if (anew) {
		state.at = [null, null];
		for (const node of [each.node, each.lead, each.dot]) fadeIn(node);
	}
	if (on && spot !== state.spot) [state.spot, state.since] = [spot, 0];
	if (on) [state.place, state.look, state.anchor] = [spot, kept, anchor];
	state.shown = on;
	const [column, row] = SPOTS[Math.max(spot, 0)]!;
	const cx = keep(f, x + column * w, w);
	const [top, stem, under] = placed(s, cx, w, h, row);
	// Hidden, it fades out where it stood.
	if (on) moved(f, s, anew, [cx, top, h, under], look);
	each.node.classList.toggle("world-off", !on);
	leadTo(f, s, spot, [cx, w, top, h, stem]);
}

// Places one sign, the most urgent first: another goes beside its roof, then up, then under its anchor. One that finds
// no room gives up its counts, then all but its pictogram.
export function placeSign(f: SignFrame, each: Mark): void {
	const [x, roof] = f.roofs[each.index]!;
	const points = [...f.roofs.filter((_, at) => at !== each.index).map(dotOf), ...f.lamps.map(around)];
	const crown = f.crowns[each.index]!;
	// Its anchor whole on the screen, the design system's margin in from its edges and under the top bar: at the edge
	// it was cut, its sign with it. Out of that, the sign hides.
	const roofOn = x >= f.margin && x <= f.width - f.margin && roof >= f.bar + f.margin && roof <= f.tall - f.margin;
	const s: Placing = { each, x, roof, points, crown, roofOn, spare: f.spared };
	const { spot, form } = chosen(f, s, formsOf(f, each));
	shown(f, s, spot, form);
}
