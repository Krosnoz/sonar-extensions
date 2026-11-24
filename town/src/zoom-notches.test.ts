// Notch after notch from the whole town, each measured against the one before: the screen's empty bands stay balanced
// where the island is shorter than the screen (a phone's bottom quarter stayed empty, 13/11), and the bound's correction
// grows by at most JUMP px from a notch to the next (it jumped 70 px at a phone's third notch). The pointers: the middle,
// and the voice's corner of a phone, where each notch drifted 5 px.

import { expect, test } from "bun:test";
import type { World } from "./kit";
import { SCREENS, TOWNS, built, hostOf, inside, page, planeAt, type Screen } from "./zoom-towns";

const { gestures } = await import("./gestures");

// And six subjects, as the project the preview showed: a wide island, shorter than a phone's screen.
const NOTCH_TOWNS: [number, number][] = [...TOWNS, [6, 17]];

const JUMP = 40;
const NOTCH_POINTERS: [number, number][] = [
	[0.5, 0.6],
	[0.85, 0.86],
	[0.2, 0.3],
	[0.8, 0.7],
	// The middle of a phone of 844 px, 108 px under the top of its town's box.
	[0.5, 0.54],
];
// The empty rows at the top and the bottom of the band, and the empty columns at the left and the right, as shares.
function emptyBands(world: World, screen: Screen): [number, number] {
	const [top, height] = world.view.band();
	const filled = (i: number, j: number): boolean =>
		inside(world.view.outline(), planeAt(world, screen, ((i + 0.5) / 40) * screen.width, top + ((j + 0.5) / 40) * height));
	const rows = Array.from({ length: 40 }, (_, j) => Array.from({ length: 40 }, (_, i) => filled(i, j)).some(Boolean));
	const columns = Array.from({ length: 40 }, (_, i) => Array.from({ length: 40 }, (_, j) => filled(i, j)).some(Boolean));
	const lopsided = (line: boolean[]): number => Math.abs(line.indexOf(true) - (line.length - 1 - line.lastIndexOf(true))) / line.length;
	return [lopsided(columns), lopsided(rows)];
}
function notches(
	screen: Screen,
	subjects: number,
	agents: number,
	delta: number,
): { lopsided: number; jump: number; worst: string; drift: number; slid: string; cuts: string[] } {
	const world = built(subjects, agents);
	const { view } = world;
	(page["document"] as { querySelectorAll: () => unknown[] }).querySelectorAll = () => [];
	world.frame(screen.width, screen.height, screen.bar, screen.controls);
	const host = hostOf(screen);
	const camera = gestures({ clientWidth: screen.width, clientHeight: screen.height } as HTMLCanvasElement, view, host as unknown as HTMLElement, () => []);
	const wheel = host.listeners.get("wheel")!;
	const [top, height] = view.band();
	const out = { lopsided: 0, jump: 0, worst: "", drift: 0, slid: "", cuts: [] as string[] };
	for (const [sx, sy] of NOTCH_POINTERS) {
		camera.jump(1);
		const whole = emptyBands(world, screen);
		const [x, y] = [sx * screen.width, sy * screen.height];
		let before = 0;
		for (let step = 1; step <= 9; step++) {
			const [scale, aim] = [view.scale, view.aim];
			// A point of the background is drawn back to the town: only a point of the island may stay under the pointer.
			const ground = inside(view.outline(), planeAt(world, screen, x, y));
			wheel({ preventDefault: () => {}, deltaY: delta, deltaMode: 0, ctrlKey: false, clientX: x, clientY: y });
			camera.ease(1000);
			const shift = view.unit(scale) - view.unit(view.scale);
			const asked: [number, number] = [aim[0] + (x - screen.width / 2) * shift, aim[1] + (top + height / 2 - y) * shift];
			const correction = Math.hypot(view.aim[0] - asked[0], view.aim[1] - asked[1]) / view.unit(view.scale);
			const where = `pointer ${sx}, ${sy}, step ${step}, level ${view.scale.toFixed(2)}`;
			const bands = emptyBands(world, screen);
			// The town is centred where the pointer pointed off the island's ground; on it, the point stays under the pointer
			// (./camera-follow.ts, zoomAt): a court of the front edge slid out by the screen's bottom (14/11).
			const lopsided = ground ? 0 : Math.max(bands[0] - whole[0], bands[1] - whole[1]);
			if (lopsided > out.lopsided) [out.lopsided, out.worst] = [lopsided, `${where}: lopsided ${bands.map((each) => each.toFixed(2)).join(",")}`];
			// The notch before the level where the island first covers the kept screen too: the bound brought the camera
			// 248 px at once there, on a small town on a computer (13/11).
			if (step > 1 && ground && correction - before > out.jump)
				[out.jump, out.worst] = [correction - before, `${where}: correction ${before.toFixed(0)} → ${correction.toFixed(0)} px`];
			before = correction;
			// Where the pointer asked, the screen less its margins (./bounds.ts, KEEP) lay on the island, and the island was
			// longer than the screen both ways (shorter, it is centred): no bound was met, and the point under the pointer
			// must stay there.
			const unit = view.unit(view.scale);
			// And the screen lay over the island's extent on each axis, as a map's bounds hold it (MapLibre's maxBounds).
			const longer = ([0, 1] as const).every((axis) => {
				const [low, high] = [Math.min(...view.outline().map((each) => each[axis])), Math.max(...view.outline().map((each) => each[axis]))];
				const half = ((axis ? height : screen.width) * unit) / 2;
				return asked[axis] - half >= low && asked[axis] + half <= high;
			});
			const unmet =
				longer &&
				[-1, 1].every((i) => [-1, 1].every((j) => inside(view.outline(), [asked[0] + i * 0.35 * screen.width * unit, asked[1] + j * 0.35 * height * unit])));
			if (ground && unmet && correction > out.drift) [out.drift, out.slid] = [correction, `${where}: slid ${correction.toFixed(1)} px`];
			// The island is cut on an axis only where it is longer than the screen (a phone's notch cut its left side, the
			// screen 60 % empty above and below, 13/11). A pixel of rounding is let off.
			for (const [axis, span] of [
				[0, screen.width * unit],
				[1, height * unit],
			] as const) {
				const [low, high] = [Math.min(...view.outline().map((each) => each[axis])), Math.max(...view.outline().map((each) => each[axis]))];
				const cut = Math.max(view.aim[axis] - span / 2 - low, high - view.aim[axis] - span / 2) / unit;
				if (!ground && high - low <= span && cut > 1) out.cuts.push(`${where}: cut ${cut.toFixed(0)} px on axis ${axis}`);
			}
		}
	}
	return out;
}
for (const [name, screen] of SCREENS)
	for (const [subjects, agents] of NOTCH_TOWNS)
		for (const delta of [-200, -240, -400])
			test(`town: on a ${name}, ${subjects * agents} agents, notch after notch of the wheel (${delta}), the town stays centred where it is shorter, and the bound never jumps`, () => {
				const { lopsided, jump, worst, drift, slid, cuts } = notches(screen, subjects, agents, delta);
				if (process.env["ZOOM_MEASURE"])
					console.log(`${name} ${subjects * agents} ${delta}: lopsided ${lopsided.toFixed(2)}, jump ${jump.toFixed(0)} px (${worst}), drift ${slid}`);
				expect({ lopsided: lopsided <= 0.05, jump: jump <= JUMP || `${jump.toFixed(0)} px, ${worst}`, worst }).toEqual({ lopsided: true, jump: true, worst });
				// Short of a bound, the point under the pointer slides by under 2 px a notch (5 px on a phone, 13/11).
				expect({ drift: drift < 2, slid }).toEqual({ drift: true, slid });
				expect(cuts).toEqual([]);
			}, 120_000);
