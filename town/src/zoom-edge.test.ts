// The wheel on any inhabitant, those of a court or a venue at the island's front edge included: the point of the town
// under the pointer stays under it, at each notch, to the nearest level. A court at the front slid out by the screen's
// bottom while the user zoomed on it: its feet went from 775 to 1 265 px, none of its 4 inhabitants left on the screen
// (14/11).

import { expect, test } from "bun:test";
import { SCREENS, TOWNS, built, hostOf, page, planeAt } from "./zoom-towns";

const { gestures } = await import("./gestures");

// Within 2 px of the screen, at each notch.
const NEAR = 2;
// From the whole town, notches of a mouse's wheel to the nearest level.
const NOTCHES = 8;

for (const [name, screen] of SCREENS.filter(([name]) => name === "computer"))
	for (const [subjects, agents] of TOWNS)
		test(`town: on a ${name}, ${subjects * agents} agents, the wheel on any inhabitant keeps it under the pointer`, () => {
			const world = built(subjects, agents);
			const { view } = world;
			(page["document"] as { querySelectorAll: () => unknown[] }).querySelectorAll = () => [];
			world.frame(screen.width, screen.height, screen.bar, screen.controls);
			const host = hostOf(screen);
			const camera = gestures({ clientWidth: screen.width, clientHeight: screen.height } as HTMLCanvasElement, view, host as unknown as HTMLElement, () => []);
			const wheel = host.listeners.get("wheel")!;
			const [top, height] = view.band();
			camera.jump(1);
			// Where each inhabitant's feet stand on the screen, from the whole town: those the user can point at.
			const pointed = world.figures
				.map(({ at }) => {
					const [u, v] = view.screenOf([at[0], 0, at[2]]);
					return [screen.width / 2 + (u - view.aim[0]) / view.unit(1), top + height / 2 - (v - view.aim[1]) / view.unit(1)] as [number, number];
				})
				.filter(([x, y]) => x > 0 && x < screen.width && y > top && y < top + height)
				.filter((_, index) => index % Math.max(1, Math.round((subjects * agents) / 60)) === 0);
			const slid: string[] = [];
			let worst = 0;
			for (const [x, y] of pointed) {
				camera.jump(1);
				for (let notch = 1; notch <= NOTCHES; notch++) {
					const under = planeAt(world, screen, x, y);
					wheel({ preventDefault: () => {}, deltaY: -100, deltaMode: 0, ctrlKey: false, clientX: x, clientY: y });
					camera.ease(1000);
					const now = planeAt(world, screen, x, y);
					const moved = Math.hypot(now[0] - under[0], now[1] - under[1]) / view.unit(view.scale);
					worst = Math.max(worst, moved);
					if (moved > NEAR) slid.push(`${x.toFixed(0)}, ${y.toFixed(0)}, notch ${notch}, level ${view.scale.toFixed(2)}: ${moved.toFixed(0)} px`);
				}
			}
			if (process.env["ZOOM_MEASURE"]) console.log(`${subjects * agents} agents: ${pointed.length} pointed, worst ${worst.toFixed(1)} px`, slid.slice(0, 5));
			expect(slid.slice(0, 5)).toEqual([]);
		}, 120_000);
