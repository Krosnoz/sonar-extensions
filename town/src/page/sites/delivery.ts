// What a merge is delivered by (./sites.ts): a truck comes by the street of the subject's block with a pallet of
// bricks in the wall's colour, stops by the kerb, and leaves by the street's other end once the crane took its pallet.
import type { Grid } from "../plan/grid";
import type { Kit } from "../render/kit";
import { T } from "../render/shapes";
import { pallet, truck } from "./site-models";
import { ROAD } from "../plan/street";

type Point = [number, number, number];

// Far under the town: what waits there shows nowhere.
const AWAY = { x: 0, y: -4000, z: 0 };
// The near lane of a block's street and where a truck stops by the kerb, from the block's middle; how far along the
// block it stops.
const [LANE, KERB, PARK] = [3.25, 2.92, -3.6];
// The seconds a truck takes to come at least and at most, and to leave at least.
const [COME, LONGEST, LEAVE] = [3.4, 6.5, 1.6];
// How fast a truck drives (the town's cars go 1.6 to 3), and how far in from a street's end it shows, as a car.
const [DRIVE, INSET] = [4.6, 1.1];
// Where its pallet lies on its bed: how far behind its middle, how high.
const [BED, HIGH] = [0.28, 0.38];
const CAB = "#f4f2ee";

// A truck's way along its street: where it shows, parks and goes out, the street's middle, and the seconds it takes
// to come and to go.
export type Route = { from: number; park: number; out: number; z: number; come: number; go: number };
export function routeOf(grid: Grid, index: number): Route {
	const block = grid.of(index);
	const row = grid.all.filter((each) => each.j === block.j).map((each) => each.i);
	const [from, park, out] = [Math.max(...row) * T + T / 2 - INSET, block.x + PARK, Math.min(...row) * T - T / 2 + INSET];
	return {
		from,
		park,
		out,
		z: block.z,
		come: Math.min(LONGEST, Math.max(COME, (2 * (from - park)) / DRIVE)),
		go: Math.min(LONGEST, Math.max(LEAVE, (2 * (park - out)) / DRIVE)),
	};
}

const ease = (k: number): number => k * k * (3 - 2 * k);
const mix = (from: number, to: number, k: number): number => from + (to - from) * k;

// Where the truck is `t` seconds after it showed: along the near lane from its street's end, then to the kerb; once
// unloaded (`left` seconds ago, under 0 before), back to the lane and out by the street's other end. `size`: it grows
// as it shows and shrinks as it goes out, as a car.
export type Wheels = { x: number; y: number; z: number; heading: number; size: number };
export function wheelsOf(route: Route, t: number, left: number): Wheels {
	if (left < 0) {
		const k = Math.min(1, t / route.come);
		const side = ease(Math.min(1, Math.max(0, (t - (route.come - 1.4)) / 1.4)));
		return {
			x: mix(route.from, route.park, 1 - (1 - k) ** 2),
			y: ROAD,
			z: route.z + mix(LANE, KERB, side),
			heading: Math.PI - Math.sin(side * Math.PI) * 0.3,
			size: Math.max(0.001, Math.min(1, t / 0.25)),
		};
	}
	const k = Math.min(1, left / route.go);
	const side = ease(Math.min(1, left / 1.1));
	return {
		x: mix(route.park, route.out, k * k),
		y: ROAD,
		z: route.z + mix(KERB, LANE, side),
		heading: Math.PI + Math.sin(side * Math.PI) * 0.3,
		size: Math.max(0.001, Math.min(1, (route.go + 0.3 - left) / 0.25)),
	};
}
// Where its pallet lies on its bed.
export const bedOf = (wheels: Wheels): Point => [wheels.x + BED, wheels.y + HIGH, wheels.z];

// A subject's truck and its pallet: their instances (none before the first merge).
export type Load = { truck: number; pallet: number; colour: string };
export const loadOf = (colour: string): Load => ({ truck: -1, pallet: -1, colour });

// What shows and hides them, in the parts that hold every subject's.
export function deliveries(kit: Kit, count: number) {
	const trucks = kit.part(truck(), count);
	const pallets = kit.part(pallet(), count);
	// Put the first time a truck comes: a part without an instance is not drawn (../render/parts.ts).
	function made(load: Load): void {
		if (load.truck >= 0) return;
		[load.truck, load.pallet] = [trucks.put({ ...AWAY, color: CAB }), pallets.put({ ...AWAY, color: load.colour })];
	}
	return {
		// The truck where its wheels are, or nowhere.
		truck(load: Load, wheels: Wheels | null): void {
			if (wheels) made(load);
			if (load.truck >= 0) trucks.set(load.truck, wheels ? { x: wheels.x, y: wheels.y, z: wheels.z, ry: wheels.heading, s: wheels.size } : AWAY);
		},
		// The pallet at `at`, turned by `ry`, as much of it as is left (`size`), or nowhere.
		pallet(load: Load, at: Point | null, ry = 0, size = 1): void {
			if (at) made(load);
			if (load.pallet >= 0) pallets.set(load.pallet, at ? { x: at[0], y: at[1], z: at[2], ry, s: size } : AWAY);
		},
	};
}
export type Deliveries = ReturnType<typeof deliveries>;
