// Each figure's name, placed at each frame over the town (./signs.ts): above the figure's head, hidden when that place
// is taken (a name far from its figure would name another).
// A town of 10 000 agents has 10 000 names. Sorted, projected and toggled at every frame, at every level, they took about
// 10 ms of each frame, though a name shows only at the nearest level: there, the names are placed as before; at the
// others, only those still shown are hidden. A class is written only when it changes: toggled at every frame on every
// name, it took 3 s of a 90 s arrival.
import type { Figure } from "./kit";
import { clear } from "./sign-geometry";
import { NAME_GAP, NAME_LIFT, NAMES_PER_ZONE, nameBox, nameInside, nameRank, nameZone } from "./sign-names";
import { fadeIn } from "./sign-motion";
import { steady } from "./steady";

export type Name = { node: HTMLElement; figure: Figure; shown: boolean; cut: boolean; at: [number | null, number | null] };

// What a frame tells the names: the screen, the room left on it, and whether a figure is seen.
export type NameFrame = {
	level: number;
	project: (at: [number, number, number]) => [number, number];
	// The camera's step and the slack a new place needs (./signs.ts).
	step: number;
	fresh: number;
	slack: number;
	named: [number, number][][];
	width: number;
	tall: number;
	bar: number;
	margin: number;
	taken: number[][];
	room: number;
	bodies: { clear: (x: number, y: number, w: number, h: number, slack: number, skip?: number) => boolean };
	// Whether the camera sees the figure's crowd: a figure of a crowd out of view is off the screen, and is not projected.
	onView: (figure: Figure) => boolean;
	// Whether the figure is seen, given whether its name showed at the last frame.
	seen: (figure: Figure, shown: boolean) => boolean;
};

// A frame's pass over the names: the room left on the screen, and how many names each zone shows.
type Pass = { frame: NameFrame; room: number; crowd: Map<string, number> };

// Whole on the screen, within the phone's share, its figure seen: a name over a wall, its figure behind, named the
// wall. The ray is cast last, for the names that would show. A name shown keeps its place and its form with SLACK,
// and its figure seen a little behind a roof's edge; a name hidden, or a form new to it, waits for room to spare.
// The name is whole where it has room, cut only where it has not. Returns the form that fits (-1: none), its box and
// the room it takes.
function fit(each: Name, at: number, x: number, base: number, zone: string, pass: Pass): { form: number; found: [number[], number] | null } {
	const { fresh, slack: SLACK, named, width, tall, bar, margin, taken, bodies } = pass.frame;
	const placed = (form: number): [number[], number] | null => {
		const box = nameBox(x, base + NAME_LIFT + NAME_GAP, ...named[at]![form]!);
		const [left, above, right, below] = box;
		const slack = each.shown && each.cut === form > 0 ? SLACK : fresh;
		const area = (right - left - 2 * NAME_GAP) * (below - above - 2 * NAME_GAP);
		const free =
			nameInside(box, width, tall, bar, margin + Math.max(0, -slack)) &&
			area <= pass.room &&
			clear(taken, left, above, right - left, below - above, slack) &&
			// Over another figure, it would hide that one's face or its bubble.
			bodies.clear(left, above, right - left, below - above, slack, at);
		return free ? [box, area] : null;
	};
	const forms = (pass.crowd.get(zone) ?? 0) < NAMES_PER_ZONE ? named[at]!.map((_, form) => form) : [];
	const form = forms.find((candidate) => placed(candidate) !== null) ?? -1;
	return { form, found: form >= 0 ? placed(form) : null };
}

// The name shows at its place: it takes its room, and its form and place are written to the page.
function showName(
	each: Name,
	at: number,
	x: number,
	base: number,
	zone: string,
	pass: Pass,
	form: number,
	found: [number[], number],
	everShown: Set<number>,
): void {
	pass.frame.taken.push(found[0]);
	pass.room -= found[1];
	pass.crowd.set(zone, (pass.crowd.get(zone) ?? 0) + 1);
	// Its first showing: from then on it takes its place in the page (.world-unplaced).
	if (!everShown.has(at)) {
		everShown.add(at);
		each.node.classList.toggle("world-unplaced", false);
	}
	if (!each.shown) fadeIn(each.node);
	each.cut = form > 0;
	each.node.classList.toggle("world-cut", each.cut);
	each.at = [x, base];
	each.node.style.transform = `translate3d(${each.at[0]}px, ${each.at[1]}px, 0)`;
}

export function namePlaces(names: Name[]) {
	// The agents that wait for the user first, then those to review, then those at work. The order is read when the town
	// is built, and again (`sort`) when an agent changes while it is open (./live.ts).
	const sorted = (): number[] => names.map((_, at) => at).toSorted((a, b) => nameRank(names[a]!.figure.agent.state) - nameRank(names[b]!.figure.agent.state));
	let order = sorted();
	// The names without .world-off: none as they are made (./signs.ts). Made shown, the 10 000 names of a big town were all
	// hidden at the first frame, each by a transition of its own, and the page froze 2 s.
	const visible = new Set<number>();
	// The names shown once at least: they take their place in the page from then on.
	const everShown = new Set<number>();
	const show = (at: number, shown: boolean): void => {
		if (visible.has(at) === shown) return;
		names[at]!.node.classList.toggle("world-off", !shown);
		if (shown) visible.add(at);
		else visible.delete(at);
	};
	// At most NAMES_PER_ZONE per zone of the screen, in their order: the others show no name until the camera is nearer and
	// the zone holds fewer of them.
	const place = (frame: NameFrame): void => {
		const { level, project, step } = frame;
		if (level < 2) {
			for (const at of Array.from(visible)) {
				names[at]!.shown = false;
				show(at, false);
			}
			return;
		}
		const pass: Pass = { frame, room: frame.room, crowd: new Map<string, number>() };
		for (const at of order) {
			const each = names[at]!;
			// Off the screen: no place for its name, as `placed` below would find.
			if (!frame.onView(each.figure)) {
				each.shown = false;
				show(at, false);
				continue;
			}
			const [rawX, y] = project(each.figure.at);
			// Where it would show (./steady.ts): its room is kept there, so that two names held still keep 4 px apart.
			const [x, base] = [
				steady(each.shown ? each.at[0] : null, rawX, devicePixelRatio, step),
				steady(each.shown ? each.at[1] : null, y - NAME_LIFT - NAME_GAP, devicePixelRatio, step),
			];
			// The zone's count is read before the place is taken: a name hidden by the zone takes no place.
			const zone = nameZone(x, y);
			const { form, found } = fit(each, at, x, base, zone, pass);
			const shown = found !== null && frame.seen(each.figure, each.shown);
			if (shown) showName(each, at, x, base, zone, pass, form, found, everShown);
			each.shown = shown;
			show(at, shown);
		}
	};
	return Object.assign(place, { sort: (): void => void (order = sorted()) });
}
