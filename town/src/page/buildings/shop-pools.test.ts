// By night a shop's window lights the pavement before it (./shopfronts.ts): a pool lies before a lit shop window only.
// Pools laid every 2,7 along the front rows lit the pavement before houses and archways without a shop (12/11).
// No graphics card: the town is built on a kit that only keeps the geometries it is given.

import { expect, test } from "bun:test";
import { uniform, vec3 } from "three/tsl";
import type { Agent, Kit, Topic } from "../render/kit";
import { THREE } from "../render/nodes";
import type { Part } from "../render/parts";

// The town's modules read the page's storage and address (../test-page.ts sets them the same way), so they are
// imported once it is set.
const page = globalThis as Record<string, unknown>;
page["localStorage"] ??= { getItem: () => null };
page["location"] ??= { href: "http://127.0.0.1/" };
const { town } = await import("../plan/town");
const { NIGHT_ONLY } = await import("./facades-kit");
const { tone } = await import("../render/shapes");
const { SHOP_LIGHT } = await import("./shopfronts");

function geometriesOf(subjects: number): THREE.BufferGeometry[] {
	const geometries: THREE.BufferGeometry[] = [];
	let seed = 7;
	const kit = {
		night: true,
		aspect: 1.6,
		random: () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296,
		uTime: uniform(0),
		scene: new THREE.Scene(),
		blank: vec3(0, 0, 0),
		along: () => 0,
		part(geometry): Part {
			geometries.push(geometry);
			return { put: () => 0, move: () => {}, set: () => {} };
		},
	} satisfies Kit;
	const topics = Array.from({ length: subjects }, (_, index): Topic => ({
		name: `Subject ${index}`,
		agents: Array.from({ length: 1 + (index % 4) }, (_, at): Agent => ({ name: `Agent ${at}`, state: at % 4, seed: 0.13 + at * 0.29, children: [] })),
		working: 1,
		waiting: 0,
		reviewing: 0,
	}));
	town.build(kit, topics);
	return geometries;
}

// A shop's light: a disc of 20 triangles of part 7, of the shops' light. A lit shop window: a box (36 vertices) of the
// part NIGHT_ONLY, under 0.3 from the ground, thin on one side.
const DISC = 60;
const BOX = 36;
const SHOP = new THREE.Color(tone(SHOP_LIGHT));
// `far`: how far a pool reaches towards the street (+z).
type Spot = { x: number; z: number; far?: number };

function spots(geometry: THREE.BufferGeometry): { pools: Spot[]; windows: Spot[] } {
	const kind = geometry.getAttribute("aPart");
	const position = geometry.getAttribute("position");
	const color = geometry.getAttribute("color");
	const pools: Spot[] = [];
	const windows: Spot[] = [];
	const box = (first: number, count: number): THREE.Box3 => {
		const made = new THREE.Box3();
		for (let at = first; at < first + count; at++) made.expandByPoint(new THREE.Vector3().fromBufferAttribute(position, at));
		return made;
	};
	for (let at = 0; at < kind.count;) {
		const part = kind.getX(at);
		if (part === 7) {
			const { min, max } = box(at, DISC);
			const shop = Math.abs(color.getX(at) - SHOP.r) + Math.abs(color.getY(at) - SHOP.g) + Math.abs(color.getZ(at) - SHOP.b) < 1e-3;
			if (shop) pools.push({ x: (min.x + max.x) / 2, z: (min.z + max.z) / 2, far: max.z });
			at += DISC;
			continue;
		}
		if (part === Math.fround(NIGHT_ONLY) && at + BOX <= kind.count) {
			const { min, max } = box(at, BOX);
			if (min.y < 0.3 && Math.min(max.x - min.x, max.z - min.z) < 0.1) windows.push({ x: (min.x + max.x) / 2, z: (min.z + max.z) / 2 });
			at += BOX;
			continue;
		}
		at += 3;
	}
	return { pools, windows };
}

for (const subjects of [3, 30, 100])
	test(`town: a shop's pool of light lies before a lit shop window only, ${subjects} subjects`, () => {
		let pools = 0;
		const astray: string[] = [];
		for (const geometry of geometriesOf(subjects)) {
			const found = spots(geometry);
			pools += found.pools.length;
			// The pool's middle is under 0.1 out from the window's, on the pavement; it ends at the kerb (0.4 out from the
			// front), not on the road: reaching 1.0 out, it read from above as a lamp missing (12/11).
			for (const pool of found.pools) {
				const window = found.windows.find((each) => Math.hypot(each.x - pool.x, each.z - pool.z) < 0.3);
				if (!window || pool.far! - window.z > 0.4) astray.push(`${pool.x.toFixed(2)}, ${pool.z.toFixed(2)}`);
			}
		}
		expect(pools).toBeGreaterThan(0);
		expect(astray).toEqual([]);
	}, 60_000);
