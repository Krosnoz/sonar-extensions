// The steps of the wheel: the zoom of a notch on every screen and in every unit, a touchpad's small steps, and the
// spring at the nearest level.

import { expect, test } from "bun:test";
import { lookAt } from "../sonar/look";
import { SCREENS, built, hostOf } from "./zoom-towns";

const { gestures } = await import("./gestures");

// A notch zooms by the same factor on every screen, whatever unit the wheel counts in: 400 px, 10 lines of 40 px.
test("town: a notch of the wheel zooms by the same factor on a computer and on a phone, in pixels or in lines", () => {
	const factors: string[] = [];
	for (const [name, screen] of SCREENS)
		for (const [deltaY, deltaMode] of [
			[-100, 0],
			[-400, 0],
			[-10, 1],
		] as const) {
			const world = built(20, 5);
			world.frame(screen.width, screen.height, screen.bar, screen.controls);
			const host = hostOf(screen);
			const camera = gestures(
				{ clientWidth: screen.width, clientHeight: screen.height } as HTMLCanvasElement,
				world.view,
				host as unknown as HTMLElement,
				() => [],
			);
			camera.jump(1);
			host.listeners.get("wheel")!({ preventDefault: () => {}, deltaY, deltaMode, ctrlKey: false, clientX: screen.width / 2, clientY: screen.height / 2 });
			camera.ease(1000);
			factors.push(`${name}, ${deltaY} (mode ${deltaMode}): ×${world.view.scale.toFixed(2)}`);
		}
	// About ×1.4 a mouse's notch (100 px), as a map zooms, and at most ×2 a step: a notch took the nearest level of 10
	// and 100 agents in 2 steps of ×2.05 (13/11).
	expect(factors).toEqual([
		"computer, -100 (mode 0): ×1.39",
		"computer, -400 (mode 0): ×1.93",
		"computer, -10 (mode 1): ×1.93",
		"phone, -100 (mode 0): ×1.39",
		"phone, -400 (mode 0): ×1.93",
		"phone, -10 (mode 1): ×1.93",
		"phone under its bar, -100 (mode 0): ×1.39",
		"phone under its bar, -400 (mode 0): ×1.93",
		"phone under its bar, -10 (mode 1): ×1.93",
		"phone under its bar, clear of its controls, -100 (mode 0): ×1.39",
		"phone under its bar, clear of its controls, -400 (mode 0): ×1.93",
		"phone under its bar, clear of its controls, -10 (mode 1): ×1.93",
	]);
});

// A touchpad sends many small steps: each zooms a little, so the zoom stays fluid, and 100 px of them zoom about as
// far as a notch.
test("town: a touchpad's small steps zoom fluidly", () => {
	const [, screen] = SCREENS[0]!;
	const world = built(20, 5);
	world.frame(screen.width, screen.height, screen.bar, screen.controls);
	const host = hostOf(screen);
	const camera = gestures(
		{ clientWidth: screen.width, clientHeight: screen.height } as HTMLCanvasElement,
		world.view,
		host as unknown as HTMLElement,
		() => [],
	);
	camera.jump(1);
	let largest = 1;
	for (let step = 0; step < 25; step++) {
		const before = world.view.scale;
		host.listeners.get("wheel")!({ preventDefault: () => {}, deltaY: -4, deltaMode: 0, ctrlKey: false, clientX: screen.width / 2, clientY: screen.height / 2 });
		camera.ease(1000);
		largest = Math.max(largest, world.view.scale / before);
	}
	expect({ step: largest < 1.02, total: world.view.scale.toFixed(2) }).toEqual({ step: true, total: "1.51" });
});

// At the nearest level, a notch springs the camera a little past it and back within 250 ms; with motion reduced,
// nothing moves. Without it, the last notches did nothing, with no sign why (12/11).
test("town: at the nearest level, a notch of the wheel springs past it and back within 250 ms", () => {
	const [, screen] = SCREENS[0]!;
	const world = built(20, 5);
	const { view } = world;
	world.frame(screen.width, screen.height, screen.bar, screen.controls);
	const host = hostOf(screen);
	const camera = gestures({ clientWidth: screen.width, clientHeight: screen.height } as HTMLCanvasElement, view, host as unknown as HTMLElement, () => []);
	const wheel = host.listeners.get("wheel")!;
	const spring = (): { farthest: number; after: number } => {
		camera.jump(view.most);
		wheel({ preventDefault: () => {}, deltaY: -100, deltaMode: 0, ctrlKey: false, clientX: screen.width * 0.3, clientY: screen.height * 0.4 });
		let farthest = 1;
		for (let frame = 0; frame < 15; frame++) {
			camera.ease(1 / 60);
			farthest = Math.max(farthest, view.scale / view.most);
		}
		return { farthest: Number(farthest.toFixed(2)), after: Number((view.scale / view.most).toFixed(3)) };
	};
	expect(spring()).toEqual({ farthest: 1.03, after: 1 });
	// The page's look as Sonar gives it to the town (../sonar/look.ts): movement reduced.
	lookAt({ dark: () => false, reducedMotion: () => true });
	expect(spring()).toEqual({ farthest: 1, after: 1 });
	lookAt({ dark: () => false, reducedMotion: () => false });
});
