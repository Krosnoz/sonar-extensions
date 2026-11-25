// A subject's block is laid when the cubes of its cards land, which may be after the front has passed it: a card that
// stands right of its block on the page leaves late (./flights.ts), and neither a ground nor a building stands before
// its cubes. One texel per block of the town holds how much further the front must go before it lays the block there,
// in bands: its ground and all that stands on it (blue), its subject's building at the street (red) and at the town's
// top (green). The parts of a subject's block read it (../render/part-material.ts).
import { floor, max, mix, texture, vec2 } from "three/tsl";
import { THREE, type Node, type Vec3, type Vec4 } from "../render/nodes";
import { T } from "../render/shapes";

// The blocks a side of the texture holds: a town wider than that reads its delays again, block for block.
const SIDE = 128;
// How far past its block's edge a block's own parts reach, at most: the landing of its zebra crossing goes 0.39 into
// the block behind (../plan/street.ts#crossing). At 0.15, the landing of a block that waited was laid alone, in the air.
const REACH = 0.4;
// A wait is held in half floats, which filter on every card. Rounded up to 1/256 of a band, under 8 bands, a half float
// holds it whole: the flights (`read`, `ground`) and the material (`past`) read the same wait, never a shorter one.
const held = (bands: number): number => Math.min(7.99, Math.ceil(Math.max(0, bands) * 256) / 256);

export type Wait = { foot: number; top: number; ground: number };
// What a part that stands on a subject's block is of: its building, which rises as its bricks land; what stands on its
// ground or crosses it (a tree, a car); its land, which reaches past the block's edge. Only those parts read a wait:
// read by every part of the town, it took 0.7 ms more a frame at rest (18/11, 100 agents).
export type Waits = "building" | "ground" | "land";

export function delays() {
	const halves = new Uint16Array(SIDE * SIDE * 4);
	const map = new THREE.DataTexture(halves, SIDE, SIDE, THREE.RGBAFormat, THREE.HalfFloatType);
	map.wrapS = map.wrapT = THREE.RepeatWrapping;
	map.magFilter = map.minFilter = THREE.NearestFilter;
	map.needsUpdate = true;
	const wrapped = (at: number): number => ((Math.round(at / T) % SIDE) + SIDE) % SIDE;
	const texel = (x: number, z: number): number => (wrapped(z) * SIDE + wrapped(x)) * 4;
	const at = (x: number, z: number, channel: number): number => THREE.DataUtils.fromHalfFloat(halves[texel(x, z) + channel]!);
	return {
		// How many bands later the cube at `spot` is laid. `height`: its share of the way from the street to the town's
		// top; `as`: what it is of (`Waits`).
		past(spot: Vec3, height: Node, as: Waits): Node {
			const read = (dx: number, dz: number): Vec4 => {
				const block = floor(vec2(spot.x.add(dx), spot.z.add(dz)).div(T).add(0.5));
				return texture(map, block.add(0.5).div(SIDE));
			};
			if (as === "building") {
				const wait = read(0, 0);
				return mix(wait.r, wait.g, height);
			}
			if (as === "ground") return read(0, 0).b;
			// The longest wait a step each way: a block's lawn and its street reach past its edge, and waited with nobody
			// at the town's rim, a green bar left in the air. The seam between two blocks is laid when both are. The
			// steps are diagonal: a kerb's corner stone reaches past both edges, and read along x and z, never its own block.
			return max(max(read(REACH, REACH), read(-REACH, REACH)), max(read(REACH, -REACH), read(-REACH, -REACH))).b;
		},
		// The waits of the block at (x, z).
		set(x: number, z: number, wait: Wait): void {
			halves.set(
				[wait.foot, wait.top, wait.ground].map((bands) => THREE.DataUtils.toHalfFloat(held(bands))),
				texel(x, z),
			);
			map.needsUpdate = true;
		},
		// What `past` reads there, for the flights that land on the building and on the ground.
		read(x: number, z: number, height: number): number {
			const [foot, top] = [at(x, z, 0), at(x, z, 1)];
			return foot + (top - foot) * Math.min(1, Math.max(0, height));
		},
		ground: (x: number, z: number): number => at(x, z, 2),
	};
}
export type Delays = ReturnType<typeof delays>;
