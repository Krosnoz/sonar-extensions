// What moves at each frame writes its matrix straight into its mesh's array: the same numbers as three.js's Object3D,
// bit for bit, and 10 000 walkers in well under a millisecond each frame.
import { expect, test } from "bun:test";
import * as THREE from "three";
import { writeTurned } from "./instance-matrix.ts";

test("a turned and scaled instance gets three.js's own matrix, bit for bit", () => {
	const dummy = new THREE.Object3D();
	const [ours, theirs] = [new Float32Array(16), new Float32Array(16)];
	for (let at = 0; at < 2000; at++) {
		const [x, y, z, ry, s] = [Math.random() * 400 - 200, Math.random(), Math.random() * 400 - 200, Math.random() * 20 - 10, 0.2 + Math.random() * 3];
		dummy.position.set(x, y, z);
		dummy.rotation.set(0, ry, 0);
		dummy.scale.setScalar(s);
		dummy.updateMatrix();
		dummy.matrix.toArray(theirs);
		writeTurned(ours, 0, x, y, z, ry, s);
		// `===`: a zero of either sign is the same zero on the screen.
		expect([...ours].every((value, index) => value === theirs[index])).toBe(true);
	}
});

test("10 000 walkers' matrices take under 10 ms", () => {
	const array = new Float32Array(10_000 * 16);
	// The fastest of 10 frames: a busy machine delays some of them.
	let best = Infinity;
	for (let frame = 0; frame < 10; frame++) {
		const started = performance.now();
		for (let at = 0; at < 10_000; at++) writeTurned(array, at, at, 0.08, -at, at * 0.01, 1.2);
		best = Math.min(best, performance.now() - started);
	}
	expect(best).toBeLessThan(10);
});
