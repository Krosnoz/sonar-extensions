// A sign keeps clear of every lamp's head, as it would hide its light (./signs.ts): the town lists the heads in its
// heights (./heights.ts#HeightMap). The streets' lamps are found in the pieces of the blocks (./city.ts#decorate), the
// squares' lamps are drawn by instance and listed by ./squares.ts#lampsOf: a lamp missed by both is a head a sign covers
// (v11nuit-c21, 12/11). No graphics card: the kit keeps the geometries and where each is put.

import { expect, test } from "bun:test";
import { uniform, vec3 } from "three/tsl";
import type { Agent, Kit, Topic } from "./kit";
import { THREE } from "./nodes";
import type { Part } from "./parts";
import { T } from "./shapes";
import { BX, BZ } from "./town-blocks";

const page = globalThis as Record<string, unknown>;
page["localStorage"] ??= { getItem: () => null };
page["location"] ??= { href: "http://127.0.0.1/" };
const { town } = await import("./town");

// A lamp's head (./street-furniture.ts#lamp): a box of part 4, 0.14 wide, 0.2 high, from 1.66 up, 36 corners. The part carries
// the post's width in its fraction (a fine detail, ./part-material.ts#material), hence its whole part only is compared.
const HEAD = 36;
function heads(geometry: THREE.BufferGeometry): [number, number][] {
	const kind = geometry.getAttribute("aPart");
	const position = geometry.getAttribute("position");
	const found: [number, number][] = [];
	for (let at = 0; at + HEAD <= kind.count; at += 3) {
		if (Math.floor(kind.getX(at)) !== 4) continue;
		const box = new THREE.Box3();
		for (let corner = at; corner < at + HEAD; corner++) box.expandByPoint(new THREE.Vector3().fromBufferAttribute(position, corner));
		const size = box.max.clone().sub(box.min);
		if (Math.abs(size.x - 0.14) > 0.01 || Math.abs(size.y - 0.2) > 0.01 || Math.abs(box.min.y - 1.66) > 0.01) continue;
		found.push([(box.min.x + box.max.x) / 2, (box.min.z + box.max.z) / 2]);
		at += HEAD - 3;
	}
	return found;
}

const topicOf = (index: number): Topic => ({
	name: `Subject ${index}`,
	agents: Array.from({ length: 1 + (index % 4) }, (_, at): Agent => ({ name: `Agent ${at}`, state: at % 4, seed: 0.13 + at * 0.29, children: [] })),
	working: 1,
	waiting: 0,
	reviewing: 0,
});

for (const subjects of [3, 30])
	test(`town: every lamp's head is a point the signs keep clear of, ${subjects} subjects`, () => {
		const placed: { geometry: THREE.BufferGeometry; x: number; z: number }[] = [];
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
				return { put: ({ x, z }) => (placed.push({ geometry, x, z }), 0), move: () => {}, set: () => {} };
			},
		} satisfies Kit;
		const world = town.build(
			kit,
			Array.from({ length: subjects }, (_, index) => topicOf(index)),
		);
		const key = ([x, z]: [number, number]): string => `${x.toFixed(2)} ${z.toFixed(2)}`;
		const listed = new Set(world.heights.lamps.map(([x, , z]) => key([x, z])));
		const all = placed.flatMap(({ geometry, x, z }) => heads(geometry).map(([hx, hz]) => key([x + hx, z + hz])));
		expect(all.length).toBeGreaterThan(0);
		// The square of the subject to come is not built yet (./plot.ts): its two lamps do not show, and are listed when
		// it is built.
		const coming = world.anchors.find(({ topic }) => topic.held)?.at;
		const hidden = placed.flatMap(({ geometry, x, z }) =>
			heads(geometry)
				.map(([hx, hz]): [number, number] => [x + hx, z + hz])
				.filter(([hx, hz]) => coming && Math.abs(hx - coming[0] + BX) < T / 2 && Math.abs(hz - coming[2] + BZ) < T / 2)
				.map(key),
		);
		expect(hidden.filter((head) => !listed.has(head)).length).toBe(coming ? 2 : 0);
		expect(all.filter((head) => !listed.has(head) && !hidden.includes(head))).toEqual([]);
	}, 60_000);
