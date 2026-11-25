// The matter of a figure born or going in layers (./layers.ts). It goes back to what the figure belongs to, and comes
// from there: a robot's to its agent's chest, an inhabitant's to its building's door. Each grain leaves its plate when
// the plate's fill goes, and lands on its parent; at a birth it lands when the fill comes. The grains fly as sparks
// (./layer-sparks.ts), on the town's clock.
import { CELLS, END, fillAt, orderOf } from "./layers";
import { sparks, type Spark } from "./layer-sparks";
import { THREE } from "../render/nodes";
import { CARRIED } from "../render/shapes";

type Point = [number, number, number];
// Where a figure stands: its feet, where it looks, its scale.
export type Stand = { x: number; y: number; z: number; ry: number; s: number };

// The seconds a grain flies, a fifth more or less.
export const FLY = 0.75;
// The grains of a lattice's cell, on a face: few enough to see the town between them. Three a cell flew as one ribbon.
const DENSE = 0.6;
// How far round its parent's point a grain lands, in metres: they close into one beam.
const SPREAD = 0.04;
// The share of the grains that are sparks of light; the others are chips in the figure's colours.
const GLOWS = 0.7;
// The parts of a model that take the instance's colour (../render/shapes.ts#piece).
const TINTED = new Set([1, 2, 5, CARRIED]);

const [a, b, c, normal] = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];

// One grain of a model's point: `order`, when its plate goes (./layers.ts#orderOf).
function grainOf(point: Point, order: number, own: THREE.Color, parent: Point, at: number, born: boolean, random: () => number): Spark {
	const near: Point = [parent[0] + (random() - 0.5) * SPREAD, parent[1] + (random() - 0.5) * SPREAD, parent[2] + (random() - 0.5) * SPREAD];
	const flight = FLY * (0.8 + random() * 0.4);
	const filled = born ? at + END - fillAt(order) : at + fillAt(order);
	const shared = { colour: `#${own.getHexString()}`, seed: random(), glows: random() < GLOWS ? 1 : 0 };
	return born
		? { ...shared, start: near, end: point, t0: filled - flight, t1: filled }
		: { ...shared, start: point, end: near, t0: filled, t1: filled + flight };
}

// The grains of the figure of `model` standing at `stand`, born at the town's second `at` or going from it. `tint`: the
// instance's colour; `parent`: the point its matter comes from or goes to. `dense`: the grains of a lattice's cell; a
// figure's count made a wall of sparks of a model as large as a scaffold.
export function grainsOf(
	model: THREE.BufferGeometry,
	stand: Stand,
	tint: string,
	parent: Point,
	at: number,
	born: boolean,
	random: () => number,
	dense = DENSE,
): Spark[] {
	const [position, colours, kinds] = [model.getAttribute("position"), model.getAttribute("color"), model.getAttribute("aPart")];
	model.computeBoundingBox();
	const span: [number, number] = [model.boundingBox!.min.y, model.boundingBox!.max.y];
	const placed = new THREE.Matrix4().compose(
		new THREE.Vector3(stand.x, stand.y, stand.z),
		new THREE.Quaternion().setFromEuler(new THREE.Euler(0, stand.ry, 0)),
		new THREE.Vector3(stand.s, stand.s, stand.s),
	);
	const grains: Spark[] = [];
	const own = new THREE.Color();
	for (let corner = 0; corner + 2 < position.count; corner += 3) {
		a.fromBufferAttribute(position, corner);
		b.fromBufferAttribute(position, corner + 1).sub(a);
		c.fromBufferAttribute(position, corner + 2).sub(a);
		const wanted = (normal.crossVectors(b, c).length() / 2) * CELLS * CELLS * dense;
		const kind = Math.round(kinds.getX(corner));
		if (TINTED.has(kind)) own.set(tint);
		else own.fromBufferAttribute(colours, corner);
		for (let each = Math.floor(wanted) + (random() < wanted % 1 ? 1 : 0); each > 0; each--) {
			const [u, v] = [random(), random()];
			const [s, t] = u + v > 1 ? [1 - u, 1 - v] : [u, v];
			const [x, y, z] = [a.x + b.x * s + c.x * t, a.y + b.y * s + c.y * t, a.z + b.z * s + c.z * t];
			const point = new THREE.Vector3(x, y, z).applyMatrix4(placed).toArray();
			grains.push(grainOf(point, orderOf(x, y, z, span, kind === 2), own, parent, at, born, random));
		}
	}
	return grains;
}

// A figure's grains: whether it is born, the point they meet on, a grain's width in metres, the town's second their
// flight is over, and how far what they leave, then what they land on, has moved since they were made: both may walk.
export type Flight = { grains: Spark[]; born: boolean; parent: Point; size: number; until: number; moved: () => [Point, Point] };

// The grains in flight over the town, in the user's accent. `some`: 1 while there are any, for the glow (../render/pipeline.ts).
export function flying(scene: THREE.Scene, accent: THREE.Vector3, some: { value: number }) {
	let flights: { drawn: ReturnType<typeof sparks>; until: number; moved: () => [Point, Point] }[] = [];
	return {
		add({ grains, born, parent, size, until, moved }: Flight): void {
			// The seconds between which they land on their parent, or leave it at a birth.
			const times = grains.map((grain) => (born ? grain.t0 : grain.t1));
			const landing: [number, number] = [Math.min(...times), Math.max(...times)];
			flights.push({ drawn: sparks(scene, grains, { accent, size, born, parent, landing }), until, moved });
		},
		tick(seconds: number, camera: THREE.Camera): void {
			for (const flight of flights) {
				if (seconds > flight.until) flight.drawn.dispose();
				else flight.drawn.set(seconds, camera, flight.moved());
			}
			flights = flights.filter((flight) => seconds <= flight.until);
			some.value = flights.length ? 1 : 0;
		},
	};
}
