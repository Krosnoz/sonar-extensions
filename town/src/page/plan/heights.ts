// The town's height on a grid of the ground: the highest point built over each cell. A figure's name is shown only when
// a ray from its head to the camera passes over every building: a name over a facade, its figure behind, named the wall.
// Boxes, not the drawn triangles: a few hundred map lookups per frame, where a ray against the meshes cost a frame.

// A cell's side, in world units: a quarter of a figure's height, so that a figure beside a wall is not under it.
const CELL = 0.25;
// How far the ray starts from the head: the figure's own cell and its neighbour may hold the wall it stands against.
const START = 2 * CELL;
// A building lower than the ray by this much does not hide the head: a roof's edge, a sill.
const MARGIN = 0.1;

export type HeightMap = {
	// A box [x0, z0] to [x1, z1] on the ground, `top` high: the cells whose middle lies in it.
	add: (x0: number, z0: number, x1: number, z1: number, top: number) => void;
	// Whether something built stands between the point `at` and the camera, seen along `toward` (from the point to the
	// camera, of length 1), higher than the ray by `margin` (MARGIN by default; a negative one counts a roof just under it).
	hides: (at: readonly [number, number, number], toward: readonly [number, number, number], margin?: number) => boolean;
	// The lamps' heads: a sign keeps clear of them, as it would hide their light (../signs/signs.ts).
	lamps: [number, number, number][];
};

// A cell's number, from its column and its row.
const key = (i: number, j: number): number => (i + 32768) * 65536 + (j + 32768);
export function heightMap(): HeightMap {
	const tops = new Map<number, number>();
	let highest = 0;
	return {
		lamps: [],
		add: (x0, z0, x1, z1, top) => {
			highest = Math.max(highest, top);
			for (let i = Math.ceil(x0 / CELL - 0.5); i <= Math.floor(x1 / CELL - 0.5); i++)
				for (let j = Math.ceil(z0 / CELL - 0.5); j <= Math.floor(z1 / CELL - 0.5); j++) {
					const at = key(i, j);
					if ((tops.get(at) ?? 0) < top) tops.set(at, top);
				}
		},
		hides: ([x, y, z], [dx, dy, dz], margin = MARGIN) => {
			const flat = Math.hypot(dx, dz);
			if (dy <= 0 || flat === 0) return false;
			// A step of half a cell along the ground, until the ray is above the highest building.
			const step = CELL / 2 / flat;
			for (let t = START / flat; y + t * dy <= highest - margin; t += step) {
				const top = tops.get(key(Math.floor((x + t * dx) / CELL), Math.floor((z + t * dz) / CELL)));
				if (top !== undefined && top > y + t * dy + margin) return true;
			}
			return false;
		},
	};
}
