// The parts that never move and have few instances, merged once the town is built: one mesh per look (the same
// material's options, the same attributes) instead of one per model. Each mesh is a draw in the town's pass and one in
// the sun's, and three.js spends as much script on each, whatever its size: the subjects' bases, roofs and gardens were
// about thirty draws of one to three instances each.
// Each instance's place is laid in its vertices, its data and its colour in two attributes (`aData`, `aTint`), which
// the material reads as it read the instance's (./part-material.ts#material): the shaders compute the same thing.
import { attribute } from "three/tsl";
import { THREE, merge, type Vec3, type Vec4 } from "./nodes";

export type Still = {
	mesh: THREE.InstancedMesh;
	values: Float32Array;
	tints: Float32Array;
	// The material's options, as text: parts with the same are drawn by the same material.
	look: string;
	material: (data: Vec4, colour: Vec3) => THREE.Material;
};

// The most vertices a part brings to a merged mesh. A part with many instances stays instanced: copied into the
// vertices, a storey repeated hundreds of times weighed tens of megabytes, on a phone.
const MOST = 50_000;

const repeated = (values: Float32Array, count: number): THREE.BufferAttribute => {
	const array = new Float32Array(values.length * count);
	for (let at = 0; at < count; at++) array.set(values, at * values.length);
	return new THREE.BufferAttribute(array, values.length);
};

export function mergeStill(scene: THREE.Scene, stills: Still[]): void {
	const looks = new Map<string, Still[]>();
	for (const still of stills) {
		const { geometry, count } = still.mesh;
		if (count === 0 || geometry.getAttribute("position").count * count > MOST) continue;
		const look = `${still.look}|${Object.keys(geometry.attributes).toSorted().join()}|${geometry.index ? "indexed" : ""}`;
		looks.set(look, [...(looks.get(look) ?? []), still]);
	}
	const matrix = new THREE.Matrix4();
	for (const group of looks.values()) {
		if (group.length < 2) continue;
		const pieces = group.flatMap(({ mesh, values, tints }) =>
			Array.from({ length: mesh.count }, (_, at) => {
				mesh.getMatrixAt(at, matrix);
				const piece = mesh.geometry.clone().applyMatrix4(matrix);
				const vertices = piece.getAttribute("position").count;
				piece.setAttribute("aData", repeated(values.subarray(at * 4, at * 4 + 4), vertices));
				piece.setAttribute("aTint", repeated(tints.subarray(at * 3, at * 3 + 3), vertices));
				return piece;
			}),
		);
		const geometry = merge(pieces);
		if (!geometry) continue;
		const first = group[0]!;
		const mesh = new THREE.Mesh(geometry, first.material(attribute("aData", "vec4"), attribute("aTint", "vec3")));
		mesh.frustumCulled = false;
		mesh.castShadow = first.mesh.castShadow;
		mesh.receiveShadow = true;
		scene.add(mesh);
		for (const still of group) scene.remove(still.mesh);
	}
}
