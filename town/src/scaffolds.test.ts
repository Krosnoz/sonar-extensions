// A subject's open pull requests stand a scaffold round the top of its building (./scaffolds.ts). No process, no
// graphics card: the scaffolds are built on a kit that only records what it is asked to draw.
import { expect, test } from "bun:test";
import { uniform, vec3 } from "three/tsl";
import type { Kit, Topic, World } from "./kit";
import type { Flight } from "./layer-grains";
import type { Stage } from "./live-steps";
import { THREE } from "./nodes";
import type { Part } from "./parts";
import type { Pull } from "./pulls";
import type { Works } from "./scaffolds";

await import("./test-page");
const { scaffolds, WOOD, RED } = await import("./scaffolds");
const { END } = await import("./layers");
const { BIRTH } = await import("./births");

// An instance as its part draws it: where, its colour, and its mark (over 0 it is born at that second, under 0 it goes
// from it).
type Drawn = { x: number; y: number; z: number; color: string; w: number };
const pull = (number: number, red = false): Pull => ({
	url: `https://example.test/pull/${number}`,
	number,
	tone: red ? "tone-urgent" : "tone-wait",
	red,
	done: 2,
	total: 6,
});

// A town of one subject per list of `pulls`, 40 apart, each roof's foot 2.4 high, and what it draws of their scaffolds.
// `moves`: false with motion reduced.
function townOf(pulls: Pull[][], moves = true, works?: Works) {
	const drawn: Drawn[] = [];
	const kit = {
		night: false,
		aspect: 1.6,
		random: () => 0.5,
		uTime: uniform(0),
		scene: new THREE.Scene(),
		blank: vec3(0, 0, 0),
		along: () => 0,
		part(): Part {
			return {
				put: (given) => drawn.push({ x: given.x, y: given.y, z: given.z, color: given.color ?? "", w: given.w ?? 0 }) - 1,
				move: (index, x, y, z) => void Object.assign(drawn[index]!, { x, y, z }),
				set: (index, given) => void Object.assign(drawn[index]!, { x: given.x, y: given.y, z: given.z }, given.color !== undefined && { color: given.color }),
				mark: (index, at) => void (drawn[index]!.w = at),
			};
		},
	} satisfies Kit;
	const topics: Topic[] = pulls.map((list, at) => ({ name: `Subject ${at}`, agents: [], working: 0, waiting: 0, reviewing: 0, pulls: list }));
	const anchors: World["anchors"] = topics.map((topic, index) => ({ at: [index * 40, 4, 3], roof: [], crown: [], topic, index }));
	const flights: Flight[] = [];
	const stage: Stage = {
		add: (flight) => void flights.push(flight),
		size: () => 0.02,
		seen: () => true,
		moves: () => moves,
		bricks: () => undefined,
		rises: () => undefined,
		hear: (kind, at) => void heard.push(`${kind} ${at[0]}`),
	};
	// What the town's ear is told (./town-sound.ts): each event and the x of its place.
	const heard: string[] = [];
	const sites = scaffolds(kit, anchors, works);
	return {
		topics,
		flights,
		heard,
		// The scaffolds that stand in the town, from its first subject to its last.
		standing: (): Drawn[] => drawn.filter((each) => each.y > -1000).toSorted((a, b) => a.x - b.x),
		follow: (now = false) => sites.follow(stage, now),
		tick: sites.tick,
	};
}

test("a town opened on a subject with an open pull request shows its scaffold standing round its roof's foot", () => {
	const town = townOf([[pull(412)], []]);
	expect(town.standing()).toEqual([{ x: 0, y: 2.4, z: 3, color: WOOD, w: 0 }]);
	expect(town.flights).toEqual([]);
});

test("a pull request that opens while the town is open: its scaffold is born in layers, its matter from the door", () => {
	const town = townOf([[], []]);
	town.follow();
	town.tick(1);
	expect(town.standing()).toEqual([]);
	town.topics[1]!.pulls = [pull(7)];
	town.tick(2);
	const [born] = town.standing();
	expect(born).toMatchObject({ x: 40, y: 2.4, z: 3, color: WOOD });
	expect(born!.w).toBeGreaterThan(2);
	expect(town.flights.map((flight) => [flight.born, flight.parent[0], flight.grains.length > 0])).toEqual([[true, 40, true]]);
	// Whole once its layers are filled: as a scaffold the town opened on.
	town.tick(2 + BIRTH + 0.1);
	expect(town.standing()).toEqual([{ x: 40, y: 2.4, z: 3, color: WOOD, w: 0 }]);
});

test("its last pull request merged or closed: the scaffold goes in layers, back to the door, then is gone", () => {
	const town = townOf([[pull(412), pull(413)]]);
	town.follow();
	town.tick(1);
	town.topics[0]!.pulls = [pull(413)];
	town.tick(2);
	expect(town.standing().map((each) => each.w)).toEqual([0]);
	town.topics[0]!.pulls = [];
	town.tick(3);
	expect(town.standing().map((each) => each.w)).toEqual([-3]);
	expect(town.flights.map((flight) => flight.born)).toEqual([false]);
	town.tick(3 + END + 0.3);
	expect(town.standing()).toEqual([]);
});

test("a check that fails turns the scaffold red and shakes it for a moment; fixed, it is wood again", () => {
	const town = townOf([[pull(412)]]);
	town.follow();
	town.tick(1);
	town.topics[0]!.pulls = [pull(412, true)];
	town.tick(1.05);
	expect(town.standing()[0]).toMatchObject({ color: RED });
	expect(town.standing()[0]!.x).not.toBe(0);
	town.tick(2);
	expect(town.standing()).toEqual([{ x: 0, y: 2.4, z: 3, color: RED, w: 0 }]);
	town.topics[0]!.pulls = [pull(412)];
	town.tick(3);
	expect(town.standing()).toEqual([{ x: 0, y: 2.4, z: 3, color: WOOD, w: 0 }]);
});

test("the town's ear hears a scaffold that stands under the user's eyes, and its checks that fail; never what is there at once", () => {
	const town = townOf([[pull(412)], []]);
	town.follow();
	town.tick(1);
	// Opened on it: it stood already.
	expect(town.heard).toEqual([]);
	town.topics[1]!.pulls = [pull(7)];
	town.tick(2);
	expect(town.heard).toEqual([]);
	town.tick(2 + BIRTH + 0.1);
	expect(town.heard).toEqual(["frame 40"]);
	town.topics[0]!.pulls = [pull(412, true)];
	town.tick(4);
	expect(town.heard).toEqual(["frame 40", "red 0"]);
	// Red as it is born: heard red as it stands.
	town.topics[0]!.pulls = [];
	town.tick(5);
	town.tick(5 + END + 0.3);
	town.topics[0]!.pulls = [pull(9, true)];
	town.tick(7);
	town.tick(7 + BIRTH + 0.1);
	expect(town.heard).toEqual(["frame 40", "red 0", "red 0"]);
	for (const [now, moves] of [
		[true, true],
		[false, false],
	] as const) {
		const quick = townOf([[], [pull(9)]], moves);
		quick.follow();
		quick.tick(1);
		quick.topics[0]!.pulls = [pull(8, true)];
		quick.topics[1]!.pulls = [pull(9, true)];
		quick.follow(now);
		quick.tick(2);
		quick.tick(2 + BIRTH + 0.1);
		expect(quick.heard).toEqual([]);
	}
});

test("a scaffold that stands for a merge being laid, its subject without a pull request, is heard as a building site's", () => {
	let busy = false;
	const town = townOf([[]], true, { busy: () => busy, foot: () => 2.4 });
	town.follow();
	town.tick(1);
	busy = true;
	town.tick(2);
	town.tick(2 + BIRTH + 0.1);
	expect(town.heard).toEqual(["site 0"]);
});

test("one of several pull requests fails: the scaffold is red", () => {
	expect(townOf([[pull(1), pull(2, true)]]).standing()[0]!.color).toBe(RED);
});

test("what changed while the town was not looked at, or with motion reduced, is there at once: no layers, no grains, no shake", () => {
	for (const [now, moves] of [
		[true, true],
		[false, false],
	] as const) {
		const town = townOf([[], [pull(9)]], moves);
		town.topics[0]!.pulls = [pull(8, true)];
		town.topics[1]!.pulls = [];
		town.follow(now);
		town.tick(1);
		expect(town.standing()).toEqual([{ x: 0, y: 2.4, z: 3, color: RED, w: 0 }]);
		expect(town.flights).toEqual([]);
	}
});

test("a town that followed its pull requests shows the same scaffolds as a town opened anew", () => {
	const anew = townOf([[pull(1)], [], [pull(2, true), pull(3)]]);
	const followed = townOf([[], [pull(5)], []]);
	followed.follow();
	followed.tick(1);
	followed.topics.forEach((topic, at) => (topic.pulls = anew.topics[at]!.pulls!));
	for (let seconds = 1; seconds < 12; seconds += 0.1) followed.tick(seconds);
	expect(followed.standing()).toEqual(anew.standing());
});

test("a merge being laid stands the scaffold round the storey to come, without a pull request; laid, the scaffold goes", () => {
	const site = { busy: false, foot: 1.1 };
	const town = townOf([[]], true, { busy: () => site.busy, foot: () => site.foot });
	town.follow();
	town.tick(1);
	expect(town.standing()).toEqual([]);
	site.busy = true;
	town.tick(2);
	town.tick(2 + BIRTH + 0.1);
	expect(town.standing()).toEqual([{ x: 0, y: 1.1, z: 3, color: WOOD, w: 0 }]);
	site.busy = false;
	town.tick(8);
	town.tick(8 + END + 0.3);
	expect(town.standing()).toEqual([]);
});

test("a storey laid whole under an open pull request: the scaffold goes, and is born again round the next storey", () => {
	const site = { busy: false, foot: 1.1 };
	const town = townOf([[pull(412)]], true, { busy: () => site.busy, foot: () => site.foot });
	town.follow();
	town.tick(1);
	expect(town.standing()).toEqual([{ x: 0, y: 1.1, z: 3, color: WOOD, w: 0 }]);
	site.foot = 2.4;
	town.tick(2);
	// It goes from where it stood.
	expect(town.standing()).toEqual([{ x: 0, y: 1.1, z: 3, color: WOOD, w: -2 }]);
	for (let seconds = 2; seconds < 12; seconds += 0.1) town.tick(seconds);
	expect(town.standing()).toEqual([{ x: 0, y: 2.4, z: 3, color: WOOD, w: 0 }]);
});
