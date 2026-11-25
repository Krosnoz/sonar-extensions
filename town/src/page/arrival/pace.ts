// When the town is built where. A front crosses the town along its depth, its band of construction behind it, the sea
// `lead` ahead. It slows down over what the screen shows: on a phone, which shows a quarter of the town, a constant speed
// built the part seen in two seconds. Out of the screen, it runs.
import type { World } from "../render/kit";
import { THREE } from "../render/nodes";

// The seconds the front takes over the whole town, when the screen shows it whole.
const ARRIVAL = 7;
// The least seconds it takes over the part the screen shows.
const SEEN = 5;
// How much faster it runs out of the screen, and the most seconds it takes over what lies left of it.
const AWAY = 3;
const LEFT = 0.6;
// The share of the town's depth the front crosses while a building rises: wide enough to see its storeys stack up.
const RISE = 0.3;
// The land rises over this share of the band, from under the sea to the street; the buildings over the rest.
export const LAND = 0.35;
// The street's height: the top of the land.
export const STREET = 0.2;
// The front of a block built while the town is open (../sites/plot.ts), in bands of its own. `bands`: how many a block's side
// takes; `old`: what stood there is whole until the front is that near; `relay`: the ground is laid again that far
// behind the front, along a line ragged by `ragged`; `fresh`: what stands on the new ground starts that far behind it.
export const PLOT = { bands: 2, old: 1.1, relay: 0.6, ragged: 0.25, fresh: 1.2 };

// The share of the band the front must have passed for the height `y` to be built: the land first, then the rest.
const need = (y: number, base: number, top: number): number =>
	y < STREET ? (LAND * Math.max(0, y - base)) / (STREET - base) : LAND + ((1 - LAND) * (y - STREET)) / Math.max(0.1, top - STREET);

export function pace(world: World, along: (x: number, y: number, z: number) => number) {
	const [from, to] = world.range;
	const band = (to - from) * RISE;
	const lead = band * 0.7;
	const [start, end] = [from - lead, to + band * 1.4];
	// The front's positions and their times: a straight line until `focus` slows it over the screen.
	let knots: [number, number][] = [
		[0, start],
		[ARRIVAL, end],
	];
	const map = (value: number, input: 0 | 1): number => {
		const output = input === 0 ? 1 : 0;
		const next = knots.findIndex((knot) => knot[input] >= value);
		if (next <= 0) return next === 0 ? knots[0]![output] : knots.at(-1)![output];
		const [a, b] = [knots[next - 1]!, knots[next]!];
		return a[output] + ((value - a[input]) / (b[input] - a[input])) * (b[output] - a[output]);
	};
	// The time the front reaches `position`.
	const at = (position: number): number => map(position, 1);
	return {
		band,
		lead,
		total: (): number => knots.at(-1)![0],
		front: (building: number): number => map(building, 0),
		// The inverse of the parts' construction (../render/part-material.ts#built), with its mean noise. `past`: the bands a
		// subject's building is laid later by (./delays.ts).
		when: (spot: [number, number, number], origin = spot, past = 0): number =>
			at(along(...origin) + (need(spot[1], world.base, world.top) + 0.03 + past) * band),
		// Slows the front over what the camera shows now, on the ground and at the roofs.
		focus(camera: THREE.Camera): void {
			camera.updateMatrixWorld();
			const ray = new THREE.Raycaster();
			const hit = new THREE.Vector3();
			const seen: number[] = [];
			for (const y of [world.base, world.top]) {
				const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -y);
				for (const corner of [
					[-1, -1],
					[1, -1],
					[-1, 1],
					[1, 1],
				] as const) {
					ray.setFromCamera(new THREE.Vector2(...corner), camera);
					if (ray.ray.intersectPlane(plane, hit)) seen.push(along(hit.x, hit.y, hit.z));
				}
			}
			if (seen.length === 0) return;
			// The page leaves as the land rises under it, not ahead: the slow part starts at the screen's left edge.
			const [a, b] = [Math.max(start, Math.min(...seen)), Math.min(end, Math.max(...seen) + band)];
			if (b <= a) return;
			const speed = (end - start) / ARRIVAL;
			// What lies left of the screen is built at once: the screen does not wait for it.
			const [before, during] = [Math.min(LEFT, (a - start) / (speed * AWAY)), Math.max(SEEN, (b - a) / speed)];
			knots = [
				[0, start],
				[before, a],
				[before + during, b],
				[before + during + (end - b) / (speed * AWAY), end],
			];
		},
	};
}
