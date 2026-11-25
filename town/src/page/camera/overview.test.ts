// The whole town, framed: at every heading and height, nothing of it, steeple and cross included, goes past the screen's
// sides nor into the fade under the page's top bar. After a turn on a computer, a church's spire went under that fade:
// the camera framed the town's highest point as if it stood in the town's middle (13/11).

import { expect, test } from "bun:test";
import { uniform, vec3 } from "three/tsl";
import type { Agent, Kit, Topic } from "../render/kit";
import { THREE } from "../render/nodes";
import type { Part } from "../render/parts";

const page = globalThis as Record<string, unknown>;
page["matchMedia"] ??= () => ({ matches: false });
page["document"] ??= { querySelectorAll: () => [], documentElement: { dataset: {} } };
page["getComputedStyle"] ??= () => ({ paddingTop: "0" });
await import("../test-page");
const { town } = await import("../plan/town");
const { LOWEST, HIGHEST } = await import("./camera");
const { PITCH } = await import("../plan/grid");

// The band under the bar where the drawing fades in (styles/world-icon.css: --space-4).
const FADE = 16;

// Every piece the town puts, as its geometry's corners moved where it stands.
type Put = { points: Float32Array; matrix: THREE.Matrix4 };
function kitOf(puts: Put[]): Kit {
	let seed = 7;
	return {
		night: false,
		aspect: 1.6,
		random: () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296,
		uTime: uniform(0),
		scene: new THREE.Scene(),
		blank: vec3(0, 0, 0),
		along: () => 0,
		part: (geometry): Part => {
			const points = geometry.getAttribute("position").array as Float32Array;
			return {
				put: ({ x, y, z, rx = 0, ry = 0, s = 1 }) => {
					const scale = typeof s === "number" ? new THREE.Vector3(s, s, s) : new THREE.Vector3(...s);
					const matrix = new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, 0)), scale);
					puts.push({ points, matrix });
					return puts.length - 1;
				},
				move: () => {},
				set: () => {},
			};
		},
	};
}
const topicOf = (index: number, agents: number): Topic => ({
	name: `Subject ${index}`,
	agents: Array.from({ length: agents }, (_, at): Agent => ({ name: `Agent ${at}`, state: 1, seed: 0.13 + at * 0.29, children: [] })),
	working: agents,
	waiting: 0,
	reviewing: 0,
});

const SCREENS: [string, number, number, number][] = [
	["computer", 1440, 900, 56],
	["phone", 390, 788, 0],
	// The town's box on a phone of 390 × 844 px, under the page's top bar (108 px), as read on the page (13/11).
	["phone under its bar", 390, 736, 0],
];
for (const [subjects, agents] of [
	[2, 5],
	[20, 5],
	[100, 10],
] as const)
	test(`town: ${subjects * agents} agents, at every heading and height, the whole town stays on the screen, out of the bar's fade`, () => {
		const puts: Put[] = [];
		const world = town.build(
			kitOf(puts),
			Array.from({ length: subjects }, (_, index) => topicOf(index, agents)),
		);
		// The points in the world, once: the town does not move. The highest of each square of 25 cm: those under it never
		// rise higher on the screen but by a few hundredths of a metre.
		const cells = new Map<string, [number, number, number]>();
		const at = new THREE.Vector3();
		for (const { points: local, matrix } of puts)
			for (let index = 0; index < local.length; index += 3) {
				at.set(local[index]!, local[index + 1]!, local[index + 2]!).applyMatrix4(matrix);
				const key = `${Math.round(at.x * 4)},${Math.round(at.z * 4)}`;
				// The ground and below: the island's corners frame it already.
				if (at.y > 0.5 && at.y > (cells.get(key)?.[1] ?? 0)) cells.set(key, [at.x, at.y, at.z]);
			}
		const points = [...cells.values()].flat();
		const { view } = world;
		const out: string[] = [];
		for (const [name, width, height, bar] of SCREENS) {
			world.frame(width, height, bar, []);
			for (let step = 0; step < 24; step++)
				for (const pitch of [LOWEST, PITCH, (LOWEST + HIGHEST) / 2, HIGHEST]) {
					view.orient((step * Math.PI) / 12, pitch);
					view.set(1, view.whole);
					const [top, band] = view.band();
					const unit = view.unit(1);
					let [highest, side] = [Infinity, 0];
					for (let index = 0; index < points.length; index += 3) {
						const [u, v] = view.screenOf([points[index]!, points[index + 1]!, points[index + 2]!]);
						const [x, y] = [width / 2 + (u - view.aim[0]) / unit, top + band / 2 - (v - view.aim[1]) / unit];
						highest = Math.min(highest, y);
						side = Math.max(side, -x, x - width);
					}
					const fade = bar + FADE;
					if (highest < fade || side > 0)
						out.push(
							`${name}, heading ${step * 15}°, pitch ${((pitch * 180) / Math.PI).toFixed(0)}°: top ${highest.toFixed(0)} px (fade ends ${fade}), past a side ${side.toFixed(0)} px`,
						);
				}
		}
		view.orient(0, PITCH);
		expect(out).toEqual([]);
	}, 120_000);
