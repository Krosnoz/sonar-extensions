// What every part of the town's drawing shares: three.js, the types of a shader's values, and small shader functions.
import * as THREE from "three/webgpu";
import { dot, fract, instancedBufferAttribute, sin, step, vec3 } from "three/tsl";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

export { THREE, mergeGeometries as merge };
// A value of a shader, of its type ("float" by default).
export type Node<T = "float"> = THREE.Node<T>;
export type Vec3 = Node<"vec3">;
export type Vec4 = Node<"vec4">;

// Cubes per metre: the town is built in cubes of this size.
export const N = 11;

// One value per instance, from an array of 3 or 4 numbers each.
export const perInstance = <T extends "vec3" | "vec4">(array: Float32Array, type: T): Node<T> =>
	instancedBufferAttribute<T>(new THREE.InstancedInterleavedBuffer(array, type === "vec4" ? 4 : 3), type);
// three.js types some nodes bare, with no value type: a material's position, a texture's size. A node made with its type
// holds it (`nodeType`: a texture's size is a "uvec2"); one whose type follows its inputs holds none until it is built
// (null), as a position moved by `positionLocal.add`. The node itself is returned: the shader does not change.
export function typed<T extends string>(node: THREE.Node, type: T): Node<T> {
	if (!isOf(node, type)) throw new Error(`town: a ${type} node is a ${node.nodeType}`);
	return node;
}
const isOf = <T extends string>(node: THREE.Node, type: T): node is Node<T> => node.nodeType === type || node.nodeType === null;
export const rgb = (hex: string): Vec3 => vec3(...new THREE.Color(hex).toArray());
export const noise = (cell: Vec3): Node => fract(sin(dot(cell, vec3(12.9898, 78.233, 37.719))).mul(43758.5453));
// An instance's data: `x` its place along the front, `y` its state (1 at work, 2 waits, 3 to review), `z` a seed.
export const working = (data: Vec4): Node => step(0.5, data.y).mul(step(data.y, 1.5));
export const bob =
	(uTime: Node) =>
	(data: Vec4): Vec3 =>
		vec3(0, sin(uTime.mul(3.2).add(data.z.mul(40))).mul(0.07), 0);
