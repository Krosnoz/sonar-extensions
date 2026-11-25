// The street lamps' light on the ground by night, as a map seen from above: each pool of light of a model
// (../plan/street-furniture.ts#pool) is laid in it where its instance stands, and the ground's shader reads it under each of its pixels
// (./part-material.ts#material). A disc drawn over the ground lit what stood in it too, as an orange band at the foot of a
// post or a trunk, added the same light to the grass and the paving, and kept the post's shadow in the pool.
import { texture, uniform } from "three/tsl";
import { THREE, type Node, type Vec3 } from "./nodes";
import { T } from "./shapes";

// A pool in its model: its middle, its half-widths on x and z, its colour.
type Disc = { x: number; z: number; rx: number; rz: number; color: [number, number, number] };
// A pool where its instance stands. `old`: of what stands on the block held for a subject to come.
type Placed = Disc & { old: boolean };
// The block the town holds for a subject to come (../sites/plot.ts): its middle (x, z), and whether its subject's building is
// built.
export type Held = [number, number, boolean];

// Whether a pool lights the ground. On the held block, what stood there lights it until the building is built, and
// the subject's own lamps from then on: a lamp not drawn lit the ground under it (22/11).
export const lights = (disc: { x: number; z: number; old: boolean }, held: Held | null): boolean =>
	!held || Math.abs(disc.x - held[0]) > T / 2 || Math.abs(disc.z - held[1]) > T / 2 || disc.old !== held[2];

// Texels per metre, and the map's largest side: a pool 2.25 wide spans 36 texels, and the map of a hundred subjects
// stays under 2048.
const DENSITY = 8;
const LARGEST = 2048;
// A texel keeps the square root of half its light: the faint edge of a pool keeps its precision in 8 bits (no band),
// and two pools that cross can add up to 2.
const RANGE = 2;

// The discs of a model's pools, given as the triangles of ./pool-split.ts#pooled: a disc is a fan of triangles in a row, each
// sharing a corner with the one before; a triangle that shares none starts the next disc. A disc is its box.
export function discsOf(pools: THREE.BufferGeometry): Disc[] {
	const position = pools.getAttribute("position");
	const color = pools.getAttribute("color");
	const corner = (at: number): string => `${position.getX(at)},${position.getZ(at)}`;
	const discs: Disc[] = [];
	let box = new THREE.Box2();
	let first = 0;
	let before = new Set<string>();
	const close = (): void => {
		if (box.isEmpty()) return;
		const [middle, size] = [box.getCenter(new THREE.Vector2()), box.getSize(new THREE.Vector2())];
		discs.push({ x: middle.x, z: middle.y, rx: size.x / 2, rz: size.y / 2, color: [color.getX(first), color.getY(first), color.getZ(first)] });
	};
	for (let at = 0; at < position.count; at += 3) {
		const corners = new Set([corner(at), corner(at + 1), corner(at + 2)]);
		if (![...corners].some((each) => before.has(each))) {
			close();
			box = new THREE.Box2();
			first = at;
		}
		for (let each = at; each < at + 3; each++) box.expandByPoint(new THREE.Vector2(position.getX(each), position.getZ(each)));
		before = corners;
	}
	close();
	return discs;
}

// The map of the `placed` pools: its texture, where its corner lies in the town, and its size there.
function painted(placed: Disc[]): { made: THREE.DataTexture; from: [number, number]; size: [number, number] } {
	const [minX, minZ] = [Math.min(...placed.map((d) => d.x - d.rx)) - 1, Math.min(...placed.map((d) => d.z - d.rz)) - 1];
	const [maxX, maxZ] = [Math.max(...placed.map((d) => d.x + d.rx)) + 1, Math.max(...placed.map((d) => d.z + d.rz)) + 1];
	const density = Math.min(DENSITY, LARGEST / Math.max(maxX - minX, maxZ - minZ));
	const [w, h] = [Math.ceil((maxX - minX) * density), Math.ceil((maxZ - minZ) * density)];
	const light = new Float32Array(w * h * 3);
	for (const disc of placed) {
		const [i0, i1] = [Math.max(0, Math.floor((disc.x - disc.rx - minX) * density)), Math.min(w - 1, Math.ceil((disc.x + disc.rx - minX) * density))];
		const [j0, j1] = [Math.max(0, Math.floor((disc.z - disc.rz - minZ) * density)), Math.min(h - 1, Math.ceil((disc.z + disc.rz - minZ) * density))];
		for (let j = j0; j <= j1; j++)
			for (let i = i0; i <= i1; i++) {
				const [dx, dz] = [((i + 0.5) / density + minX - disc.x) / disc.rx, ((j + 0.5) / density + minZ - disc.z) / disc.rz];
				const left = Math.max(0, 1 - Math.hypot(dx, dz));
				// A wide, soft fall, as the disc had: half as strong at a third of the radius as at the foot.
				const strength = left ** 1.5;
				for (let c = 0; c < 3; c++) light[(j * w + i) * 3 + c]! += disc.color[c]! * strength;
			}
	}
	const data = new Uint8Array(w * h * 4);
	for (let at = 0; at < w * h; at++) {
		for (let c = 0; c < 3; c++) data[at * 4 + c] = Math.round(Math.sqrt(Math.min(1, light[at * 3 + c]! / RANGE)) * 255);
		data[at * 4 + 3] = 255;
	}
	const made = new THREE.DataTexture(data, w, h);
	made.magFilter = made.minFilter = THREE.LinearFilter;
	made.needsUpdate = true;
	return { made, from: [minX, minZ], size: [w / density, h / density] };
}

export function lamplight() {
	const placed: Placed[] = [];
	// Until the town is built the map is one dark texel; the shader keeps reading the same node, given its map then.
	const blank = new THREE.DataTexture(new Uint8Array(4), 1, 1);
	blank.needsUpdate = true;
	const map = texture(blank);
	const from = uniform(new THREE.Vector2(0, 0));
	const size = uniform(new THREE.Vector2(1, 1));
	const corner = new THREE.Vector3();
	const point = new THREE.Vector3();
	let pending = false;
	let held: Held | null = null;
	const draw = (): void => {
		pending = false;
		const shown = placed.filter((disc) => lights(disc, held));
		if (!shown.length) return void (map.value = blank);
		const done = painted(shown);
		map.value = done.made;
		from.value.set(...done.from);
		size.value.set(...done.size);
	};

	return {
		// The pools of a model, laid where its instance stands. The map is drawn once the town has placed what it builds now.
		// `old`: of what stands on the block the town holds for a subject to come.
		place(discs: Disc[], matrix: THREE.Matrix4, old = false): void {
			for (const disc of discs) {
				corner.set(disc.x, 0, disc.z).applyMatrix4(matrix);
				let [rx, rz] = [0, 0];
				for (const [ax, az] of [
					[disc.rx, 0],
					[0, disc.rz],
				] as const) {
					point
						.set(disc.x + ax, 0, disc.z + az)
						.applyMatrix4(matrix)
						.sub(corner);
					[rx, rz] = [rx + Math.abs(point.x), rz + Math.abs(point.z)];
				}
				placed.push({ x: corner.x, z: corner.z, rx, rz, color: disc.color, old });
			}
			if (!discs.length || pending) return;
			pending = true;
			queueMicrotask(draw);
		},
		// The town holds the block at (x, z); `built`: its subject's building is. The map is drawn again when this changes.
		hold(x: number, z: number, built: boolean): void {
			if (held?.[0] === x && held[1] === z && held[2] === built) return;
			held = [x, z, built];
			if (!placed.length || pending) return;
			pending = true;
			queueMicrotask(draw);
		},
		// The lamps' light on the ground under a pixel at `xz` in the town.
		at(xz: Node<"vec2">): Vec3 {
			const kept = map.sample(xz.sub(from).div(size)).rgb;
			return kept.mul(kept).mul(RANGE);
		},
	};
}
export type Lamplight = ReturnType<typeof lamplight>;
