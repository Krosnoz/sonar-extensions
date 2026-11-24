// A park's lamp keeps 0.3 off its benches, planters and piece (./parks.ts): a planter put against a lamp's foot touched
// its head (10 agents, third side, 13/11). No graphics card: the park's pieces are read as boxes.

import { expect, test } from "bun:test";
import type { THREE } from "./nodes";

const page = globalThis as Record<string, unknown>;
page["matchMedia"] ??= () => ({ matches: false });
page["document"] ??= { documentElement: { dataset: {} } };
await import("./test-page");
const { parkPlanner } = await import("./parks");
const { STYLES } = await import("./styles");
const { rnd } = await import("./shapes");

const boxOf = (geometry: THREE.BufferGeometry): THREE.Box3 => {
	geometry.computeBoundingBox();
	return geometry.boundingBox!;
};

test("a park's lamp head stands 0.3 or more from anything else standing in its park", () => {
	let [lamps, closest] = [0, Infinity];
	for (let seed = 1; seed <= 300; seed++) {
		const plan = parkPlanner();
		const trees = () => ({ put: () => 0, move: () => {} });
		const boxes = plan(STYLES[seed % STYLES.length]!, { i: 0, j: 0, x: 0, z: 0, topic: -1 }, trees, 5.5, seed % 3 === 0, rnd(seed)).map(boxOf);
		// The lamp's cap (./street-furniture.ts#lamp): 0.24 wide, 1.86 up, the widest part of its head.
		const caps = boxes.filter(({ min, max }) => Math.abs(max.x - min.x - 0.24) < 0.005 && min.y > 1.8 && min.y < 1.95);
		// What stands: not the paths nor the light's pool on the ground.
		const standing = boxes.filter(({ min, max }) => max.y - min.y >= 0.03 && max.y >= 0.13);
		for (const cap of caps) {
			const [x, z] = [(cap.min.x + cap.max.x) / 2, (cap.min.z + cap.max.z) / 2];
			const others = standing.filter(({ min, max }) => Math.abs((min.x + max.x) / 2 - x) >= 0.13 || Math.abs((min.z + max.z) / 2 - z) >= 0.13);
			const gaps = others.map(({ min, max }) => Math.hypot(x - Math.max(min.x, Math.min(x, max.x)), z - Math.max(min.z, Math.min(z, max.z))) - 0.12);
			closest = Math.min(closest, ...gaps);
			lamps++;
		}
	}
	expect(lamps).toBeGreaterThan(300);
	expect(closest).toBeGreaterThanOrEqual(0.3 - 0.005);
});
