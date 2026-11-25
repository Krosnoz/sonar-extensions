// No inhabitant is left under a floating control of the page once the camera stops, whatever the gesture: a zoom, then
// a tilt or a turn. On a phone, a tilted view kept an inhabitant 8 px from the settings' button (12/11): the 12 px were
// counted from the figure's axis, not its arm; the camera came out from under the controls while it still turned; and a
// crowd by the town's button and one by the settings, pushed opposite ways, kept one of them there.

import { expect, test } from "bun:test";
import { uniform, vec3 } from "three/tsl";
import type { Agent, Kit, Topic } from "../render/kit";
import { THREE } from "../render/nodes";
import type { Part } from "../render/parts";

const page = globalThis as Record<string, unknown>;
page["matchMedia"] ??= () => ({ matches: false });
page["document"] ??= { documentElement: { dataset: {} } };
page["getComputedStyle"] ??= () => ({ paddingTop: "0" });
await import("../test-page");
const { town } = await import("../plan/town");
const { gestures } = await import("./gestures");
const { bound } = await import("./bounds");

// The town's box on a phone of 390 × 844 px, under the page's top bar (108 px), as read on the page (13/11).
const [WIDTH, HEIGHT] = [390, 736];
// The phone's floating controls at the bottom, in CSS pixels from the town's box: the town's button, the settings, the
// voice's orb.
const CONTROLS = [
	{ left: 16, top: 660, right: 60, bottom: 704 },
	{ left: 259, top: 667, right: 291, bottom: 699 },
	{ left: 305, top: 651, right: 369, bottom: 715 },
];
// The page's controls as the camera reads them (./size.ts#controlsOver).
const document = page["document"] as Record<string, unknown>;
document["querySelectorAll"] = () =>
	CONTROLS.map((at) => ({
		closest: () => null,
		checkVisibility: () => true,
		contains: () => true,
		getBoundingClientRect: () => ({ ...at, width: at.right - at.left, height: at.bottom - at.top }),
	}));
document["elementFromPoint"] = () => ({});

const kit: Kit = (() => {
	let seed = 7;
	return {
		night: false,
		aspect: 1.6,
		random: () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296,
		uTime: uniform(0),
		scene: new THREE.Scene(),
		blank: vec3(0, 0, 0),
		along: () => 0,
		part: (): Part => ({ put: () => 0, move: () => {}, set: () => {} }),
	};
})();
const topicOf = (index: number): Topic => ({
	name: `Subject ${index}`,
	agents: Array.from({ length: 5 }, (_, at): Agent => ({ name: `Agent ${at}`, state: 0, seed: 0.13 + at * 0.29, children: [] })),
	working: 0,
	waiting: 0,
	reviewing: 0,
});

test("town: after a zoom then a tilt or a turn, no inhabitant stays within 12 px of a control", () => {
	const world = town.build(
		kit,
		Array.from({ length: 20 }, (_, index) => topicOf(index)),
	);
	world.frame(WIDTH, HEIGHT, 0, CONTROLS);
	const host = {
		clientWidth: WIDTH,
		clientHeight: HEIGHT,
		getBoundingClientRect: () => ({ left: 0, top: 0, width: WIDTH, height: HEIGHT, right: WIDTH, bottom: HEIGHT }),
		addEventListener: () => {},
	};
	const standing = (): [number, number, number][] => world.figures.flatMap(({ at }) => [at, [at[0], 0, at[2]] as [number, number, number]]);
	const camera = gestures({ clientWidth: WIDTH, clientHeight: HEIGHT } as HTMLCanvasElement, world.view, host as unknown as HTMLElement, standing);
	const view = world.view;
	const home = [view.yaw, view.pitch] as const;
	// Where a point of the town stands on the screen.
	const screenAt = (at: [number, number, number]): [number, number] => {
		const [[top, height], unit, [u, v]] = [view.band(), view.unit(view.scale), view.screenOf(at)];
		return [WIDTH / 2 + (u - view.aim[0]) / unit, top + height / 2 - (v - view.aim[1]) / unit];
	};
	const close: string[] = [];
	const settings = CONTROLS[1]!;
	// For a few inhabitants: the camera zoomed in where the tilt or the turn to come brings the inhabitant 14 px left of
	// the settings' button, then that tilt or turn, as the page eases it (./view.ts): fast, then slower and slower.
	for (const figure of world.figures.filter((_, index) => index % 9 === 0))
		for (const [yaw, pitch] of [
			[0, -0.3],
			[0, 0.3],
			[0.6, 0],
		] as const) {
			view.orient(home[0] + yaw, home[1] + pitch);
			const unit = view.unit(3);
			const [u, v] = view.screenOf(figure.at);
			const [top, height] = view.band();
			const there: [number, number] = [u - (settings.left - 14 - WIDTH / 2) * unit, v + ((settings.top + settings.bottom) / 2 - top - height / 2) * unit];
			const back = view.orient(...home);
			camera.jump(3, back(there));
			for (let frame = 0; frame < 30; frame++) camera.ease(1 / 60);
			const aimed = [home[0] + yaw, home[1] + pitch];
			for (let frame = 0; frame < 180; frame++) {
				camera.ease(1 / 60);
				if (Math.abs(aimed[0]! - view.yaw) <= 1e-4 && Math.abs(aimed[1]! - view.pitch) <= 1e-4) continue;
				const k = 1 - Math.exp(-12 / 60);
				camera.carry(view.orient(view.yaw + (aimed[0]! - view.yaw) * k, view.pitch + (aimed[1]! - view.pitch) * k));
			}
			// 12 px from the figure's body, 0.4 m on each side of its axis (./camera-follow.ts), less a pixel of rounding.
			const room = 11 + 0.4 / view.unit(view.scale);
			for (const at of standing()) {
				const [sx, sy] = screenAt(at);
				const near = CONTROLS.some((c) => sx > c.left - room && sx < c.right + room && sy > c.top - room && sy < c.bottom + room);
				if (near) close.push(`turn ${yaw}, tilt ${pitch}: inhabitant at ${sx.toFixed(0)}, ${sy.toFixed(0)}`);
			}
		}
	expect(close).toEqual([]);
}, 120_000);

// A series of notches by the controls: the camera comes out from under them only once the pointer moves on. Moved after
// each notch, the point under the pointer slid by 58 to 160 px at the second notch (12/11).
test("town: a series of wheel notches by the controls keeps the point under the pointer, then clears the controls", () => {
	const world = town.build(
		kit,
		Array.from({ length: 20 }, (_, index) => topicOf(index)),
	);
	world.frame(WIDTH, HEIGHT, 0, CONTROLS);
	const listeners = new Map<string, ((event: unknown) => void)[]>();
	const host = {
		clientWidth: WIDTH,
		clientHeight: HEIGHT,
		getBoundingClientRect: () => ({ left: 0, top: 0, width: WIDTH, height: HEIGHT, right: WIDTH, bottom: HEIGHT }),
		// The town is there: it neither comes nor goes (`moving`, ./gestures.ts).
		classList: { contains: () => false },
		addEventListener: (type: string, listener: (event: unknown) => void) => void listeners.set(type, [...(listeners.get(type) ?? []), listener]),
	};
	const fire = (type: string, event: Record<string, unknown>): void => {
		for (const listener of listeners.get(type) ?? []) listener({ preventDefault: () => {}, pointerId: 1, ...event });
	};
	const standing = (): [number, number, number][] => world.figures.flatMap(({ at }) => [at, [at[0], 0, at[2]] as [number, number, number]]);
	const camera = gestures({ clientWidth: WIDTH, clientHeight: HEIGHT } as HTMLCanvasElement, world.view, host as unknown as HTMLElement, standing);
	const view = world.view;
	const [top, height] = view.band();
	const planeAt = (x: number, y: number): [number, number] => {
		const unit = view.unit(view.scale);
		return [view.aim[0] + (x - WIDTH / 2) * unit, view.aim[1] - (y - top - height / 2) * unit];
	};
	const slid: string[] = [];
	let cleared = 0;
	// For a few inhabitants: the camera at level 4 with the inhabitant 28 px under the pointer, by the settings' button.
	const settings = CONTROLS[1]!;
	const [x, y] = [(settings.left + settings.right) / 2, settings.top - 4];
	for (const figure of world.figures.filter((_, index) => index % 9 === 0)) {
		const [u, v] = view.screenOf(figure.at);
		const unit = view.unit(4);
		camera.jump(4, [u - (x - WIDTH / 2) * unit, v + (y + 28 - top - height / 2) * unit]);
		for (let step = 1; step <= 2; step++) {
			const [scale, aim, under] = [view.scale, view.aim, planeAt(x, y)];
			// Two notches of ×1.39: the inhabitant comes 39 px under the pointer, by the button's bottom edge, then 54 px.
			fire("wheel", { deltaY: -100, deltaMode: 0, ctrlKey: false, clientX: x, clientY: y });
			fire("pointermove", { clientX: x + 2, clientY: y });
			for (let frame = 0; frame < 120; frame++) camera.ease(1 / 60);
			// Where the pointer asked the camera to go: a bound that held it elsewhere may slide the point.
			const shift = view.unit(scale) - view.unit(view.scale);
			const asked: [number, number] = [aim[0] + (x - WIDTH / 2) * shift, aim[1] + (top + height / 2 - y) * shift];
			const kept = bound(view.outline(), view.whole, asked, view.scale, [WIDTH, height], view.unit(1));
			const now = planeAt(x, y);
			const moved = Math.hypot(now[0] - under[0], now[1] - under[1]) / view.unit(view.scale);
			if (Math.hypot(kept[0] - asked[0], kept[1] - asked[1]) < 1e-6 && moved > 1) slid.push(`${x}, ${y}, step ${step}: ${moved.toFixed(0)} px`);
		}
		// The pointer moves on: the camera comes out from under the controls.
		const before = view.aim;
		fire("pointermove", { clientX: x + 40, clientY: y - 40 });
		for (let frame = 0; frame < 120; frame++) camera.ease(1 / 60);
		if (Math.hypot(view.aim[0] - before[0], view.aim[1] - before[1]) > view.unit(view.scale)) cleared++;
	}
	expect(slid).toEqual([]);
	// The inhabitants were under a control after some series, and the camera cleared them once the pointer moved on.
	expect(cleared).toBeGreaterThan(0);
}, 120_000);
