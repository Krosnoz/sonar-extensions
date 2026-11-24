// A part not drawn is not moved: in the whole town's view, where no inhabitant shows, the people's parts of a town of
// 10 000 agents were moved and sent to the graphics card at every frame. Shown again, a part moves at its next frame,
// before it is drawn.
import { expect, test } from "bun:test";

const page = globalThis as Record<string, unknown>;
page["matchMedia"] ??= () => ({ matches: false });
page["document"] ??= { querySelectorAll: () => [], documentElement: { dataset: {} } };
page["getComputedStyle"] ??= () => ({ paddingTop: "0" });
await import("./test-page");
const { THREE } = await import("./nodes");
const { parts, uniforms } = await import("./parts");

test("a hidden part is not moved, and moves again once shown", () => {
	const scene = new THREE.Scene();
	const made = parts(scene, uniforms(), () => 0, false);
	const part = made.part(new THREE.BoxGeometry(), 10, { people: true });
	const mesh = scene.children.find((child): child is THREE.InstancedMesh => child instanceof THREE.InstancedMesh)!;
	part.put({ x: 0, y: 0, z: 0 });
	made.shown(false);
	expect(mesh.visible).toBe(false);
	const version = mesh.instanceMatrix.version;
	part.move(0, 5, 0, 5, 1, 1);
	expect(mesh.instanceMatrix.version).toBe(version);
	made.shown(true);
	part.move(0, 5, 0, 5, 1, 1);
	expect(mesh.instanceMatrix.version).toBeGreaterThan(version);
	expect(mesh.instanceMatrix.array[12]).toBe(5);
});
