// The dust a page breaks into. Each point, one pixel of the town's drawing, leaves its cell of the page in the cell's
// colour, rises towards the user, swirls a little, then comes down from above into its place: on a wall or the roof of
// its building, on its inhabitant or on the ground of its block, just when the front lays a cube there. On its way it
// takes the colour of what it becomes, through the cold blue of a cloud: in the page's own pale colours, the cloud did
// not show on the page. It leaves hot, in the user's accent, as the edge that eats the page. Two copies, a little late,
// draw its trace. Everything is a function of the construction's time, so the way back runs the flight backwards.
// What builds a building or an inhabitant is a brick instead: a small cube several times a point's size, in the accent,
// sharp and without a trace, which leaves in a spray high over its card and comes down onto its place. Dust and bricks
// leave at the same instant, and the eye tells the two dissolves apart (18/11).
import { clamp, float, fract, max, mix, mx_noise_vec3, positionGeometry, positionLocal, sin, step, uniform, vec3, smoothstep } from "three/tsl";
import { THREE, perInstance } from "../render/nodes";

// `colour`: its cell's, on the page; `into`: what is built where it lands, whose colour it takes on its way. `from`,
// `to`: its side as it leaves and as it lands.
export type Grain = {
	start: [number, number, number];
	end: [number, number, number];
	t0: number;
	t1: number;
	colour: [number, number, number];
	into: string;
	seed: number;
	brick: boolean;
	from: number;
	to: number;
	// How much of a brick's spray it keeps (all of it when omitted): a pallet's bricks fly lower (../sites/pouring.ts).
	spray?: number;
};
const LAND = 0.1;
// How much of the accent a brick takes, and how high its spray rises over its card, in its own sides: the least, and
// what its own draw adds.
const ACCENT = 0.85;
const [RISE, MORE] = [18, 22];
// The cloud's colour, by day and by night, and how much of it a point takes midway.
const COLD = { day: [78, 112, 168], night: [190, 225, 255] } as const;
const CLOUD = 0.5;
// How much of the accent a point takes as it leaves, and the share of its flight it keeps it.
const [HEAT, HEATED] = [0.6, 0.07];

const linearOf = ([r, g, b]: readonly [number, number, number]): THREE.Color => new THREE.Color().setRGB(r / 255, g / 255, b / 255, THREE.SRGBColorSpace);

// Each grain's flight, one vec4 per grain and per attribute, the camera's axes, and the colours of the cloud and of the
// edge (`hot`).
function inputs(grains: Grain[], night: boolean, hot: readonly [number, number, number]) {
	const count = Math.max(1, grains.length);
	const make = (): Float32Array => new Float32Array(count * 4);
	const [A, B, C, D, E] = [make(), make(), make(), make(), make()];
	const linear = new THREE.Color();
	grains.forEach((grain, at) => {
		linear.setRGB(grain.colour[0] / 255, grain.colour[1] / 255, grain.colour[2] / 255, THREE.SRGBColorSpace);
		A.set([...grain.start, grain.t0], at * 4);
		B.set([...grain.end, grain.t1], at * 4);
		C.set([linear.r, linear.g, linear.b, grain.seed], at * 4);
		linear.set(grain.into);
		D.set([grain.from, grain.to, grain.brick ? 1 : 0, grain.spray ?? 1], at * 4);
		E.set([linear.r, linear.g, linear.b, 0], at * 4);
	});
	return {
		count,
		a: perInstance(A, "vec4"),
		b: perInstance(B, "vec4"),
		c: perInstance(C, "vec4"),
		d: perInstance(D, "vec4"),
		into: perInstance(E, "vec4"),
		built: uniform(0),
		cold: uniform(linearOf(night ? COLD.night : COLD.day)),
		hot: uniform(linearOf(hot)),
		right: uniform(new THREE.Vector3(1, 0, 0)),
		up: uniform(new THREE.Vector3(0, 1, 0)),
		back: uniform(new THREE.Vector3(0, 0, 1)),
	};
}
type Inputs = ReturnType<typeof inputs>;

// The point `lag` seconds ago: the point itself, or a copy of its tail.
function point({ a, b, c, d, into, built, right, up, back, cold, hot }: Inputs, lag: number, night: boolean): THREE.MeshBasicNodeMaterial {
	const time = built.sub(lag);
	const k = clamp(time.sub(a.w).div(max(b.w.sub(a.w), 0.01)), 0, 1);
	const e = k.mul(k).mul(float(3).sub(k.mul(2)));
	const u = float(1).sub(e);
	// A curve in four points: it leaves the page towards the user and up, and comes down onto its place from above.
	const reach = b.xyz.sub(a.xyz);
	const across = reach.sub(back.mul(reach.dot(back))).length();
	// 1 for a brick, 0 for dust.
	const brick = d.z;
	// A brick's spray: up the screen, by its own draw.
	const spray = up.mul(
		brick
			.mul(d.x)
			.mul(d.w)
			.mul(fract(c.w.mul(7.31)).mul(MORE).add(RISE)),
	);
	const p1 = a.xyz
		.add(reach.mul(0.2))
		.add(up.mul(across.mul(c.w.mul(0.2).add(0.15))))
		.add(right.mul(across.mul(c.w.sub(0.5).mul(0.3))))
		.add(spray);
	const p2 = b.xyz.add(vec3(0, float(1.6).add(c.w.mul(2.2)), 0)).add(spray.mul(0.8));
	const curve = a.xyz
		.mul(u.mul(u).mul(u))
		.add(p1.mul(u.mul(u).mul(e).mul(3)))
		.add(p2.mul(u.mul(e).mul(e).mul(3)))
		.add(b.xyz.mul(e.mul(e).mul(e)));
	// A swirl, strongest midway: the crossing turns instead of sliding. A brick hardly swirls: it is thrown.
	const fly = sin(e.mul(Math.PI));
	const centre = curve.add(
		mx_noise_vec3(a.xyz.mul(0.08).add(vec3(0, 0, time.mul(0.7))))
			.mul(fly)
			.mul(across.mul(0.06))
			.mul(float(1).sub(brick.mul(0.8))),
	);
	// A point of one pixel of the drawing, always facing the user.
	const v = positionLocal;
	const landed = clamp(time.sub(b.w).div(LAND), 0, 1);
	const shown = step(a.w, time).mul(step(time, b.w.add(LAND)));
	// A copy of the tail shows only while it flies, once it has left the page. A brick has none: it stays sharp.
	const tail = lag > 0 ? step(time, b.w).mul(step(0.08, k)).mul(float(1).sub(brick)) : float(1);
	// Dust thins as it leaves; a brick thins all along its flight.
	const size = mix(d.x, d.y, smoothstep(brick.mul(0.1).add(0.1), brick.mul(0.3).add(0.6), k))
		.mul(float(1).sub(landed.mul(0.5)))
		.mul(shown)
		.mul(tail);
	const material = new THREE.MeshBasicNodeMaterial();
	material.positionNode = centre.add(right.mul(v.x).add(up.mul(v.y)).mul(size));
	// It takes the colour of the wall, the roof or the paving as it comes; its tail is a little darker.
	// The points are not lit: by night, what they become takes the moonlight's shade the town's walls take, or a
	// beige roof lands as white dots on a dark blue one.
	const shade = night ? vec3(0.44, 0.49, 0.73) : vec3(1, 1, 1);
	// It lands without a flash: a whole ground lands in one or two frames, and its flash read as a white blink.
	const becoming = mix(c.xyz, into.xyz.mul(shade), smoothstep(0.15, 0.75, k));
	const clouded = mix(becoming, cold, sin(k.mul(Math.PI)).mul(CLOUD));
	const dusty = mix(
		clouded,
		hot,
		float(1)
			.sub(smoothstep(0, HEATED, k))
			.mul(HEAT),
	).mul(lag > 0 ? 0.75 : 1);
	// A brick shows as a small cube: its top paler, its right and its bottom darker. It keeps the accent all its way, and
	// takes the colour of what it builds as it lands.
	// Read from the square's own corners: a ninth buffer of vertices (the square's uv) is one more than WebGPU draws
	// with, and `positionLocal` is the point's place in the town by then.
	const face = positionGeometry.xy.add(0.5);
	const cube = mix(mix(float(1), float(0.55), max(step(0.78, face.x), step(face.y, float(0.22)))), float(1.35), step(0.78, face.y));
	const bricked = mix(mix(c.xyz, hot, float(ACCENT)), into.xyz.mul(shade), smoothstep(0.8, 1, k)).mul(cube);
	material.colorNode = mix(dusty, bricked, brick);
	return material;
}

// `hot`: the colour of the edge that eats the page, red, green and blue (./rim.ts).
export function dust(
	scene: THREE.Scene,
	grains: Grain[],
	night: boolean,
	hot: readonly [number, number, number],
): { set: (built: number, camera: THREE.Camera) => void; dispose: () => void } {
	const given = inputs(grains, night, hot);
	const meshes = [0, 0.025, 0.05].map((lag) => {
		const mesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), point(given, lag, night), given.count);
		mesh.count = grains.length;
		mesh.frustumCulled = false;
		scene.add(mesh);
		return mesh;
	});
	return {
		set(built, camera) {
			given.built.value = built;
			const m = camera.matrixWorld.elements;
			given.right.value.set(m[0], m[1], m[2]).normalize();
			given.up.value.set(m[4], m[5], m[6]).normalize();
			given.back.value.set(m[8], m[9], m[10]).normalize();
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
