// The points a page breaks into (./dust.ts), as the graphics card is given them.

import { expect, test } from "bun:test";
import { THREE } from "../render/nodes";
import { dust, type Grain } from "./dust";

const grain: Grain = { start: [0, 0, 0], end: [1, 1, 1], t0: 0, t1: 1, colour: [10, 20, 30], into: "#445566", seed: 0.5, brick: true, from: 0.08, to: 0.04 };

// The attributes of the square a material reads, by name.
function read(material: THREE.MeshBasicNodeMaterial): Set<string> {
	const names = new Set<string>();
	for (const node of [material.positionNode, material.colorNode])
		node?.traverse((each) => {
			const name = (each as { _attributeName?: unknown })._attributeName;
			if (typeof name === "string") names.add(name);
		});
	return names;
}

test("town: a point reads its square's position alone, so WebGPU draws it with its 8 buffers of vertices", () => {
	const scene = new THREE.Scene();
	const made = dust(scene, [grain], false, [255, 120, 0]);
	const meshes = scene.children.filter((child): child is THREE.InstancedMesh => child instanceof THREE.InstancedMesh);
	expect(meshes.length).toBe(3);
	// A point has five buffers of its own, its square's position and its place: the square's uv made a ninth, WebGPU
	// refused the points' programs, and no point was drawn, in a real browser only (18/11).
	for (const mesh of meshes) expect([...read(mesh.material as THREE.MeshBasicNodeMaterial)]).toEqual(["position"]);
	made.dispose();
});
