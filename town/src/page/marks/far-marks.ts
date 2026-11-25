// The marks seen from afar: each agent shows as a mark while its figure is a few pixels tall, the groups of
// ./mark-groups.ts drawn as a ring of points split by state (./mark-cloud.ts).
// A group whose mark would cover another's joins it, the mark going to the middle of all their agents; it parts from it
// again only once HOLD pixels apart (./mark-place.ts#HOLD), so that a turn does not make it come and go. A mark a sign
// covers goes beside it (./mark-aside.ts). Nothing is read from the page in a frame: the screen's size is kept by
// ../camera/size.ts, the signs' boxes by ../signs/signs.ts.
import type { Figure } from "../render/kit";
import { aside, type Asides, type Kept } from "./mark-aside";
import { badges, type Badges } from "./mark-heaps";
import { grouping } from "./mark-groups";
import { cloud as look } from "./mark-cloud";
import { forgetFont, type Palette, type Placed } from "./mark-paint";
import { HOLD, join, overlaps, settle, type Placing } from "./mark-place";
import { READ, towards } from "./mark-share";
import { T } from "../render/shapes";
import type { Size } from "../camera/size";

type Project = (at: [number, number, number]) => [number, number];
type Frame = ((shown: number) => void) & { drawn: number[][] };
type Box = [number, number, number, number];

// What a frame of the marks reads, set once: the canvas and its pen, the page's colours, the town's figures and their
// groups, the smallest people's height in metres (once they read, no mark is worked out), the town's ground and the
// box of a mark as it is drawn.
type Scene = {
	figures: Figure[];
	project: Project;
	size: Size;
	signs: number[][];
	canvas: HTMLCanvasElement;
	pen: CanvasRenderingContext2D;
	palette: Palette;
	group: ReturnType<typeof grouping>;
	smallest: () => number;
	ground: [number, number, number][];
	measure: (p: Placed) => Box;
	// The counts of the groups that wait, on their large bubbles (./mark-heaps.ts).
	badges: Badges;
};
// What the marks keep from one frame to the next, by their group's id: how much each mark shows, on its way to whole
// or gone as its people read (./mark-share.ts#READ); how far each stands moved in from the screen's edge; which group
// each merged group joined; the places of ./mark-aside.ts. Then the marks of the last frame (`drawn`), and when it was.
type Held = Asides & {
	fades: Map<number, number>;
	edges: Map<number, [number, number]>;
	joined: Map<number, number>;
	drawn: number[][];
	last: number;
};
// The camera is orthographic: a point of the town shows at o + x·a + y·v + z·b on the screen.
type Axes = { o: [number, number]; a: [number, number]; v: [number, number]; b: [number, number] };
// What a frame reads of the camera and the clock: the axes, a metre up on the screen, the seconds since the last frame
// and the screen's width and height.
type Now = { axes: Axes; up: number; dt: number; screen: [number, number] };

// How far a mark comes in from the screen's edge in a frame, in pixels, along both axes at once: with its pixel's
// rounding (up to 1.4 px), under the 4 px of a jump. 3 px on each axis made 4.5 px at a corner (100 agents, 14/11).
const EDGE = 2.5;

// A mark on the device's pixel, rounded once, as it is drawn: rounded at each join too, a mark that joined others slid
// off its people by a pixel more.
const snap = (p: Placed): Placed => ({
	...p,
	x: Math.round(p.x * devicePixelRatio) / devicePixelRatio,
	y: Math.round(p.y * devicePixelRatio) / devicePixelRatio,
});

// How far a mark of `box` must move to stand whole on the screen.
const inward = (box: Box, size: Size): [number, number] => [
	box[0] < 0 ? -box[0] : box[2] > size.width ? size.width - box[2] : 0,
	box[1] < 0 ? -box[1] : box[3] > size.height ? size.height - box[3] : 0,
];

// The marks' canvas, under everything else of `layer`.
function canvasIn(layer: HTMLElement): HTMLCanvasElement {
	const canvas = document.createElement("canvas");
	canvas.className = "world-marks";
	Object.assign(canvas.style, { position: "absolute", left: "0", top: "0", width: "100%", height: "100%" });
	layer.prepend(canvas);
	return canvas;
}

// The page's colours and font, from its tokens.
function paletteOf(layer: HTMLElement): Palette {
	const style = getComputedStyle(layer);
	const token = (name: string): string => style.getPropertyValue(name).trim();
	return { surface: token("--surface"), ink: token("--ink"), font: token("--sans") || "sans-serif" };
}

// The town's ground under its figures, half a block round them: a mark moved aside from a sign stays over it. At 100
// agents one stood in the air past the island's edge (./mark-clear.test.ts).
function groundOf(figures: Figure[]): [number, number, number][] {
	const [xs, zs] = [figures.map((figure) => figure.at[0]), figures.map((figure) => figure.at[2])];
	const [x0, x1, z0, z1] = [Math.min(...xs) - T / 2, Math.max(...xs) + T / 2, Math.min(...zs) - T / 2, Math.max(...zs) + T / 2];
	return [
		[x0, 0, z0],
		[x1, 0, z0],
		[x1, 0, z1],
		[x0, 0, z1],
	];
}

function axesOf(project: Project): Axes {
	const o = project([0, 0, 0]);
	const along = (at: [number, number, number]): [number, number] => {
		const [x, y] = project(at);
		return [x - o[0], y - o[1]];
	};
	const [a, v, b] = [along([1, 0, 0]), along([0, 1, 0]), along([0, 0, 1])];
	return { o, a, v, b };
}

// The mark of `members`, at their middle over their heads.
function markOf(figures: Figure[], { o, a, v, b }: Axes, members: number[]): Placed {
	const counts = [0, 0, 0, 0];
	let [x, z, high] = [0, 0, 0];
	for (const at of members) {
		const figure = figures[at]!;
		counts[figure.agent.state]!++;
		[x, z, high] = [x + figure.at[0], z + figure.at[2], high + (figure.tall ?? 0)];
	}
	const n = members.length;
	const y = 0.08 + high / n;
	return { counts, total: n, x: o[0] + (a[0] * x + b[0] * z) / n + v[0] * y, y: o[1] + (a[1] * x + b[1] * z) / n + v[1] * y };
}

// A metre of the ground along its longest axis on the screen: across it, as the camera does not roll.
function widest({ a, b }: Axes): number {
	const [aa, bb, ab] = [a[0] ** 2 + a[1] ** 2, b[0] ** 2 + b[1] ** 2, a[0] * b[0] + a[1] * b[1]];
	return Math.sqrt((aa + bb + Math.sqrt((aa - bb) ** 2 + 4 * ab * ab)) / 2);
}

// Each group's mark, with how much it shows, `held.fades` changed in place.
function measured(scene: Scene, held: Held, { axes, up, dt, screen: [width, height] }: Now): Placing[] {
	const { figures, project, measure } = scene;
	return scene.group(widest(axes), look.room).flatMap(({ id, members: all }) => {
		// Not a place's spare figures, nor one that has gone (../people/bodies.ts).
		const members = all.filter((at) => !figures[at]!.away);
		if (members.length === 0) return [];
		// Whole while its own place's smallest people are specks, gone once they read; faded between in a move.
		const wanted = members.reduce((least, at) => Math.min(least, figures[at]!.tall ?? 0), Infinity) * up < READ ? 1 : 0;
		const shows = towards(held.fades.get(id) ?? wanted, wanted, dt);
		held.fades.set(id, shows);
		if (shows <= 0) return [];
		let [list, p] = [members, markOf(figures, axes, members)];
		const [dx, dy] = inward(measure(p), scene.size);
		// A group across the screen's edge: its mark counts its people on the screen, at their middle. Only a mark wholly
		// off came in, from a box across the edge, cut: it jumped by its width as the camera moved (./mark-edge.test.ts).
		if (dx !== 0 || dy !== 0) {
			list = members.filter((at) => {
				const [fx, fy] = project([figures[at]!.at[0], 0.08, figures[at]!.at[2]]);
				return fx >= 0 && fx <= width && fy >= 0 && fy <= height;
			});
			if (list.length === 0) return [];
			p = markOf(figures, axes, list);
		}
		return [{ id, members: [...list], p, box: measure(p), shows }];
	});
}

// The marks largest first, each that would cover one placed before joining it, `held.joined` changed in place.
function joined(marked: Placing[], held: Held, measure: Scene["measure"]): Placing[] {
	marked.sort((one, other) => other.p.total - one.p.total || one.id - other.id);
	const placed: Placing[] = [];
	const joining = new Map<number, number>();
	for (const each of marked) {
		const host = placed.find((other) => overlaps(each.box, other.box, held.joined.get(each.id) === other.id ? HOLD : 0));
		if (!host) {
			placed.push(each);
			continue;
		}
		joining.set(each.id, host.id);
		join(host, each, measure);
	}
	held.joined = joining;
	return placed;
}

// Each mark comes in whole on the screen by EDGE pixels a frame at most: held still at the edge, it slid off its
// people as fast as the camera moved them (./mark-jump.test.ts). Whole again once the camera stops.
function comeIn(kept: Kept[], held: Held, { measure, size }: Scene): void {
	for (const mark of kept) {
		const [ix, iy] = inward(measure(mark.p), size);
		const [hx, hy] = held.edges.get(mark.id) ?? [ix, iy];
		const k = Math.min(1, EDGE / (Math.hypot(ix - hx, iy - hy) || 1));
		const [ex, ey] = [hx + (ix - hx) * k, hy + (iy - hy) * k];
		held.edges.set(mark.id, [ex, ey]);
		[mark.p.x, mark.p.y] = [mark.p.x + ex, mark.p.y + ey];
		mark.box = measure(mark.p);
	}
}

// The frame's marks, in their places: joined, beside the signs, come in from the edge.
function inPlace(scene: Scene, held: Held, now: Now): Kept[] {
	const { measure, project } = scene;
	const marks = joined(measured(scene, held, now), held, measure);
	settle(marks, measure);
	const kept = aside(marks, scene.signs, scene.ground.map(project), now.screen, held, now.dt, measure);
	// A mark that took another grew: the marks it covers now join it.
	settle(kept, measure);
	comeIn(kept, held, scene);
	// The marks a mark that came in covers join it.
	settle(kept, measure);
	return kept;
}

// The marks' drawings, and in `next` what each draws, `shown` the share of the whole view they show in.
function painted(kept: Kept[], shown: number, { pen, palette }: Scene, next: number[][]): (() => void)[] {
	return kept.map(({ id, members, p: placedAt, shows, now }) => {
		const [p, alpha] = [snap(placedAt), shown * shows * now];
		// The box of what is drawn, which the next frame clears: a mark that took others grew with its count, past the
		// box it was placed by, and the edge of its ring stayed on the canvas as it moved (./mark-clear.test.ts).
		const box = look.box(p, pen, palette);
		next.push([box[0], box[1], box[2] - box[0], box[3] - box[1], alpha, id, p.total, ...members]);
		return () => {
			pen.globalAlpha = alpha;
			look.draw(pen, p, palette);
		};
	});
}

// Drawn again only when a mark changed: on the device's pixel, a mark held still or walking slowly is the same at most
// frames. Then cleared only where the last frame drew: clearing the whole screen cost more than the marks.
function flush(pen: CanvasRenderingContext2D, drawn: number[][], next: number[][], draws: (() => void)[]): void {
	const same = next.length === drawn.length && next.every((mark, at) => mark.length === drawn[at]!.length && mark.every((value, k) => value === drawn[at]![k]));
	if (same) return;
	for (const [left, top, w, h] of drawn) pen.clearRect(left! - 3, top! - 3, w! + 6, h! + 6);
	for (const draw of draws) draw();
	pen.globalAlpha = 1;
	drawn.splice(0, drawn.length, ...next);
}

// A frame of the marks, `shown` the share of the whole view they show in.
function frame(scene: Scene, held: Held, shown: number): void {
	const began = performance.now();
	const dt = Math.min(0.1, (began - held.last) / 1000);
	held.last = began;
	const { canvas, pen, size } = scene;
	const [width, height, ratio] = [size.width, size.height, devicePixelRatio];
	if (canvas.width !== Math.round(width * ratio) || canvas.height !== Math.round(height * ratio)) {
		[canvas.width, canvas.height] = [Math.round(width * ratio), Math.round(height * ratio)];
		forgetFont();
		// A canvas resized is blank: its marks are drawn again.
		held.drawn.length = 0;
	}
	pen.setTransform(ratio, 0, 0, ratio, 0, 0);
	const next: number[][] = [];
	let draws: (() => void)[] = [];
	const axes = axesOf(scene.project);
	const up = Math.hypot(...axes.v);
	if (shown > 0.01 && (scene.smallest() * up < READ || [...held.fades.values()].some((fade) => fade > 0)))
		draws = painted(inPlace(scene, held, { axes, up, dt, screen: [width, height] }), shown, scene, next);
	if (shown > 0.01) badges(scene.badges, scene, [shown, up, widest(axes), dt], next, draws);
	flush(pen, held.drawn, next, draws);
}

// The marks' frame. Its `drawn`: the marks of the last frame, as their box's left, top, width, height and opacity in CSS
// pixels, then the group's id, its count and its figures' indices, read by the tests. `bubbles`: the large bubbles of
// the groups that wait, and whether a building hides a point of the town (./mark-heaps.ts).
export function farMarks(
	layer: HTMLElement,
	figures: Figure[],
	project: Project,
	size: Size,
	signs: number[][],
	bubbles: Pick<Badges, "heaps" | "hidden"> = { heaps: [], hidden: () => false },
): Frame {
	const canvas = canvasIn(layer);
	const pen = canvas.getContext("2d")!;
	const palette = paletteOf(layer);
	const measure = (p: Placed): Box => look.box(snap(p), pen, palette);
	const group = grouping(figures);
	// Read at each frame: a crowd stands smaller once more agents have come to its place (../people/live.ts).
	const smallest = (): number => figures.reduce((least, figure) => (figure.away ? least : Math.min(least, figure.tall ?? 0)), Infinity);
	const kept: Badges = { ...bubbles, reads: [] };
	const scene: Scene = { figures, project, size, signs, canvas, pen, palette, group, smallest, ground: groundOf(figures), measure, badges: kept };
	const held: Held = { fades: new Map(), edges: new Map(), joined: new Map(), spots: new Map(), seen: new Map(), drawn: [], last: performance.now() };
	return Object.assign((shown: number): void => frame(scene, held, shown), { drawn: held.drawn });
}
