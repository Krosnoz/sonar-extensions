// The wheel zooms about the pointer, as on any map: from the whole town, step after step, the point of the town under
// the pointer stays under it until the camera meets its bound, and the screen never empties while the town goes on out
// of sight. A rule that kept the steeple under the bar took over at every step (12/11); a rule that kept only the
// screen's middle on the island left 35 to 49 % of the screen empty near a corner, or after a turn on a phone (12/11).

import { expect, test } from "bun:test";
import type { World } from "./kit";
import { SCREENS, TOWNS, built, hostOf, inside, page, planeAt, type Screen } from "./zoom-towns";

const { gestures } = await import("./gestures");
const { bound, coverFrom } = await import("./bounds");
const { PITCH } = await import("./grid");

// Where the pointer is, as a share of the screen's width and height: the middle, near the four corners, by the right
// edge, and low.
const POINTERS: [number, number][] = [
	[0.5, 0.5],
	[0.08, 0.15],
	[0.85, 0.2],
	[0.12, 0.8],
	[0.8, 0.85],
	[0.92, 0.55],
	[0.5, 0.9],
];
// The camera's heading and height: the default, turned by 35°, tilted down to 40°.
const TURNS: [string, number, number][] = [
	["default view", 0, PITCH],
	["turned view", (35 * Math.PI) / 180, PITCH],
	["tilted view", 0, (40 * Math.PI) / 180],
];
// The most background the screen may show once the island can cover it: 15 % on each side at most, and the corners a
// turned island leaves (0.30 measured, against 0.50 to 0.77 when only the screen's middle was held).
const EMPTIEST = 0.33;

// The share of the screen's band over the island's ground, on a grid of 40 × 40 points.
function groundShare(world: World, screen: Screen): number {
	const [top, height] = world.view.band();
	let count = 0;
	for (let i = 0; i < 40; i++)
		for (let j = 0; j < 40; j++)
			if (inside(world.view.outline(), planeAt(world, screen, ((i + 0.5) / 40) * screen.width, top + ((j + 0.5) / 40) * height))) count++;
	return count / 1600;
}

// `drift`: the farthest the point under the pointer moved (CSS px), while it lay on the island's ground and the bound
// let the camera go where the pointer asked; `emptiest`: the largest share of background, once the island could cover
// the screen; `opening`: below that level, how much more background than the whole town's the screen showed.
type Played = { drift: number; emptiest: number; opening: number; worst: string; empty: string };
function play(screen: Screen, subjects: number, agents: number, delta: number, yaw: number, pitch: number): Played {
	const world = built(subjects, agents);
	const { view } = world;
	// No control over the town: a test file run before in the same process may have left some.
	(page["document"] as { querySelectorAll: () => unknown[] }).querySelectorAll = () => [];
	world.frame(screen.width, screen.height, screen.bar, screen.controls);
	const host = hostOf(screen);
	const canvas = { clientWidth: screen.width, clientHeight: screen.height };
	const camera = gestures(canvas as HTMLCanvasElement, view, host as unknown as HTMLElement, () => []);
	const wheel = host.listeners.get("wheel")!;
	camera.carry(view.orient(yaw, pitch));
	camera.jump(1);
	const [top, height] = view.band();
	const from = coverFrom(view.outline(), [screen.width, height], view.unit(1));
	const whole = 1 - groundShare(world, screen);
	const played: Played = { drift: 0, emptiest: 0, opening: 0, worst: "", empty: "" };
	for (const [sx, sy] of POINTERS) {
		camera.jump(1);
		const [x, y] = [sx * screen.width, sy * screen.height];
		for (let step = 1; step <= 6; step++) {
			const under = planeAt(world, screen, x, y);
			const [scale, aim] = [view.scale, view.aim];
			wheel({ preventDefault: () => {}, deltaY: delta, deltaMode: 0, ctrlKey: false, clientX: x, clientY: y });
			// Long enough for the camera to reach its target, then to come out from under the controls.
			camera.ease(1000);
			camera.ease(1000);
			const where = `pointer ${sx}, ${sy}, step ${step}, level ${view.scale.toFixed(2)} (covered from ${from.toFixed(2)})`;
			// Where the pointer asked the camera to go: had the bound held it elsewhere, the point may slide.
			const shift = view.unit(scale) - view.unit(view.scale);
			const asked: [number, number] = [aim[0] + (x - screen.width / 2) * shift, aim[1] + (top + height / 2 - y) * shift];
			const kept = bound(view.outline(), view.whole, asked, view.scale, [screen.width, height], view.unit(1));
			const free = Math.hypot(kept[0] - asked[0], kept[1] - asked[1]) < 1e-6;
			const now = planeAt(world, screen, x, y);
			const moved = Math.hypot(now[0] - under[0], now[1] - under[1]) / view.unit(view.scale);
			if (free && inside(view.outline(), under) && moved > played.drift) [played.drift, played.worst] = [moved, where];
			if (!Number.isFinite(view.aim[0] + view.aim[1] + view.scale)) [played.emptiest, played.empty] = [1, `${where}: lost`];
			// The bound holds the screen where the pointer pointed off the island's ground; on it, the point stays under the
			// pointer (./camera-follow.ts, zoomAt), and the island shows as much of the screen as the pointer leaves it.
			const empty = inside(view.outline(), under) ? 0 : 1 - groundShare(world, screen);
			if (view.scale >= from && empty > played.emptiest) [played.emptiest, played.empty] = [empty, where];
			if (view.scale < from && empty - whole > played.opening) [played.opening, played.empty] = [empty - whole, where];
		}
	}
	// The town is shared with the next test: back to its default heading.
	view.orient(0, PITCH);
	return played;
}

// A step of the wheel: a mouse's notch (100), and the larger one of a fast spin or a touchpad (400).
for (const [name, screen] of SCREENS)
	for (const [subjects, agents] of TOWNS)
		for (const [turn, yaw, pitch] of TURNS)
			for (const delta of [-100, -400])
				test(`town: on a ${name}, ${subjects * agents} agents, ${turn}, the wheel (${delta}) zooms about the pointer and keeps the screen on the town`, () => {
					const { drift, emptiest, opening, worst, empty } = play(screen, subjects, agents, delta, yaw, pitch);
					if (process.env["ZOOM_MEASURE"])
						console.log(
							`${name} ${subjects * agents} ${turn} ${delta}: drift ${drift.toFixed(1)} px (${worst}), background ${emptiest.toFixed(2)}, opening ${opening.toFixed(2)} (${empty})`,
						);
					expect({ drift: Math.round(drift), worst: drift > 1 ? worst : "" }).toEqual({ drift: 0, worst: "" });
					// Once the island can cover the screen, the screen shows at most 15 % of background on each side; below,
					// never more than over the whole town.
					expect({ emptiest: emptiest <= EMPTIEST, opening: opening <= 0.02, empty }).toEqual({ emptiest: true, opening: true, empty });
				}, 120_000);
