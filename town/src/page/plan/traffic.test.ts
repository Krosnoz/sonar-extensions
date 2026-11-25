// Two cars never overlap: the traffic runs a minute of the town at 10, 100 and 1 000 agents, for several towns, and
// counts the shown cars whose bodies meet at any frame. A yellow and a red car once went through each other (v16, 10
// agents, by night).

import { expect, test } from "bun:test";
import { uniform, vec3 } from "three/tsl";
import type { Kit } from "../render/kit";
import { THREE } from "../render/nodes";

const page = globalThis as Record<string, unknown>;
page["localStorage"] ??= { getItem: () => null };
page["location"] ??= { href: "http://127.0.0.1/" };
const { layoutFor } = await import("./layout");
const { growthOf } = await import("./growth");
const { traffic } = await import("./traffic");

// A car's body (./traffic.ts#car): 0.95 by 0.46, grown 1.4. A hundredth less on each side: touching is not overlapping.
const [HALF_LONG, HALF_WIDE] = [(0.95 * 1.4) / 2 - 0.01, (0.46 * 1.4) / 2 - 0.01];

type Spot = { x: number; z: number; ry: number; shown: boolean };

function overlaps(topics: number, agents: number, seed: number, seconds: number): { count: number; first?: string } {
	const spots: Spot[] = [];
	const kit = {
		night: false,
		aspect: 1.6,
		random: Math.random,
		uTime: uniform(0),
		scene: new THREE.Scene(),
		blank: vec3(0, 0, 0),
		along: () => 0,
		part: () => ({
			put: () => spots.push({ x: 0, z: 0, ry: 0, shown: false }) - 1,
			move: (n: number, x: number, _y: number, z: number, ry = 0, s = 1) => (spots[n] = { x, z, ry, shown: s > 0.5 }),
		}),
	} satisfies Kit;
	const run = traffic(kit, layoutFor(topics, seed, growthOf(agents)), seed);
	const half = (spot: Spot): [number, number] => (Math.abs(Math.cos(spot.ry)) > 0.5 ? [HALF_LONG, HALF_WIDE] : [HALF_WIDE, HALF_LONG]);
	let count = 0;
	let first: string | undefined;
	for (let frame = 0; frame <= seconds * 30; frame++) {
		run(frame / 30);
		for (let a = 0; a < spots.length; a++)
			for (let b = a + 1; b < spots.length; b++) {
				const [p, q] = [spots[a]!, spots[b]!];
				if (!p.shown || !q.shown) continue;
				const [[px, pz], [qx, qz]] = [half(p), half(q)];
				if (Math.abs(p.x - q.x) >= px + qx || Math.abs(p.z - q.z) >= pz + qz) continue;
				count++;
				first ??= `t ${(frame / 30).toFixed(2)}: ${JSON.stringify(p)} ${JSON.stringify(q)}`;
			}
	}
	return { count, first };
}

// The towns: a project's seed (the bench's names, hashed as ./town.ts does, and a few others) and its subjects.
const SEEDS = [8998, 7281, 6036, 3, 512, 4097];
for (const [agents, topics] of [
	[10, 6],
	[100, 12],
	[1000, 24],
] as const)
	test(`no two cars overlap at ${agents} agents`, () => {
		const found = SEEDS.map((seed) => overlaps(topics, agents, seed, 60));
		expect(found.filter(({ count }) => count > 0)).toEqual([]);
	}, 240_000);
