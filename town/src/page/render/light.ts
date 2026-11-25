// The town's light: the sky's, and by day a low sun from the left that draws long shadows; by night the moon comes from
// the right.
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import type { World } from "./kit";
import { THREE } from "./nodes";

export function light(scene: THREE.Scene, renderer: THREE.WebGPURenderer, world: World, night: boolean, narrow: boolean, shadows = true): void {
	scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;
	// By night the sky stays light enough to read each wall from its roof and each street from its pavement.
	scene.environmentIntensity = night ? 0.14 : 0.3;
	scene.add(night ? new THREE.HemisphereLight("#7282c8", "#363f6c", 1.4) : new THREE.HemisphereLight("#cfeaff", "#a5d989", 1));
	const sun = new THREE.DirectionalLight(night ? "#c6d0f5" : "#fff0d2", night ? 1.25 : 2.6);
	const towards: [number, number, number] = night ? [0.75, 1.15, 0.3] : [-0.9, 0.95, 0.4];
	sun.target.position.set(...world.center);
	sun.position.set(...world.center).add(new THREE.Vector3(...towards).multiplyScalar(world.reach + 40));
	sun.castShadow = shadows;
	const shade = sun.shadow.camera;
	shade.left = shade.bottom = -world.reach - 4;
	shade.right = shade.top = world.reach + 4;
	shade.near = 1;
	shade.far = (world.reach + 40) * 3.2;
	// A phone's graphics memory is smaller: its shadows are drawn on a smaller map.
	sun.shadow.mapSize.setScalar(narrow ? 2048 : 4096);
	sun.shadow.bias = -0.0006;
	sun.shadow.normalBias = 0.02;
	sun.shadow.radius = 2;
	scene.add(sun, sun.target);
}

const UP = new THREE.Vector3(0, 1, 0);
const toward = new THREE.Vector3();
const right = new THREE.Vector3();
const over = new THREE.Vector3();
const corner = new THREE.Vector3();
const ahead = new THREE.Vector3();
const hit = new THREE.Vector3();

// The shadow's frame, tightened on what the screen shows: called at each frame, after the camera moved and before the
// frame is drawn (../camera/view.ts, in `loop`, before `mounted.frame`). The sun's map covers the town's whole width at the
// start; at the nearest zoom the screen shows a twentieth of it, and each texel of the map is that much coarser than
// the pixel it shades, so the shadows blur. The frame here is the ground the screen shows (and what rises on it), set on
// the sun's own axes, its middle snapped to the map's texels and its size to steps, so that a shadow does not swim as the
// camera moves. The depth range is cut to what can shade it: from the ground to the roofs' height towards the sun.
export function fitShadow(sun: THREE.DirectionalLight, camera: THREE.OrthographicCamera, world: World): void {
	const shade = sun.shadow.camera;
	const full = world.reach + 4;
	toward.copy(sun.position).sub(sun.target.position).normalize();
	right.crossVectors(UP, toward).normalize();
	over.crossVectors(toward, right);
	camera.updateMatrixWorld();
	// The screen's four corners, on the ground and at the town's top: the ground that shows, and what stands on it.
	const seen: number[][] = [];
	for (const [sx, sy] of [
		[-1, -1],
		[1, -1],
		[1, 1],
		[-1, 1],
	] as const) {
		corner.set(sx, sy, 0).unproject(camera);
		ahead.set(sx, sy, 1).unproject(camera).sub(corner);
		if (Math.abs(ahead.y) < 1e-6) continue;
		for (const height of [0, world.top]) {
			hit.copy(corner).addScaledVector(ahead, (height - corner.y) / ahead.y);
			seen.push([hit.dot(right), hit.dot(over), hit.dot(toward)]);
		}
	}
	if (!seen.length) return;
	const span = (axis: number): [number, number] => [Math.min(...seen.map((p) => p[axis]!)), Math.max(...seen.map((p) => p[axis]!))];
	const [[x0, x1], [y0, y1], [z0, z1]] = [span(0), span(1), span(2)];
	// One axis: its half size (in steps of a fifth of a doubling, never past the town's whole), and its middle snapped to
	// a texel of the map.
	const axis = (lo: number, hi: number, whole: number): [number, number] => {
		const half = 2 ** (Math.ceil(Math.log2((hi - lo) / 2 + 1) * 5) / 5);
		if (half >= full) return [full, whole];
		const texel = (2 * half) / sun.shadow.mapSize.x;
		return [half, Math.round((lo + hi) / 2 / texel) * texel];
	};
	hit.set(...world.center);
	const [halfX, middleX] = axis(x0, x1, hit.dot(right));
	const [halfY, middleY] = axis(y0, y1, hit.dot(over));
	// The roofs' height towards the sun: a caster of the town's top shades the ground as far as this.
	const reachUp = (world.top + 1) / Math.max(toward.y, 0.3);
	const [back, front] = [z0 - 2, z1 + reachUp];
	sun.target.position.set(0, 0, 0).addScaledVector(right, middleX).addScaledVector(over, middleY).addScaledVector(toward, back);
	sun.position.copy(sun.target.position).addScaledVector(toward, front - back + 1);
	[shade.left, shade.right, shade.top, shade.bottom] = [-halfX, halfX, halfY, -halfY];
	shade.near = 1;
	shade.far = front - back + 1 + 1;
	shade.updateProjectionMatrix();
	// Both biases follow the texel's size on the ground: a fixed one is several texels when the shadow is tight and a
	// fraction of one when it is wide, so the shadow detached or showed acne by the zoom. The bias is a share of the shadow
	// camera's depth: a post's shadow must not be pulled off its foot as the depth grows (the old 0.0006 was 17 cm over the
	// whole town).
	const texel = (2 * Math.max(halfX, halfY)) / sun.shadow.mapSize.x;
	sun.shadow.normalBias = texel * 1.2;
	sun.shadow.bias = -Math.max(texel * 0.7, 0.004) / (shade.far - shade.near);
}
