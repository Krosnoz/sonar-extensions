import type { TypedArray } from "three/webgpu";

// An instance's matrix written straight into its mesh's array, for what moves at each frame: turned about the upright
// axis only, at one scale (./parts.ts#parts). Through an Object3D (Euler, quaternion, compose), the 10 000 walkers of a
// big town took 2 s of a 90 s arrival in `setFromEuler` alone.
// The same operations as three.js's (Quaternion.setFromEuler in XYZ order, Matrix4.compose) with the other angles at 0:
// the same numbers, bit for bit, but for the sign of a zero.
export function writeTurned(array: TypedArray, index: number, x: number, y: number, z: number, ry: number, s: number): void {
	const [sin, cos] = [Math.sin(ry / 2), Math.cos(ry / 2)];
	const twice = sin + sin;
	const [yy, wy] = [sin * twice, cos * twice];
	const at = index * 16;
	array[at] = (1 - yy) * s;
	array[at + 1] = 0;
	array[at + 2] = -wy * s;
	array[at + 3] = 0;
	array[at + 4] = 0;
	array[at + 5] = s;
	array[at + 6] = 0;
	array[at + 7] = 0;
	array[at + 8] = wy * s;
	array[at + 9] = 0;
	array[at + 10] = (1 - yy) * s;
	array[at + 11] = 0;
	array[at + 12] = x;
	array[at + 13] = y;
	array[at + 14] = z;
	array[at + 15] = 1;
}
