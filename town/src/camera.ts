// The town's camera: orthographic, it looks down at the town from a heading and a height that the user turns and tilts
// as a 3D map does, by default the true isometric view. The zoom changes what the camera frames, never the size of a pixel on
// the screen: the town is drawn again at every level. The camera moves by whole pixels of the drawing, so they do not
// swim when it slides.
import type { Grid } from "./grid";
import { PITCH } from "./grid";
import type { Kit, View, World } from "./kit";
import { THREE } from "./nodes";

const point = new THREE.Vector3();
// How low and how high the camera may look down: lower, the houses hide the squares; straight down, a town is a plan.
export const LOWEST = (28 * Math.PI) / 180;
export const HIGHEST = (80 * Math.PI) / 180;

// The screen's axes, seen from `yaw` (0: the isometric heading) and looking down by `pitch`.
type Axes = { right: THREE.Vector3; up: THREE.Vector3; back: THREE.Vector3 };
function axesOf(yaw: number, pitch: number, axes?: Axes): Axes {
	const az = Math.PI / 4 + yaw;
	const [s, c, sp, cp] = [Math.sin(az), Math.cos(az), Math.sin(pitch), Math.cos(pitch)];
	const out = axes ?? { right: new THREE.Vector3(), up: new THREE.Vector3(), back: new THREE.Vector3() };
	out.right.set(c, 0, -s);
	out.up.set(-sp * s, cp, -sp * c);
	out.back.set(cp * s, sp, cp * c);
	return out;
}
const isometric = axesOf(0, PITCH);

// The heading and height the camera comes back to: the isometric view on every screen. Seen from the front and higher, a
// phone's town filled 2.6 times more of the screen, but read as a plan, not as the town of the reference (simile.com).
const homeOf = (): { yaw: number; pitch: number } => ({ yaw: 0, pitch: PITCH });

// What the camera must frame, on the screen's axes: `left` to `east`, `low` to `high`.
export type Box = { left: number; east: number; low: number; high: number; center: THREE.Vector3 };
type Point = [number, number, number];
// A floating control of the page over the town, in CSS pixels from the town's box.
export type Spot = { left: number; top: number; right: number; bottom: number };
// The band under the page's top bar where the town's drawing fades in (styles/world-icon.css, --space-4), in CSS pixels.
const FADE = 16;
// A subject's sign, about: its width and height in CSS pixels.
const SIGN = [128, 48] as const;
export function box(seen: Point[], { right, up }: Axes = isometric): Box {
	const span = (axis: THREE.Vector3): [number, number] =>
		seen.reduce(([low, high], at) => [Math.min(low, point.set(...at).dot(axis)), Math.max(high, point.dot(axis))], [Infinity, -Infinity]);
	const [left, east] = span(right);
	const [low, high] = span(up);
	const center = new THREE.Vector3().addScaledVector(right, (left + east) / 2).addScaledVector(up, (low + high) / 2);
	return { left, east, low, high, center };
}

const cross = (o: [number, number], a: [number, number], b: [number, number]): number => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
// One half of the hull, along points sorted on the plane.
function chain(list: [number, number][]): [number, number][] {
	const out: [number, number][] = [];
	for (const each of list) {
		while (out.length >= 2 && cross(out.at(-2)!, out.at(-1)!, each) <= 0) out.pop();
		out.push(each);
	}
	return out.slice(0, -1);
}
// The convex hull of points of the plane, counter-clockwise (Andrew's monotone chain).
function hullOf(points: [number, number][]): [number, number][] {
	const sorted = points.toSorted((a, b) => a[0] - b[0] || a[1] - b[1]);
	return [...chain(sorted), ...chain(sorted.toReversed())];
}

// The outline of the island's ground on the screen's plane, seen on `at`.
const outlineOf = (land: Point[], at: Axes): [number, number][] =>
	hullOf(land.map((each): [number, number] => [point.set(...each).dot(at.right), point.dot(at.up)]));
// The town's size on the screen, the largest it takes at any heading: the zoom keeps its level while the town turns.
function widest(seen: Point[], pitch: number): [number, number] {
	let [w, h] = [0, 0];
	for (let at = 0; at < 16; at++) {
		const { left, east, low, high } = box(seen, axesOf((at * Math.PI) / 8, pitch));
		[w, h] = [Math.max(w, east - left), Math.max(h, high - low)];
	}
	return [w, h];
}

// What the camera frames. `wide` and `tall`: the town's size (widest). `height`: the band of the screen the camera
// frames, in CSS pixels: under the page's top bar (`top`), and above the floating controls at the bottom (`floor`) when
// the town would lie under them. The drawing goes on under both, as the map does. `shape`: the band's width over its
// height. `current` and `outline`: the town's box and its ground's outline at the camera's heading.
type Frame = { shape: number; height: number; top: number; floor: number; wide: number; tall: number; current: Box; outline: [number, number][] };
const halfOf = (frame: Frame, scale: number): number => Math.max(frame.tall / 2 + 1.8, (frame.wide / 2 + 2.4) / frame.shape) / scale;
const centreOf = ({ current }: Frame): [number, number] => [(current.left + current.east) / 2, (current.low + current.high) / 2];
// The band the camera frames, `bottom` pixels above the screen's bottom; under the bar, the drawing fades in over FADE
// px: the band starts below it, so no roof of the whole town fades.
function band(frame: Frame, width: number, full: number, bar: number, bottom: number): void {
	[frame.shape, frame.height, frame.top, frame.floor] = [width / (full - bar - FADE - bottom), full - bar - FADE - bottom, bar + FADE, bottom];
}

// Where the camera stands on the screen's plane (`at`), off the aim by `offset`, and the heading it stood for. A turn
// or a tilt carries the camera with the aim, keeping that offset: rounded afresh on the turned axes, the offset
// changed at each step of a turn, and the whole town jumped a pixel one way, then back (on the phone, 4 600 blinking
// pixels a frame at twice the whole town's scale; 230 after). Then the camera steps by whole pixels of the drawing,
// once the aim is three quarters of one away: a step at the half went back and forth while the aim eased by hairs
// during a turn (on a computer, 150 blinking pixels a frame over the whole town; about 10 before).
type Stand = { at: [number, number]; offset: [number, number]; heading: [number, number] };
function look(lens: THREE.OrthographicCamera, view: View, axes: Axes, frame: Frame, stand: Stand): void {
	const half = halfOf(frame, view.scale);
	const { shape, height, top, floor } = frame;
	// The drawing's pixel is half a CSS pixel (./renderer.ts, density 2): the camera steps by it, so a slide moves every
	// pixel by a whole one and none of them changes.
	const texel = (2 * half * 0.5) / height;
	[lens.left, lens.right, lens.top, lens.bottom] = [-half * shape, half * shape, half * (1 + (2 * top) / height), -half * (1 + (2 * floor) / height)];
	if (view.yaw !== stand.heading[0] || view.pitch !== stand.heading[1]) {
		stand.at = [view.aim[0] + stand.offset[0], view.aim[1] + stand.offset[1]];
		stand.heading = [view.yaw, view.pitch];
	}
	const step = (axis: 0 | 1): number => {
		const away = (view.aim[axis] - stand.at[axis]) / texel;
		return Math.abs(away) > 0.75 ? stand.at[axis] + Math.round(away) * texel : stand.at[axis];
	};
	stand.at = [step(0), step(1)];
	const [u, v] = stand.at;
	stand.offset = [u - view.aim[0], v - view.aim[1]];
	lens.position.set(0, 0, 0).addScaledVector(axes.right, u).addScaledVector(axes.up, v);
	lens.lookAt(point.copy(lens.position).addScaledVector(axes.back, -1));
	lens.position.addScaledVector(axes.back, 400);
	lens.updateProjectionMatrix();
	lens.updateMatrixWorld();
}

// A point of the old screen's plane, by the ground under it: the same ground, seen from the new heading (`axes`).
const carrier =
	(old: Axes, axes: Axes) =>
	(aim: [number, number]): [number, number] => {
		const ground = point.set(0, 0, 0).addScaledVector(old.right, aim[0]).addScaledVector(old.up, aim[1]);
		ground.addScaledVector(old.back, -ground.y / old.back.y);
		return [ground.dot(axes.right), ground.dot(axes.up)];
	};

// Where the camera aims for a subject's block, on the screen's plane.
function overOf(grid: Grid, axes: Axes, frame: Frame, index: number): [number, number] {
	// The blocks without a subject carry -1: the whole town is asked for, not one of them.
	const block = index < 0 ? undefined : grid.all.find((each) => each.topic === index);
	return block ? [point.set(block.x - 1, 2.5, block.z - 1).dot(axes.right), point.dot(axes.up)] : centreOf(frame);
}

// Where a point of the town lies on the screen at the whole town's level, in CSS pixels from the town's box.
function spotOf(frame: Frame, axes: Axes, at: Point): [number, number] {
	const { shape, height, top } = frame;
	const unit = (2 * halfOf(frame, 1)) / height;
	const [u, v] = [point.set(...at).dot(axes.right), point.dot(axes.up)];
	const [cu, cv] = centreOf(frame);
	return [(shape * height) / 2 + (u - cu) / unit, top + height / 2 - (v - cv) / unit];
}
// Whether a building, a square or a sign of the whole town would lie under one of `controls`. A sign stands over its
// roof, about SIGN wide and high.
function spoiled(frame: Frame, axes: Axes, controls: Spot[], core: Point[], roofs: Point[]): boolean {
	const under = (at: Point, aside: number, above: number): boolean => {
		const [x, y] = spotOf(frame, axes, at);
		return controls.some((each) => x > each.left - aside && x < each.right + aside && y > each.top - above && y < each.bottom);
	};
	return core.some((at) => under(at, 4, 4)) || roofs.some((at) => under(at, SIGN[0] / 2, SIGN[1]));
}

// `seen`: the points the camera must frame, whatever its heading: the whole town is a floating island, framed whole on
// every screen. Its lawn corners left a phone's sides once, and cut the roads, cars and lamps along them (12/11).
// `built`: of them, the buildings and the subjects' squares, which no control of the page may cover. `roofs`: the
// subjects' roofs, where their signs stand.
export function camera(kit: Kit, grid: Grid, seen: Point[], built: Point[] = seen, roofs: Point[] = []): Pick<World, "camera" | "frame" | "view"> {
	const lens = new THREE.OrthographicCamera(-1, 1, 1, -1, 1, 1400);
	const home = homeOf();
	const axes = axesOf(home.yaw, home.pitch);
	const core = built.length ? built : seen;
	const current = box(seen, axes);
	// The outline of the island's ground, without the roofs: past the far corner, a steeple stands against the sky alone,
	// and a zoom that went there showed an empty screen. Without the plinth's foot either: the pointer anchors on the
	// ground, and the bound read on an outline that reached the foot moved with its depth (a phone's notch jumped 109 px
	// once the plinth went from 1.7 to 5.2 deep, 13/11). The plinth counts only to frame the whole island (`seen`).
	const land = seen.filter((at) => at[1] === 0);
	const outline = outlineOf(land, axes);
	const [wide, tall] = widest(seen, home.pitch);
	const frame: Frame = { shape: kit.aspect, height: 800, top: 0, floor: 0, wide, tall, current, outline };
	const centre = (): [number, number] => centreOf(frame);
	const stand: Stand = { at: [0, 0], offset: [0, 0], heading: [Number.NaN, Number.NaN] };
	const view: View = {
		scale: 1,
		aim: centre(),
		whole: centre(),
		yaw: home.yaw,
		pitch: home.pitch,
		// The nearest level: a block fills about two thirds of the screen's height.
		most: Math.max(2, halfOf(frame, 1) / 9),
		set(scale, aim) {
			view.scale = scale;
			view.aim = aim;
			look(lens, view, axes, frame, stand);
		},
		// Turns and tilts the camera about the ground under the middle of the screen: what the user looks at stays there.
		orient(yaw, pitch) {
			const kept = Math.min(HIGHEST, Math.max(LOWEST, pitch));
			const old = axesOf(view.yaw, view.pitch);
			if (kept !== view.pitch) [frame.wide, frame.tall] = widest(seen, kept);
			[view.yaw, view.pitch] = [yaw, kept];
			axesOf(yaw, kept, axes);
			frame.current = box(seen, axes);
			frame.outline = outlineOf(land, axes);
			view.whole = centre();
			const carry = carrier(old, axes);
			view.aim = carry(view.aim);
			look(lens, view, axes, frame, stand);
			// The zoom's target is carried the same way.
			return carry;
		},
		screenOf: (at) => [point.set(...at).dot(axes.right), point.dot(axes.up)],
		over: (index) => overOf(grid, axes, frame, index),
		unit: (scale) => (2 * halfOf(frame, scale)) / frame.height,
		outline: () => frame.outline,
		band: () => [frame.top, frame.height],
	};
	return {
		camera: lens,
		frame(width, full, bar = 0, controls = []) {
			// The controls of the screen's bottom half: the band may end above the highest of them.
			const low = controls.filter((each) => each.top > (bar + full) / 2);
			const under = full - Math.min(full, ...low.map((each) => each.top));
			band(frame, width, full, bar, under);
			const above = halfOf(frame, 1) / frame.height;
			band(frame, width, full, bar, 0);
			// Down to the screen's bottom, the town is larger only where the screen's height limits it (a computer). It is
			// framed so only if nothing of it lies under a control; else, and on a phone, it is centred between the bar and
			// the controls.
			if (halfOf(frame, 1) / frame.height > above * 0.995 || spoiled(frame, axes, low, core, roofs)) band(frame, width, full, bar, under);
			look(lens, view, axes, frame, stand);
		},
		view,
	};
}
