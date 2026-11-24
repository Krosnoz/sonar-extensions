// The town is built in steps that give the browser its hand back: built in one go, it froze the page 2 to 3 s after
// the click on the town's icon, the icon's spinner still (13/11). Built in steps, it is the same town.
// No graphics card: the town is built on a kit that only keeps the geometries it is given.

import { expect, test } from "bun:test";
import { uniform, vec3 } from "three/tsl";
import type { Agent, Kit, Topic } from "./kit";
import { THREE } from "./nodes";
import type { Part } from "./parts";

const page = globalThis as Record<string, unknown>;
page["localStorage"] ??= { getItem: () => null };
page["location"] ??= { href: "http://127.0.0.1/" };
const { town } = await import("./town");
const { finish, stepped } = await import("./steps");

function kitOf(geometries: THREE.BufferGeometry[]): Kit {
	let seed = 7;
	return {
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
	};
}

const topics = Array.from({ length: 12 }, (_, index): Topic => ({
	name: `Subject ${index}`,
	agents: Array.from({ length: 1 + (index % 4) }, (_, at): Agent => ({ name: `Agent ${at}`, state: at % 4, seed: 0.13 + at * 0.29, children: [] })),
	working: 1,
	waiting: 0,
	reviewing: 0,
}));

test("the town is built in many steps, and is the same town as built in one go", () => {
	const [whole, inSteps] = [[] as THREE.BufferGeometry[], [] as THREE.BufferGeometry[]];
	town.build(kitOf(whole), topics);
	const steps = town.steps!(kitOf(inSteps), topics);
	let count = 0;
	let next = steps.next();
	for (; !next.done; next = steps.next()) count++;
	// At least a step a block of the city.
	expect(count).toBeGreaterThan(20);
	expect(inSteps.map((each) => [...(each.getAttribute("position").array as Float32Array)])).toEqual(
		whole.map((each) => [...(each.getAttribute("position").array as Float32Array)]),
	);
	expect(next.value.anchors.map((each) => each.at)).toEqual(finish(town.steps!(kitOf([]), topics)).anchors.map((each) => each.at));
});

test("steps give the browser its hand back once a slice of time is spent", async () => {
	let clock = 0;
	const handed: number[] = [];
	function* slow(): Generator<void, string> {
		for (let at = 0; at < 10; at++) {
			// Each step takes 10 ms.
			clock += 10;
			yield;
		}
		return "built";
	}
	const built = await stepped(
		slow(),
		25,
		() => clock,
		async () => void handed.push(clock),
	);
	expect(built).toBe("built");
	// A hand back every 30 ms of work, never one per step.
	expect(handed).toEqual([30, 60, 90]);
});
