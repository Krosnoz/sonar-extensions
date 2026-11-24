// The sparks a figure's matter flies as, when it is born or goes in layers (./layer-grains.ts). Each one is a short
// streak of light drawn along its own way, longer as it goes faster, with a pale halo round it: most of them in the
// accent the user chose, some in the colour of what they leave, which take the accent as they fly. They all meet on
// one point of what the figure belongs to, where a flare shines while they land. Everything is a function of the
// town's seconds.
import { clamp, cross, float, max, mix, positionLocal, smoothstep, step, uniform, uv, vec3 } from "three/tsl";
import { THREE, perInstance, type Node, type Vec3 } from "./nodes";

type Point = [number, number, number];
// `colour`: of what it leaves, or lands on at a birth; `glows`: 1 a spark of light, 0 a chip of the figure.
export type Spark = { start: Point; end: Point; t0: number; t1: number; colour: string; seed: number; glows: number };
// `size`: a spark's width, in metres; `parent`: the point they meet on; `landing`: the town's seconds between which
// they land there, or leave it at a birth.
export type Look = { accent: THREE.Vector3; size: number; born: boolean; parent: Point; landing: [number, number] };

// The seconds of its way a streak covers, and the flare's width, in metres. A streak as wide as a cell of the lattice
// read as confetti, and joined the others in one pale mass that hid the figure: a spark is thin, and long in flight.
const [TRAIL, FLARE] = [0.045, 0.5];
// A halo's width, in sparks' widths, and how much of it is seen.
const HALO = [3.2, 0.3] as const;
// How much brighter than white a spark's light is: over the thresholds of the glow pass (./pipeline.ts), which
// spreads it round the spark.
const BRIGHT = 3;

function inputs(given: Spark[], { accent, size, born }: Look) {
	const count = Math.max(1, given.length);
	const [A, B, C, D] = [new Float32Array(count * 4), new Float32Array(count * 4), new Float32Array(count * 4), new Float32Array(count * 4)];
	const linear = new THREE.Color();
	given.forEach((spark, at) => {
		linear.set(spark.colour);
		A.set([...spark.start, spark.t0], at * 4);
		B.set([...spark.end, spark.t1], at * 4);
		C.set([linear.r, linear.g, linear.b, spark.seed], at * 4);
		D.set([spark.glows, 0, 0, 0], at * 4);
	});
	return {
		count,
		a: perInstance(A, "vec4"),
		b: perInstance(B, "vec4"),
		c: perInstance(C, "vec4"),
		d: perInstance(D, "vec4"),
		seconds: uniform(0),
		accent: uniform(accent.clone()),
		size: uniform(size),
		born: uniform(born ? 1 : 0),
		// How far what the sparks leave, and what they land on, has moved since they were made.
		startMoved: uniform(new THREE.Vector3()),
		endMoved: uniform(new THREE.Vector3()),
		right: uniform(new THREE.Vector3(1, 0, 0)),
		up: uniform(new THREE.Vector3(0, 1, 0)),
		back: uniform(new THREE.Vector3(0, 0, 1)),
		flare: uniform(new THREE.Vector3()),
		strength: uniform(0),
	};
}
type Inputs = ReturnType<typeof inputs>;

const see = (material: THREE.MeshBasicNodeMaterial): THREE.MeshBasicNodeMaterial => {
	material.transparent = true;
	material.depthWrite = false;
	material.depthTest = false;
	return material;
};

// A streak, `wide` times a spark's width and `seen` at most: the spark itself, or its halo.
function streak({ a, b, c, d, seconds, accent, size, born, startMoved, endMoved, right, up, back }: Inputs, wide: number, seen: number) {
	const [from, to] = [a.xyz.add(startMoved), b.xyz.add(endMoved)];
	const reach = to.sub(from);
	const across = reach.sub(back.mul(reach.dot(back))).length();
	// A bow, each spark's own: they fan out of what they leave and close on the point they meet on.
	const bow = from
		.add(reach.mul(0.5))
		.add(up.mul(across.mul(c.w.mul(0.4).add(0.05))))
		.add(right.mul(across.mul(c.w.mul(7.3).fract().sub(0.5).mul(0.7))));
	const share = (time: Node): Node => clamp(time.sub(a.w).div(max(b.w.sub(a.w), 0.01)), 0, 1);
	// It leaves slowly and falls into what it goes to; at a birth it shoots out and lands slowly.
	const eased = (k: Node): Node => mix(k.mul(k), float(1).sub(float(1).sub(k).mul(float(1).sub(k))), born);
	const at = (time: Node): Vec3 => {
		const e = eased(share(time));
		const u = float(1).sub(e);
		return from
			.mul(u.mul(u))
			.add(bow.mul(u.mul(e).mul(2)))
			.add(to.mul(e.mul(e)));
	};
	const k = share(seconds);
	const [now, earlier] = [at(seconds), at(seconds.sub(TRAIL))];
	const way = now.sub(earlier);
	const flat = way.sub(back.mul(way.dot(back)));
	const long = flat.length();
	const along = mix(right, flat.div(max(long, 0.0001)), step(0.0001, long));
	const shown = step(a.w, seconds).mul(step(seconds, b.w));
	// Each spark has its own width, from 0.6 to 1.5 of the others'.
	const width = size.mul(wide).mul(shown).mul(c.w.mul(3.7).fract().mul(0.9).add(0.6));
	const material = see(new THREE.MeshBasicNodeMaterial());
	material.positionNode = now
		.add(earlier)
		.mul(0.5)
		.add(along.mul(positionLocal.x).mul(long.add(width)))
		.add(cross(back, along).mul(positionLocal.y).mul(width));
	// A comet: white at its head, the accent along its tail, which thins out.
	const head = smoothstep(0.45, 0.95, uv().x);
	const light = wide > 1 ? accent : mix(accent, vec3(1), head.mul(0.8)).mul(BRIGHT);
	// A chip takes the light as it leaves its figure; at a birth it leaves the light for its figure's colour.
	const lit = smoothstep(0.15, 0.7, mix(k, float(1).sub(k), born));
	material.colorNode = mix(mix(c.xyz, light, lit), light, wide > 1 ? float(1) : d.x);
	const soft = float(1).sub(smoothstep(wide > 1 ? 0 : 0.25, 0.5, uv().y.sub(0.5).abs()));
	material.opacityNode = soft
		.mul(smoothstep(0, 0.7, uv().x))
		.mul(float(1).sub(smoothstep(0.9, 1, uv().x)))
		.mul(smoothstep(0, 0.12, k))
		.mul(float(1).sub(smoothstep(0.88, 1, k)))
		.mul(seen);
	return material;
}

// The flare on the point the sparks meet on: a round light, white at its middle.
function flareOf({ accent, right, up, flare, strength }: Inputs) {
	const material = see(new THREE.MeshBasicNodeMaterial());
	material.positionNode = vec3(flare).add(right.mul(positionLocal.x).add(up.mul(positionLocal.y)).mul(strength.mul(FLARE)));
	const far = clamp(uv().sub(0.5).length().mul(2), 0, 1);
	const near = float(1).sub(far);
	material.colorNode = mix(accent, vec3(1), near.mul(near).mul(near)).mul(BRIGHT);
	material.opacityNode = near.mul(near).mul(strength);
	return material;
}

type Moved = [number, number, number];
// `set`'s `moved`: how far what the sparks leave, then what they land on, has moved since they were made.
export function sparks(
	scene: THREE.Scene,
	given: Spark[],
	look: Look,
): { set: (seconds: number, camera: THREE.Camera, moved: [Moved, Moved]) => void; dispose: () => void } {
	const values = inputs(given, look);
	const streaks = [streak(values, HALO[0], HALO[1]), streak(values, 1, 1)].map((material) => {
		const mesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), material, values.count);
		mesh.count = given.length;
		return mesh;
	});
	const meshes = [...streaks, new THREE.Mesh(new THREE.PlaneGeometry(1, 1), flareOf(values))];
	meshes.forEach((mesh, order) => {
		mesh.frustumCulled = false;
		mesh.renderOrder = order;
		scene.add(mesh);
	});
	const [first, last] = look.landing;
	return {
		set(seconds, camera, moved) {
			values.seconds.value = seconds;
			values.startMoved.value.set(...moved[0]);
			values.endMoved.value.set(...moved[1]);
			const m = camera.matrixWorld.elements;
			values.right.value.set(m[0], m[1], m[2]).normalize();
			values.up.value.set(m[4], m[5], m[6]).normalize();
			values.back.value.set(m[8], m[9], m[10]).normalize();
			const [dx, dy, dz] = moved[look.born ? 0 : 1];
			values.flare.value.set(look.parent[0] + dx, look.parent[1] + dy, look.parent[2] + dz);
			// The flare swells as the first sparks land, and fades with the last.
			const landing = Math.min(1, Math.max(0, (seconds - first) / Math.max(0.01, last - first)));
			values.strength.value = Math.sqrt(Math.sin(Math.PI * landing));
		},
		dispose() {
			for (const mesh of meshes) {
				mesh.removeFromParent();
				mesh.geometry.dispose();
				mesh.material.dispose();
			}
		},
	};
}
