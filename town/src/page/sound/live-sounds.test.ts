// What the open town's inhabitants tell its ear (./town-sound.ts, through ../people/live-steps.ts#Stage): a session that opens
// or closes, as its figure is born or goes; never a change of state, nor what is there at once. No process, no graphics
// card: the inhabitants are built on a kit that only records what it is asked to draw (as ../people/live.test.ts).
import { expect, test } from "bun:test";
import { uniform, vec3 } from "three/tsl";
import type { Agent, Kit, Topic } from "../render/kit";
import type { Flight } from "../people/layer-grains";
import type { Stage, Wanted } from "../people/live-steps";
import { THREE } from "../render/nodes";
import type { Part } from "../render/parts";

await import("../test-page");
const { inhabitants } = await import("../people/inhabitants");
const { BIRTH } = await import("../people/births");

const SUBJECTS = ["Cache", "Menu"];
const wanted = (handle: string, topic: string, state: number): Wanted => ({ handle, topic, state, name: `Agent ${handle}`, children: [], pulls: [] });
const FLEET = [wanted("a", "Cache", 0), wanted("b", "Cache", 1), wanted("c", "Cache", 2), wanted("d", "Menu", 3)];

// A town of two subjects with `fleet` in it, and what its ear is told: each event and the x of its place. `seen`:
// whether the camera shows its places.
function townOf(fleet: Wanted[], seen = true) {
	let seed = 7;
	const kit = {
		night: false,
		aspect: 1.6,
		random: () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296,
		uTime: uniform(0),
		scene: new THREE.Scene(),
		blank: vec3(0, 0, 0),
		along: () => 0,
		part: (): Part => ({ put: () => 0, move: () => undefined, set: () => undefined, mark: () => undefined }),
	} satisfies Kit;
	const topics: Topic[] = SUBJECTS.map((name) => {
		const agents = fleet.filter((each) => each.topic === name).map((each, at): Agent => ({ ...each, seed: 0.13 + at * 0.29 }));
		return { name, agents, working: 0, waiting: 0, reviewing: 0 };
	});
	const world = inhabitants(kit, topics, { all: [], of: (index) => ({ i: index * 3, j: 0, x: index * 40, z: 0, topic: index }) });
	const [flights, heard]: [Flight[], string[]] = [[], []];
	const stage: Stage = {
		add: (flight) => void flights.push(flight),
		size: () => 0.02,
		seen: () => seen,
		moves: () => true,
		bricks: () => undefined,
		rises: () => undefined,
		hear: (kind, at) => void heard.push(`${kind} ${at[0]}`),
	};
	return { world, flights, heard, follow: (list: Wanted[], now = false) => world.follow(list, stage, now) };
}

test("the town's ear hears a session that opens or closes at its building's door; not a change of state", () => {
	const town = townOf(FLEET);
	const opened = [...FLEET, wanted("e", "Menu", 2)];
	town.follow(opened);
	town.world.tick(1);
	const door = town.flights[0]!.parent[0];
	expect(door).toBeGreaterThan(30);
	expect(town.heard).toEqual([`born ${door}`]);
	town.world.tick(1 + BIRTH + 0.1);
	// An agent that changes state goes and is born again: not heard, agents do it every few seconds.
	town.follow(opened.map((each) => (each.handle === "a" ? { ...each, state: 2 } : each)));
	town.world.tick(3);
	town.world.tick(3 + BIRTH + 0.1);
	expect(town.heard).toEqual([`born ${door}`]);
	town.follow(opened.filter((each) => each.handle !== "e").map((each) => (each.handle === "a" ? { ...each, state: 2 } : each)));
	town.world.tick(5);
	expect(town.heard).toEqual([`born ${door}`, `left ${door}`]);
});

test("the town's ear hears nothing where the camera shows no figure, nor of what changed while the town was not looked at", () => {
	for (const [seen, now] of [
		[false, false],
		[true, true],
	] as const) {
		const town = townOf(FLEET, seen);
		town.follow([...FLEET.filter((each) => each.handle !== "b"), wanted("e", "Cache", 1)], now);
		town.world.tick(1);
		town.world.tick(1.1);
		expect([town.heard, town.flights]).toEqual([[], []]);
	}
});
