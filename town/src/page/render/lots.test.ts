// An inhabitant of a lot out of the camera's view is not drawn, and where each one lies in the arrays follows the lots
// seen: its index stays the one `put` gave it, its data moves with it.
import { expect, test } from "bun:test";

await import("../test-page");
const { THREE } = await import("./nodes");
const { layout, lots } = await import("./lots");
const { parts, uniforms } = await import("./parts");

// An orthographic camera over the ground, 20 units wide, looking down.
const camera = (x: number, half = 10): THREE.OrthographicCamera => {
	const view = new THREE.OrthographicCamera(-half, half, half, -half, 0.1, 100);
	view.position.set(x, 50, 0);
	view.lookAt(x, 0, 0);
	view.updateMatrixWorld();
	return view;
};

test("a lot out of the view goes behind the lots seen, and its instances keep their data", () => {
	const all = lots();
	const order = layout(all, 6);
	// Three lots of two instances, a lot at x = 0, 100 and 200.
	for (const lot of [0, 1, 2])
		for (const at of [0, 1]) {
			order.put(lot, lot * 2 + at);
			all.note(lot, lot * 100 + at, 0);
		}
	const matrices = Float32Array.from({ length: 6 }, (_, at) => at + 1);
	// The camera sees the lot at 100 only.
	let seen = 0;
	all.attach(() => (seen = order.arrange([[matrices, 1]])));
	all.cull(camera(100));
	expect(seen).toBe(2);
	expect(Array.from(matrices.slice(0, 2))).toEqual([3, 4]);
	// Instance 2 (the first of lot 1) lies first; instance 0 of lot 0 behind it.
	expect(order.slotOf(2)).toBe(0);
	expect(order.slotOf(0)).toBe(2);
	// The camera moves on to the lot at 200: the data of every lot follows.
	all.cull(camera(200));
	expect(seen).toBe(2);
	expect(Array.from(matrices.slice(0, 2))).toEqual([5, 6]);
	expect(order.slotOf(4)).toBe(0);
	expect([...matrices].sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 6]);
});

test("a part of lots draws only the lots seen, and a move reaches its instance wherever it lies", () => {
	const scene = new THREE.Scene();
	const made = parts(scene, uniforms(), () => 0, false);
	const part = made.part(new THREE.BoxGeometry(), 4, { people: true, lots: true });
	const mesh = scene.children.find((child): child is THREE.InstancedMesh => child instanceof THREE.InstancedMesh)!;
	const [a, b, c, d] = [
		part.put({ x: 0, y: 0, z: 0 }, 0),
		part.put({ x: 1, y: 0, z: 0 }, 0),
		part.put({ x: 100, y: 0, z: 0 }, 1),
		part.put({ x: 101, y: 0, z: 0 }, 1),
	];
	made.shown(true);
	expect(mesh.count).toBe(4);
	made.cull(camera(100));
	expect(mesh.count).toBe(2);
	// The lot at 100 lies first now; moving instance `d` writes it there, and moving `a` writes it behind.
	part.move(d, 105, 0, 0, 0, 1);
	part.move(a, 7, 0, 0, 0, 1);
	const array = mesh.instanceMatrix.array;
	expect(array[16 + 12]).toBe(105);
	expect(array[2 * 16 + 12]).toBe(7);
	expect(array[12]).toBe(100);
	expect([b, c]).toEqual([1, 2]);
	// Seen again, all of them are drawn, and the lot at 0 has kept its move.
	made.cull(camera(50, 120));
	expect(mesh.count).toBe(4);
	expect(array[12]).toBe(7);
});
