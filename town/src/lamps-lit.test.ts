// Every street lamp of the town lays its pool of light round its own foot by night. The pools are taken out of each
// model (./pool-split.ts#pooled) and drawn with its instances: a lamp whose pool lies elsewhere, or that has none, shows a
// lit head over a dark ground. No graphics card: the town is built on a kit that only keeps the geometries it is given.
// The monument's corner lamps, the park's and the river's back lamps had their pool pulled 1.4 to 2 away (12/11).

import { expect, test } from "bun:test";
import { uniform, vec3 } from "three/tsl";
import type { Agent, Kit, Topic } from "./kit";
import { THREE } from "./nodes";
import type { Part } from "./parts";

// The town's modules read the page's storage and address (../state.ts).
const page = globalThis as Record<string, unknown>;
page["localStorage"] ??= { getItem: () => null };
page["location"] ??= { href: "http://127.0.0.1/" };
const { town } = await import("./town");

function recording(): { kit: Kit; geometries: THREE.BufferGeometry[] } {
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
	return { kit, geometries };
}

// A lamp's head (./street-furniture.ts#lamp): a box of the lamp's part, 0.14 wide, 0.2 high, from 1.66 up. A pool: the
// triangles of part 7, a disc of 20.
const HEAD = 36;
const DISC = 60;
type Spot = { x: number; z: number };

function spots(geometry: THREE.BufferGeometry): { heads: Spot[]; pools: Spot[] } {
	const kind = geometry.getAttribute("aPart");
	const position = geometry.getAttribute("position");
	const heads: Spot[] = [];
	const pools: Spot[] = [];
	const box = (first: number, count: number): THREE.Box3 => {
		const made = new THREE.Box3();
		for (let at = first; at < first + count; at++) made.expandByPoint(new THREE.Vector3().fromBufferAttribute(position, at));
		return made;
	};
	for (let at = 0; at < kind.count;) {
		const part = kind.getX(at);
		if (part === 7) {
			const { min, max } = box(at, DISC);
			pools.push({ x: (min.x + max.x) / 2, z: (min.z + max.z) / 2 });
			at += DISC;
			continue;
		}
		if (Math.floor(part) === 4 && at + HEAD <= kind.count) {
			const { min, max } = box(at, HEAD);
			const size = max.clone().sub(min);
			if (Math.abs(size.x - 0.14) < 0.01 && Math.abs(size.y - 0.2) < 0.01 && Math.abs(min.y - 1.66) < 0.01) {
				heads.push({ x: (min.x + max.x) / 2, z: (min.z + max.z) / 2 });
				at += HEAD;
				continue;
			}
		}
		at += 3;
	}
	return { heads, pools };
}

const topicOf = (index: number): Topic => ({
	name: `Subject ${index}`,
	agents: Array.from({ length: 1 + (index % 4) }, (_, at): Agent => ({ name: `Agent ${at}`, state: at % 4, seed: 0.13 + at * 0.29, children: [] })),
	working: 1,
	waiting: 0,
	reviewing: 0,
});

// The lamps whose pool's middle is not under them (0.15 or more away), as "x, z in the model: how far its pool is".
function unlit(subjects: number): { lamps: number; unlit: string[] } {
	const { kit, geometries } = recording();
	town.build(
		kit,
		Array.from({ length: subjects }, (_, index) => topicOf(index)),
	);
	let lamps = 0;
	const missed: string[] = [];
	for (const geometry of geometries) {
		const { heads, pools } = spots(geometry);
		lamps += heads.length;
		for (const head of heads) {
			const nearest = Math.min(Infinity, ...pools.map((pool) => Math.hypot(pool.x - head.x, pool.z - head.z)));
			if (nearest >= 0.15) missed.push(`${head.x.toFixed(2)}, ${head.z.toFixed(2)}: ${nearest.toFixed(2)}`);
		}
	}
	return { lamps, unlit: missed };
}

for (const subjects of [3, 30, 100])
	test(`town: each lamp lays its pool of light round its foot, ${subjects} subjects`, () => {
		const { lamps, unlit: missed } = unlit(subjects);
		expect(lamps).toBeGreaterThan(0);
		expect(missed).toEqual([]);
	}, 60_000);
