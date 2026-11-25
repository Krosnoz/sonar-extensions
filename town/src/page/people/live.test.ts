// The town follows the fleet while it is open (./live.ts): each change of an agent shows as its figure born, going or
// changing, and nothing else moves. No process, no graphics card: the inhabitants are built on a kit that only records
// what it is asked to draw.
import { expect, test } from "bun:test";
import { uniform, vec3 } from "three/tsl";
import type { Agent, Kit, Topic } from "../render/kit";
import type { Flight } from "./layer-grains";
import type { Stage, Wanted } from "./live-steps";
import { THREE } from "../render/nodes";
import type { Part } from "../render/parts";
import type { Pull } from "../sonar/pulls";

await import("../test-page");
const { inhabitants } = await import("./inhabitants");
const { LOOKS } = await import("./figures");
const { crowdOf } = await import("./crowd");
const { BIRTH } = await import("./births");
const { END } = await import("./layers");
const { STATE } = await import("./state-colours");
const { SPARE } = await import("./bodies");
const { SWAP } = await import("./tools");

// An instance as its part draws it: where, how big (0: it does not show), its colour, its state, and its mark (over 0
// it is born at that second, under 0 it goes from it).
type Drawn = { x: number; z: number; s: number; color: string; state: number; w: number };
const [ROBOTS, CRATES, BUBBLES, MARKS] = [LOOKS, LOOKS + 1, LOOKS + 2, LOOKS + 3];
// The book, the hammer and the console of who works (./tools.ts).
const TOOLS = [LOOKS + 4, LOOKS + 5, LOOKS + 6];
const SUBJECTS = ["Cache", "Menu"];
const GREY = "#6b7079";

const wanted = (handle: string, topic: string, state: number, children: number[] = [], pulls: Pull[] = []): Wanted => ({
	handle,
	topic,
	state,
	name: `Agent ${handle}`,
	children,
	pulls,
});
const pull = (number: number, done = 0): Pull => ({ url: `https://example.test/pull/${number}`, number, tone: "tone-wait", red: false, done, total: 6 });

// A town of `subjects` with `fleet` in it, and what it draws. `seen`: whether the camera shows its places.
function townOf(fleet: Wanted[], seen = true, subjects = SUBJECTS) {
	const parts: Drawn[][] = [];
	let seed = 7;
	const kit = {
		night: false,
		aspect: 1.6,
		random: () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296,
		uTime: uniform(0),
		scene: new THREE.Scene(),
		blank: vec3(0, 0, 0),
		along: () => 0,
		part(): Part {
			const drawn: Drawn[] = [];
			parts.push(drawn);
			const size = (s: number | number[] | undefined): number => (typeof s === "number" ? s : 1);
			return {
				put: (given) => drawn.push({ x: given.x, z: given.z, s: size(given.s), color: given.color ?? "", state: given.state ?? 0, w: given.w ?? 0 }) - 1,
				move: (index, x, _y, z, _ry, s = 1) => void Object.assign(drawn[index]!, { x, z, s }),
				set: (index, given) => {
					const { color, state, w } = given;
					Object.assign(
						drawn[index]!,
						{ x: given.x, z: given.z, s: size(given.s) },
						color !== undefined && { color },
						state !== undefined && { state },
						w !== undefined && { w },
					);
				},
				mark: (index, at) => void (drawn[index]!.w = at),
			};
		},
	} satisfies Kit;
	const topics: Topic[] = subjects.map((name) => {
		const agents = fleet.filter((each) => each.topic === name).map((each, at): Agent => ({ ...each, seed: 0.13 + at * 0.29 }));
		return { name, agents, working: 0, waiting: 0, reviewing: 0 };
	});
	const world = inhabitants(kit, topics, { all: [], of: (index) => ({ i: index * 3, j: 0, x: index * 40, z: 0, topic: index }) });
	const flights: Flight[] = [];
	const stage: Stage = { add: (flight) => void flights.push(flight), size: () => 0.02, seen: () => seen };
	const shown = (part: number): Drawn[] => parts[part]!.filter((each) => each.s > 0);
	return {
		world,
		topics,
		flights,
		follow: (list: Wanted[], now = false) => world.follow(list, stage, now),
		people: (): Drawn[] => Array.from({ length: LOOKS }, (_, look) => shown(look)).flat(),
		robots: () => shown(ROBOTS),
		carried: () => [shown(CRATES).length, shown(BUBBLES).length, shown(MARKS).length],
		// The large bubbles, one a place where many wait: the last part ./bodies.ts#figuresOf makes.
		rounds: () => shown(parts.length - 1),
		// What those at work hold, each with its size: the crates, then the books, the hammers and the consoles.
		held: () => [CRATES, ...TOOLS].map((part) => shown(part).map((each) => each.s)),
		named: () => world.figures.filter((figure) => !figure.away).map((figure) => figure.agent.name),
	};
}

const FLEET = [wanted("a", "Cache", 0), wanted("b", "Cache", 1), wanted("c", "Cache", 2), wanted("d", "Menu", 3)];
const but = (handle: string, change: Partial<Wanted>): Wanted[] => FLEET.map((each) => (each.handle === handle ? { ...each, ...change } : each));

test("live: the same fleet changes nothing", () => {
	const town = townOf(FLEET);
	// At one second of the town: who walks is where it is then.
	town.world.tick(1);
	const before = JSON.stringify(town.people());
	town.follow(FLEET);
	town.world.tick(1);
	expect([town.flights.length, town.world.revision(), JSON.stringify(town.people()) === before]).toEqual([0, 0, true]);
});

test("live: a subject's pull requests are those of its sessions now, each once; its sign says them again when they change", () => {
	const town = townOf(FLEET);
	const fleet = [...but("a", { pulls: [pull(9)] }).map((each) => (each.handle === "b" ? { ...each, pulls: [pull(9), pull(4)] } : each))];
	town.follow(fleet);
	town.world.tick(1);
	expect(town.topics.map((topic) => (topic.pulls ?? []).map((each) => each.number))).toEqual([[4, 9], []]);
	expect(town.world.revision()).toBe(1);
	// The same again: nothing to say.
	town.follow(fleet);
	town.world.tick(2);
	expect(town.world.revision()).toBe(1);
	// One more check ended: the gauge moves. No figure moved.
	town.follow(fleet.map((each) => ({ ...each, pulls: each.pulls.map((seen) => (seen.number === 9 ? pull(9, 3) : seen)) })));
	town.world.tick(3);
	expect([town.world.revision(), town.flights.length]).toEqual([2, 0]);
	// Its sessions closed: the subject has no pull request left.
	town.follow(FLEET.filter((each) => each.topic !== "Cache"));
	expect(town.topics[0]!.pulls).toEqual([]);
});

test("live: a subject's merges are the most its sessions say now; without a session left, those it had", () => {
	const town = townOf(FLEET);
	town.follow(FLEET.map((each) => (each.topic === "Cache" ? { ...each, merges: each.handle === "a" ? 3 : 2 } : each)));
	expect(town.topics.map((topic) => topic.merges)).toEqual([3, 0]);
	town.follow(FLEET.filter((each) => each.topic !== "Cache"));
	expect(town.topics[0]!.merges).toBe(3);
});

test("live: a session that opens is born at its place, from its building's door, and takes its name once whole", () => {
	const town = townOf(FLEET);
	town.follow([...FLEET, wanted("e", "Menu", 2)]);
	town.world.tick(1);
	expect(town.flights.map((flight) => flight.born)).toEqual([true]);
	// The door of the second subject's building, 40 away.
	expect(town.flights[0]!.parent[0]).toBeGreaterThan(30);
	expect([town.people().length, town.named().includes("Agent e"), town.topics[1]!.waiting]).toEqual([5, false, 1]);
	town.world.tick(1 + BIRTH + 0.1);
	expect([town.named().includes("Agent e"), town.carried()]).toEqual([true, [1, 2, 1]]);
});

test("live: a session that closes goes, then leaves its place to who comes next", () => {
	const town = townOf(FLEET);
	town.follow(FLEET.filter((each) => each.handle !== "c"));
	town.world.tick(1);
	expect([town.flights.map((flight) => flight.born), town.people().length, town.named().includes("Agent c")]).toEqual([[false], 4, false]);
	town.world.tick(1 + END + 0.1);
	expect([town.people().length, town.carried(), town.topics[0]!.waiting]).toEqual([3, [1, 0, 1], 0]);
	town.follow(FLEET);
	town.world.tick(5);
	expect([town.people().length, town.flights.at(-1)?.born]).toEqual([4, true]);
});

test("live: an agent that changes state goes from its old place while it is born at the new one, in its new colour", () => {
	const town = townOf(FLEET);
	const stood = town.people().find((each) => each.state === 0)!;
	const at = [stood.x, stood.z];
	town.follow(but("a", { state: 1 }));
	town.world.tick(1);
	expect(town.flights.map((flight) => flight.born).toSorted()).toEqual([false, true]);
	// Its second body goes where it stood; the figure, at work, is born elsewhere with its crate.
	const going = town.people().filter((each) => each.w < 0);
	expect(going.map((each) => [each.x, each.z, each.color])).toEqual([[at[0], at[1], STATE[0]]]);
	expect(
		town
			.people()
			.filter((each) => each.w > 0)
			.map((each) => [each.state, each.color]),
	).toEqual([[1, STATE[1]]]);
	expect([town.people().length, town.carried(), town.topics[0]!.working]).toEqual([5, [2, 1, 1], 2]);
	town.world.tick(1 + BIRTH + 0.1);
	town.world.tick(1 + BIRTH + 0.2);
	expect([town.people().length, town.named().length]).toEqual([4, 4]);
});

test("live: an agent that changes subject goes from the old one's place and is born on the new one's", () => {
	const town = townOf(FLEET);
	town.follow(but("a", { topic: "Menu" }));
	town.world.tick(1);
	expect(town.flights.map((flight) => [flight.born, flight.parent[0] > 30]).toSorted()).toEqual([
		[false, false],
		[true, true],
	]);
	town.world.tick(1 + BIRTH + 0.1);
	expect(town.topics.map((topic) => topic.agents.length)).toEqual([2, 2]);
});

test("live: a subagent that starts is a robot born from its agent, one that ends turns grey, one no longer listed goes", () => {
	const town = townOf(FLEET);
	town.follow(but("c", { children: [1] }));
	town.world.tick(1);
	expect([town.flights.map((flight) => flight.born), town.robots().map((each) => each.color)]).toEqual([[true], [STATE[1]]]);
	// Its matter comes from its agent's chest, on the first subject's place.
	expect(Math.abs(town.flights[0]!.parent[0])).toBeLessThan(10);
	town.world.tick(1 + BIRTH + 0.1);
	town.follow(but("c", { children: [0] }));
	town.world.tick(5);
	expect([town.flights.length, town.robots().map((each) => each.color)]).toEqual([1, [GREY]]);
	town.follow(FLEET);
	town.world.tick(6);
	expect([town.flights.at(-1)?.born, town.robots().length]).toEqual([false, 1]);
	town.world.tick(6 + END + 0.1);
	expect(town.robots().length).toBe(0);
});

test("live: an agent that changes twice while it is born ends in the last state", () => {
	const town = townOf(FLEET);
	town.follow(but("a", { state: 1 }));
	town.world.tick(1);
	town.follow(but("a", { state: 2 }));
	town.world.tick(1.5);
	// The birth under way is not played backwards.
	expect(town.flights.length).toBe(2);
	for (const second of [1 + BIRTH + 0.1, 1 + 2 * BIRTH + 0.3, 1 + 2 * BIRTH + 0.4]) town.world.tick(second);
	expect([town.flights.length, town.carried(), town.people().length, town.topics[0]!.waiting]).toEqual([4, [1, 2, 1], 4, 2]);
});

test("live: where the camera shows no figure, and for what changed while the town was not looked at, a change is there at once", () => {
	const changed = [...but("a", { state: 3 }).filter((each) => each.handle !== "b"), wanted("e", "Cache", 1, [1, 0])];
	for (const [seen, now] of [
		[false, false],
		[true, true],
	] as const) {
		const town = townOf(FLEET, seen);
		town.follow(changed, now);
		town.world.tick(1);
		town.world.tick(1.1);
		expect([town.flights.length, town.people().length, town.robots().length, town.carried()]).toEqual([0, 4, 2, [1, 1, 2]]);
		expect(town.named().toSorted()).toEqual(["Agent a", "Agent c", "Agent d", "Agent e"]);
	}
});

test("live: twelve sessions opened together come as a wave, 0.18 s apart, in their order", () => {
	const town = townOf(FLEET);
	town.follow([...FLEET, ...Array.from({ length: 12 }, (_, at) => wanted(`n${at}`, "Menu", at % 4))]);
	const born: number[] = [];
	for (let frame = 0; frame <= 180; frame++) {
		town.world.tick(1 + frame / 60);
		while (born.length < town.flights.length) born.push(1 + frame / 60);
	}
	expect(born.length).toBe(12);
	const gaps = born.slice(1).map((at, index) => at - born[index]!);
	expect([Math.min(...gaps) >= 0.18 - 1e-9, born.at(-1)! - born[0]! < 2.3]).toEqual([true, true]);
	expect(SPARE).toBeGreaterThanOrEqual(12);
});

const count = (held: number[][]): number[] => held.map((sizes) => sizes.length);

test("live: one at work holds its tool's thing in place of its crate, in a town just opened as in one that followed", () => {
	// "b" reads, "e" writes, "f" runs a command, "g" uses another tool.
	const fleet = [...but("b", { act: 1 }), ...[2, 3, 0].map((act, at) => ({ ...wanted("efg"[at]!, "Menu", 1), act }))];
	const opened = townOf(fleet);
	opened.world.tick(1);
	expect(count(opened.held())).toEqual([1, 1, 1, 1]);
	// Its arms say its tool: the state its figure's shader reads is 1 and its tool, in tenths.
	expect(
		opened
			.people()
			.filter((each) => each.state >= 1 && each.state < 2)
			.map((each) => each.state.toFixed(1))
			.toSorted(),
	).toEqual(["1.0", "1.1", "1.2", "1.3"]);
	const followed = townOf(FLEET);
	followed.follow(fleet);
	for (let frame = 0; frame <= 4 * 60; frame++) followed.world.tick(1 + frame / 60);
	expect(count(followed.held())).toEqual([1, 1, 1, 1]);
	expect(followed.people().length).toBe(opened.people().length);
});

test("live: an agent that takes another tool swaps what it holds in 0.35 s, without a birth, and its sign is not written again", () => {
	const town = townOf(FLEET);
	town.world.tick(1);
	const [[whole]] = town.held() as [[number]];
	town.follow(but("b", { act: 2 }));
	town.world.tick(1);
	// Its crate is still whole, its hammer not there yet.
	expect(town.held()).toEqual([[whole], [], [], []]);
	town.world.tick(1 + SWAP / 2);
	const [[crate], , [hammer]] = town.held() as [[number], [], [number]];
	expect([crate, hammer].map((size) => (size / whole).toFixed(2))).toEqual(["0.50", "0.50"]);
	town.world.tick(1 + SWAP + 0.01);
	expect(town.held()).toEqual([[], [], [whole], []]);
	expect([town.flights.length, town.world.revision(), town.people().length]).toEqual([0, 0, 4]);
	// Back to a tool without a thing of its own: its crate again.
	town.follow(FLEET);
	town.world.tick(3);
	town.world.tick(3 + SWAP + 0.01);
	expect(town.held()).toEqual([[whole], [], [], []]);
});

test("live: where the camera shows no figure, and for what changed while the town was not looked at, another tool is held at once", () => {
	for (const [seen, now] of [
		[false, false],
		[true, true],
	] as const) {
		const town = townOf(FLEET, seen);
		town.follow(but("b", { act: 3 }), now);
		town.world.tick(1);
		expect(count(town.held())).toEqual([0, 0, 0, 1]);
	}
});

test("live: one that stops working, or whose session closes while it swaps, leaves nothing it held behind", () => {
	const stops = townOf(but("b", { act: 1 }));
	stops.follow(but("b", { state: 0 }));
	stops.world.tick(1);
	// Its second body goes with its book.
	expect(count(stops.held())).toEqual([0, 1, 0, 0]);
	stops.world.tick(1 + BIRTH + 0.1);
	stops.world.tick(1 + BIRTH + 0.2);
	expect(count(stops.held())).toEqual([0, 0, 0, 0]);
	const closes = townOf(FLEET);
	closes.follow(but("b", { act: 2 }));
	closes.world.tick(1);
	closes.follow(FLEET.filter((each) => each.handle !== "b"));
	for (let frame = 1; frame <= 3 * 60; frame++) closes.world.tick(1 + frame / 60);
	expect([count(closes.held()), closes.people().length]).toEqual([[0, 0, 0, 0], 3]);
	// Who takes its place holds its own thing, whole.
	closes.follow(but("b", { act: 2 }));
	for (let frame = 1; frame <= 3 * 60; frame++) closes.world.tick(5 + frame / 60);
	const taker = closes.people().find((each) => each.state.toFixed(1) === "1.2")!;
	expect(closes.held()).toEqual([[], [], [taker.s], []]);
});

test("live: a neighbour that comes while one swaps what it holds does not cut the swap short", () => {
	const town = townOf(FLEET);
	town.world.tick(1);
	const swaps = but("b", { act: 2 });
	town.follow(swaps);
	town.world.tick(1);
	// Its place is laid again for who comes.
	town.follow([...swaps, wanted("e", "Cache", 0)]);
	town.world.tick(1 + SWAP / 2);
	expect(count(town.held())).toEqual([1, 0, 1, 0]);
	town.world.tick(1 + SWAP + 0.01);
	expect(count(town.held())).toEqual([0, 0, 1, 0]);
});

const MANY = ["Cache", "Menu", "Carte", "Voix"];

test("live: past forty figures born or going at once, a change is there at once", () => {
	// Fourteen agents a subject change in 2.5 s of wave, less than a birth lasts: without a limit, all 56 play at once.
	const fleet = Array.from({ length: 56 }, (_, at) => wanted(`s${at}`, MANY[at % 4]!, 0));
	const town = townOf(fleet, true, MANY);
	town.follow(fleet.map((each) => ({ ...each, state: 2 })));
	for (let frame = 0; frame <= 8 * 60; frame++) town.world.tick(1 + frame / 60);
	// Two flights a change played: the body that goes, the figure that is born. The 16 others changed at once.
	expect(town.flights.length).toBe(2 * 40);
	// Fourteen wait on each place: their bubbles are one large bubble a place (./heaps.ts).
	expect([town.carried(), town.rounds().length, town.people().length]).toEqual([[0, 0, 0], 4, 56]);
});

test("live: agents of several subjects that change in one message start two a frame, not all in one", () => {
	const fleet = MANY.map((topic, at) => wanted(`s${at}`, topic, 0));
	const town = townOf(fleet, true, MANY);
	town.follow(fleet.map((each) => ({ ...each, state: 2 })));
	const flights: number[] = [];
	for (let frame = 0; frame < 4; frame++) {
		town.world.tick(1 + frame / 60);
		flights.push(town.flights.length);
	}
	// A figure's grains take time to make: four changes in one frame made a late frame.
	expect(flights).toEqual([4, 8, 8, 8]);
});

test("live: after a run of changes, each one stands where the crowd of the fleet as it is now puts it", () => {
	const town = townOf(FLEET);
	const runs = [
		[...FLEET, wanted("e", "Cache", 0), wanted("f", "Cache", 2, [1, 1, 0])],
		[...but("b", { state: 0 }), wanted("f", "Cache", 3, [1])],
		[...but("b", { state: 0 }).filter((each) => each.handle !== "a"), wanted("g", "Cache", 0)],
	];
	let second = 1;
	for (const run of runs) {
		town.follow(run);
		for (let frame = 0; frame < 8 * 60; frame++) town.world.tick((second += 1 / 60));
	}
	const cache = town.topics[0]!;
	expect(cache.agents.map((agent) => `${agent.handle}:${agent.state}`).toSorted()).toEqual(["b:0", "c:2", "g:0"]);
	const crowd = crowdOf(cache.agents, [], 1);
	const places = (list: { x: number; z: number }[]): string[] => list.map(({ x, z }) => `${x.toFixed(3)} ${z.toFixed(3)}`).toSorted();
	const standing = town.people().filter((each) => each.state !== 1 && each.x < 20);
	expect(places(standing)).toEqual(places(crowd.stands));
	expect([standing.length, town.people().length, town.robots().length, town.carried()]).toEqual([3, 4, 0, [0, 1, 1]]);
});
