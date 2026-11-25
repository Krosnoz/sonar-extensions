// The map's background leaves with the page: it is cut into small cells over the screen, which leave as the page's edge
// reaches them (./edge.ts), and some fly to the town that rises behind the edge.
import type { Cell } from "./cells";
import type { Grain } from "./dust";
import type { Reach } from "./edge";
import { HOLD, launcher } from "./flights";
import { WATER } from "../plan/grid";
import type { Mounted } from "../render/kit";
import { THREE } from "../render/nodes";
import { colourOf } from "./rim";
import { mapFrame } from "../camera/size";

// The cells over the screen: about this many, and at most this many a side.
const CELLS = 60000;
const PLAN_SIDE = 512;

// The most points the background gives off: one cell in a few flies, the others only leave.
const FLYING = 16000;
// The seconds the page's edge runs ahead of the front that builds the town.
const FLIGHT = 1;
// The least and the most a point of the background flies, in seconds.
const [SHORT, LONG] = [0.65, 2.2];
// How far behind the edge a point of the background lands, in pixels: it flies to the town that rises there, in a
// cloud between the page and the town. Landing under its own cell, it hardly moved on the screen, and no cloud showed.
const [NEAR, FAR, ASIDE] = [120, 380, 120];

// The water under a point of the screen, seen from the camera.
function under(mounted: Mounted, host: HTMLElement): (x: number, y: number) => [number, number, number] | null {
	const box = host.getBoundingClientRect();
	const water = new THREE.Plane(new THREE.Vector3(0, 1, 0), -WATER);
	const ray = new THREE.Raycaster();
	const spot = new THREE.Vector3();
	return (x, y) => {
		ray.setFromCamera(new THREE.Vector2(((x - box.left) / box.width) * 2 - 1, 1 - ((y - box.top) / box.height) * 2), mounted.world.camera);
		return ray.ray.intersectPlane(water, spot) ? [spot.x, WATER + 0.05, spot.z] : null;
	};
}

// When the page's edge reaches a point of the screen: as the land rises under it. The whole page goes along one edge,
// from left to right (./edge.ts): the background leaves then, and a card at the same instant.
export function reachOf(mounted: Mounted, host: HTMLElement): Reach {
	const spotOf = under(mounted, host);
	return (x, y) => {
		const end = spotOf(x, y);
		return (end ? mounted.when(end) : 0) + HOLD - FLIGHT;
	};
}

export type Background = { grains: Grain[]; cells: Cell[]; size: number; last: number };

// `sea`: the water's colour, which a point takes as it lands; `edge`: when each point of the page leaves.
export function dotsOf(mounted: Mounted, host: HTMLElement, sea: string, edge: Reach): Background {
	const grid = mapFrame();
	// Cells of a few pixels.
	const size = Math.max(2, Math.ceil(Math.sqrt((grid.width * grid.height) / CELLS)), Math.ceil(Math.max(grid.width, grid.height) / PLAN_SIDE));
	const [cols, rows] = [Math.ceil(grid.width / size), Math.ceil(grid.height / size)];
	const [launch, spotOf] = [launcher(mounted, host), under(mounted, host)];
	const [colour, into] = [colourOf(getComputedStyle(document.body).backgroundColor), sea];
	const unit = mounted.world.view.unit(mounted.world.view.scale);
	let seed = 5;
	const random = (): number => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;
	const share = FLYING / (cols * rows);
	const [cells, grains]: [Cell[], Grain[]] = [[], []];
	let last = 0;
	for (let j = 0; j < rows; j++) {
		for (let i = 0; i < cols; i++) {
			const [x, y] = [grid.left + (i + 0.5) * size, grid.top + (j + 0.5) * size];
			const t0 = edge(x, y);
			const end = random() < share ? spotOf(x - NEAR - random() * (FAR - NEAR), y + (random() - 0.5) * ASIDE) : null;
			cells.push({ x, y, colour, text: false, t0, flies: end !== null });
			last = Math.max(last, t0);
			if (!end) continue;
			const t1 = t0 + SHORT + random() ** 2 * (LONG - SHORT);
			last = Math.max(last, t1);
			grains.push({ start: launch(end, { x, y }), end, t0, t1, colour, into, seed: random(), brick: false, from: size * unit, to: mounted.pixel * unit * 1.2 });
		}
	}
	return { grains, cells, size, last };
}
