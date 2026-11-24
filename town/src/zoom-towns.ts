// The page, the screens and the towns the wheel's tests play on (./zoom.test.ts, ./zoom-notches.test.ts,
// ./zoom-steps.test.ts), and how they read what the screen shows.
import { uniform, vec3 } from "three/tsl";
import type { Agent, Kit, Topic, World } from "./kit";
import { THREE } from "./nodes";
import type { Part } from "./parts";
// ./test-page.ts sets other keys of the page than those below: imported first, it changes nothing.
import "./test-page";

// The page the gestures read: motion not reduced, no control over the town.
export const page = globalThis as Record<string, unknown>;
page["matchMedia"] ??= () => ({ matches: false });
page["document"] ??= { querySelectorAll: () => [], documentElement: { dataset: {} } };
page["getComputedStyle"] ??= () => ({ paddingTop: "0" });
const { town } = await import("./town");

// A kit that draws nothing.
const kitOf = (): Kit => {
	let seed = 7;
	return {
		night: false,
		aspect: 1.6,
		random: () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296,
		uTime: uniform(0),
		scene: new THREE.Scene(),
		blank: vec3(0, 0, 0),
		along: () => 0,
		part: (): Part => ({ put: () => 0, move: () => {}, set: () => {}, mark: () => {} }),
	};
};

const topicOf = (index: number, agents: number): Topic => ({
	name: `Subject ${index}`,
	agents: Array.from({ length: agents }, (_, at): Agent => ({ name: `Agent ${at}`, state: 1, seed: 0.13 + at * 0.29, children: [] })),
	working: agents,
	waiting: 0,
	reviewing: 0,
});

type Spot = { left: number; top: number; right: number; bottom: number };
export type Screen = { width: number; height: number; bar: number; controls: Spot[] };
// The town's box on a phone of 390 × 844 px, read on the page (13/11): under the page's top bar (108 px), 736 px high,
// with the town's button, the settings and the voice's orb at its bottom. The camera frames the band above them only
// when the whole town would lie under one (./camera.ts, frame); else down to the box's bottom, as for the preview's
// project. There, a notch of the wheel moved the town by up to 47 px at once, which the box of 788 px never showed.
const PHONE_CONTROLS: Spot[] = [
	{ left: 16, top: 660, right: 60, bottom: 704 },
	{ left: 259, top: 667, right: 291, bottom: 699 },
	{ left: 305, top: 651, right: 369, bottom: 715 },
];
export const SCREENS: [string, Screen][] = [
	["computer", { width: 1440, height: 900, bar: 56, controls: [] }],
	["phone", { width: 390, height: 788, bar: 0, controls: [] }],
	["phone under its bar", { width: 390, height: 736, bar: 0, controls: PHONE_CONTROLS }],
	["phone under its bar, clear of its controls", { width: 390, height: 736, bar: 0, controls: [] }],
];
// Subjects and agents in each: 10, 100 and 1 000 agents.
export const TOWNS: [number, number][] = [
	[2, 5],
	[20, 5],
	[100, 10],
];

type Host = { listeners: Map<string, (event: unknown) => void> };
export function hostOf({ width, height }: Screen): Host & Record<string, unknown> {
	const listeners = new Map<string, (event: unknown) => void>();
	return {
		listeners,
		clientWidth: width,
		clientHeight: height,
		getBoundingClientRect: () => ({ left: 0, top: 0, width, height, right: width, bottom: height }),
		addEventListener: (type: string, listener: (event: unknown) => void) => void listeners.set(type, listener),
	};
}

export const inside = (polygon: [number, number][], at: [number, number]): boolean =>
	polygon.every((a, index) => {
		const b = polygon[(index + 1) % polygon.length]!;
		return (b[0] - a[0]) * (at[1] - a[1]) - (b[1] - a[1]) * (at[0] - a[0]) >= 0;
	});
// The point of the screen's plane under a point of the screen (CSS px).
export const planeAt = (world: World, screen: Screen, x: number, y: number): [number, number] => {
	const { view } = world;
	const [[top, height], unit] = [view.band(), view.unit(view.scale)];
	return [view.aim[0] + (x - screen.width / 2) * unit, view.aim[1] - (y - top - height / 2) * unit];
};

// Each town is built once, for both screens: the largest takes seconds.
const towns = new Map<string, World>();
export function built(subjects: number, agents: number): World {
	const key = `${subjects}×${agents}`;
	const world =
		towns.get(key) ??
		town.build(
			kitOf(),
			Array.from({ length: subjects }, (_, index) => topicOf(index, agents)),
		);
	towns.set(key, world);
	return world;
}
