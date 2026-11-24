// The inhabitants' lots: each place's crowd (a square, a venue) is one lot of every near part (./inhabitants.ts). A part
// draws all its instances in each pass, the sun's too: a town of 10 000 agents drew 10 000 inhabitants, four meshes each,
// to show the 1 000 of the screen at its nearest level. Each frame the lots out of view are sent to the end of the
// part's arrays, and the part draws only the first ones: the same pixels, a tenth of the triangles.
// three.js's own frustum culling takes a mesh whole; the instances of one mesh share their material's buffers (./parts.ts),
// so a lot cannot be a mesh of its own without a material of its own.
import { THREE } from "./nodes";

// How far past a crowd's own ground (its walkers' round, its tallest figure) a lot still counts as seen, in world units:
// a figure off the screen casts its shadow onto it, 3 units long at the most (the sun is 40° high).
const REACH = 6;
// The top of a lot, over the ground: a figure at the largest scale it grows to, with its bubble.
const TOP = 6;

export type Lots = ReturnType<typeof lots>;

export function lots() {
	// By lot: the box its figures have stood in, [minX, minZ, maxX, maxZ].
	const boxes: number[][] = [];
	let shown: boolean[] = [];
	let culled = false;
	const frustum = new THREE.Frustum();
	const matrix = new THREE.Matrix4();
	const box = new THREE.Box3();
	const arranged: (() => void)[] = [];
	return {
		// A figure of lot `lot` stands, or walks, at (x, z).
		note(lot: number, x: number, z: number): void {
			const at = boxes[lot];
			if (!at) boxes[lot] = [x, z, x, z];
			else {
				if (x < at[0]!) at[0] = x;
				if (z < at[1]!) at[1] = z;
				if (x > at[2]!) at[2] = x;
				if (z > at[3]!) at[3] = z;
			}
		},
		// The part keeps its arrays in the order of the lots it was given: `arrange` puts the lots seen first.
		attach: (arrange: () => void): void => void arranged.push(arrange),
		seen: (lot: number): boolean => !culled || shown[lot] === true,
		// Each frame, before the town's life: which lots the camera sees. Parts arrange their arrays when that changed.
		cull: (camera: THREE.OrthographicCamera): void => {
			matrix.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
			frustum.setFromProjectionMatrix(matrix, camera.coordinateSystem);
			let changed = !culled;
			const next = boxes.map((at, lot) => {
				if (!at) return false;
				box.min.set(at[0]! - REACH, -1, at[1]! - REACH);
				box.max.set(at[2]! + REACH, TOP, at[3]! + REACH);
				const is = frustum.intersectsBox(box);
				if (is !== (shown[lot] === true)) changed = true;
				return is;
			});
			culled = true;
			shown = next;
			if (changed) for (const arrange of arranged) arrange();
		},
	};
}

// One part's order of lots. An instance keeps the index `put` gave it; where it lies in the arrays is `slotOf`.
// A lot's instances are put one after the other, so a lot is one run of the arrays.
export function layout(all: Lots, capacity: number) {
	const lotOf = new Int32Array(capacity);
	const first: number[] = [];
	const size: number[] = [];
	const slot: number[] = [];
	return {
		lotOf: (index: number): number => lotOf[index]!,
		put(lot: number, index: number): void {
			if (first[lot] === undefined) [first[lot], size[lot], slot[lot]] = [index, 0, index];
			else if (first[lot] + size[lot]! !== index) throw new Error(`town: the instances of lot ${lot} are not put in a row`);
			size[lot]!++;
			lotOf[index] = lot;
		},
		slotOf: (index: number): number => {
			const lot = lotOf[index]!;
			return slot[lot]! + index - first[lot]!;
		},
		// The lots seen first (in the order they were put), then the others. `arrays`: each array with how many numbers an
		// instance takes in it. Returns how many instances are in the lots seen, which are the ones to draw.
		arrange(arrays: [THREE.TypedArray, number][]): number {
			const lotsOf = first.map((_, lot) => lot).filter((lot) => first[lot] !== undefined);
			const order = [...lotsOf.filter((lot) => all.seen(lot)), ...lotsOf.filter((lot) => !all.seen(lot))];
			const before = [...slot];
			let at = 0;
			let seen = 0;
			for (const lot of order) {
				slot[lot] = at;
				at += size[lot]!;
				if (all.seen(lot)) seen = at;
			}
			if (lotsOf.some((lot) => slot[lot] !== before[lot])) {
				for (const [array, stride] of arrays) {
					const old = array.slice();
					for (const lot of lotsOf) array.set(old.subarray(before[lot]! * stride, (before[lot]! + size[lot]!) * stride), slot[lot]! * stride);
				}
			}
			return seen;
		},
	};
}
