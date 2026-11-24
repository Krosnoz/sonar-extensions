// A merge of a subject is laid on its building while the town is open (./sites.ts): a truck, a crane, a pallet of
// bricks, then the share of the storey to come the merge lays. No process, no graphics card: the town's own building
// (./town-blocks.ts#raise) is built on a kit that only records what it is asked to draw.
import { expect, setDefaultTimeout, test } from "bun:test";
import { uniform, vec3 } from "three/tsl";
import type { Grain } from "./dust";
import type { Kit, Topic } from "./kit";
import type { Flight } from "./layer-grains";
import type { Stage } from "./live-steps";
import { THREE } from "./nodes";
import type { Part } from "./parts";

await import("./test-page");
const { sites } = await import("./sites");
const { partsOf, raise, OVER } = await import("./town-blocks");
const { finish } = await import("./steps");
const { GH, SH, T } = await import("./shapes");
const { ROAD } = await import("./street");

// A case lays its merges frame by frame, forty-five seconds of the town each: seconds on a calm machine, past a test's
// five on a busy one.
setDefaultTimeout(120_000);

// An instance as its part draws it. `mark`: over 0 it is born at that second, under 0 it goes from it.
type Drawn = { x: number; y: number; z: number; state?: number; mark: number };
type Recorded = Part & { drawn: Drawn[] };
const round = (value: number): number => Math.round(value * 1e6) / 1e6;
// The height of the foot of a storey, the first one over the ground floor being 0.
const foot = (storey: number): number => round(0.1 + GH + storey * SH);

// A town of one subject with `merges`, in the middle of a street of three blocks, and what it draws.
// `moves`: false with motion reduced.
function townOf(merges: number, moves = true) {
	const made: Recorded[] = [];
	let seed = 7;
	const kit = {
		night: false,
		aspect: 1.6,
		random: () => (seed = (seed * 16807) % 2147483647) / 2147483647,
		uTime: uniform(0),
		scene: new THREE.Scene(),
		blank: vec3(0, 0, 0),
		along: () => 0,
		part(): Part {
			const drawn: Drawn[] = [];
			const part: Recorded = {
				drawn,
				put: (given) => drawn.push({ x: given.x, y: given.y, z: given.z, mark: 0, ...(given.state === undefined ? {} : { state: given.state }) }) - 1,
				move: (index, x, y, z) => void Object.assign(drawn[index]!, { x, y, z }),
				set: (index, given) =>
					void Object.assign(drawn[index]!, { x: given.x, y: given.y, z: given.z }, given.state === undefined ? {} : { state: given.state }),
				mark: (index, at) => void (drawn[index]!.mark = at),
			};
			made.push(part);
			return part;
		},
	} satisfies Kit;
	const topic: Topic = { name: "Subject", agents: [], working: 0, waiting: 0, reviewing: 0, pulls: [], merges };
	const parts = finish(partsOf(kit, 1));
	const blocks = [-1, 0, 1].map((i) => ({ i, j: 0, x: i * T, z: 0, topic: i === 0 ? 0 : -1 }));
	const { anchor, house } = raise(kit, parts, topic, 0, blocks[1]!);
	const [flights, poured, risen, hidden]: [Flight[], Grain[][], number[], number[]] = [[], [], [], []];
	const stage: Stage = {
		add: (flight) => void flights.push(flight),
		size: () => 0.02,
		seen: () => true,
		moves: () => moves,
		bricks: (grains) => void poured.push(grains),
		rises: (top) => void risen.push(top),
		hear: (kind) => void heard.push(kind),
		knock: ([, y], high) => void knocked.push([y, high]),
	};
	// What the town's ear is told (./town-sound.ts): each event, and where and how high each brick heard lands.
	const [heard, knocked]: [string[], [number, number][]] = [[], []];
	const heights = { lamps: [], add: (...given: number[]) => void hidden.push(given[4]!), hides: () => false } as never;
	const works = sites(kit, [anchor], [house], { all: blocks, of: () => blocks[1]! }, heights);
	const [masts, jibs, , , trucks, pallets] = made.slice(-6);
	const there = (part: Recorded | undefined): Drawn[] => part!.drawn.filter((each) => each.y > -1000);
	const drawnOf = (list: Part[]): Drawn[] => list.flatMap((part) => (part as Recorded).drawn);
	let now = 0;
	return {
		topic,
		anchor,
		flights,
		poured,
		risen,
		hidden,
		heard,
		knocked,
		works,
		follow: (sudden = false) => works.follow(stage, sudden),
		// The town's frames until the second `until`, twenty a second, or one each `step` seconds. `each` sees what stands
		// after each one.
		run(until: number, each: () => void = () => undefined, step = 0.05): void {
			for (; now < until; now += step) {
				works.tick(now);
				each();
			}
		},
		crane: () => [...there(masts), ...there(jibs)],
		truck: () => there(trucks),
		pallet: () => there(pallets),
		// How high the net of a storey nothing is laid of yet stands, as a share of the storey: none once a brick is laid.
		net: () =>
			drawnOf(parts.rising)
				.filter((each) => (each.state ?? 0) < 0)
				.map((each) => -each.state!),
		// What the building shows: the feet of its whole storeys, the foot of the one being laid and its share, the foot
		// of its roof and the height of its sign.
		shown() {
			const storeys = [...drawnOf(parts.storeys), ...drawnOf(parts.rising)].filter((each) => each.y > -1000);
			return {
				whole: storeys
					.filter((each) => (each.state ?? 0) === 0 || each.state! > 1)
					.map((each) => round(each.y))
					.toSorted((a, b) => a - b),
				laid: storeys.filter((each) => each.state! > 0 && each.state! <= 1).map((each) => [round(each.y), round(each.state!)]),
				roof: drawnOf([...parts.roofs, ...parts.flats, ...parts.mansards]).map((each) => round(each.y)),
				sign: round(anchor.at[1]),
			};
		},
	};
}
// Long enough for a merge to be laid, and for its truck and its crane to go.
const LAID = 45;

test("a merge told while the town is open: a truck brings a pallet, a crane lifts it, its bricks lay the merge's share", () => {
	const town = townOf(4);
	town.follow();
	town.run(1);
	expect([town.crane(), town.truck(), town.poured]).toEqual([[], [], []]);
	expect(town.shown()).toMatchObject({ whole: [foot(0), foot(1), foot(2)], laid: [[foot(3), 0.25]], roof: [foot(4)] });
	town.topic.merges = 5;
	const seen = { truck: false, crane: false, carried: 0, east: 0, west: 0 };
	town.run(LAID, () => {
		seen.truck ||= town.truck().some((each) => each.y === ROAD);
		seen.crane ||= town.crane().length > 1;
		seen.carried = Math.max(seen.carried, ...town.pallet().map((each) => each.y));
		[seen.east, seen.west] = [Math.max(seen.east, ...town.truck().map((each) => each.x)), Math.min(seen.west, ...town.truck().map((each) => each.x))];
	});
	expect(seen).toMatchObject({ truck: true, crane: true });
	// The truck came by one end of the street, and left by the other.
	expect([seen.east > T, seen.west < -T]).toEqual([true, true]);
	// The pallet went up to the storey it lays.
	expect(seen.carried).toBeGreaterThan(foot(3));
	// One throw, of bricks in a low spray, which land on the storey between the share laid before and the one laid now.
	expect(town.poured.length).toBe(1);
	const bricks = town.poured[0]!;
	expect(bricks.length).toBeGreaterThanOrEqual(40);
	expect(bricks.every((brick) => brick.brick && brick.spray === 0.6)).toBe(true);
	expect(bricks.every((brick) => brick.end[1] >= foot(3) + 0.25 * SH - 1e-6 && brick.end[1] <= foot(3) + 0.5 * SH + 1e-6)).toBe(true);
	expect(town.shown()).toMatchObject({ whole: [foot(0), foot(1), foot(2)], laid: [[foot(3), 0.5]], roof: [foot(4)] });
	// Then the truck, the pallet and the crane are gone.
	expect([town.crane(), town.truck(), town.pallet()]).toEqual([[], [], []]);
});

test("a merge that begins a storey lifts the roof and the sign over it", () => {
	const town = townOf(3);
	town.follow();
	town.run(1);
	const before = town.shown();
	expect(before).toMatchObject({ whole: [foot(0), foot(1), foot(2)], laid: [], roof: [foot(3)] });
	town.topic.merges = 4;
	// While the roof goes up, the storey's net goes up under it, as high as the roof: no void under a roof in the air.
	const nets: number[] = [];
	town.run(LAID, () => {
		const [net] = town.net();
		if (net === undefined) return;
		nets.push(net);
		expect(net).toBeCloseTo((town.shown().roof[0]! - foot(3)) / SH, 5);
	});
	expect(nets.length).toBeGreaterThan(10);
	expect(Math.max(...nets)).toBeGreaterThan(0.95);
	expect(town.net()).toEqual([]);
	expect(town.shown()).toEqual({ whole: before.whole, laid: [[foot(3), 0.25]], roof: [foot(4)], sign: round(before.sign + SH) });
	// The town stands that high now, for what builds its cubes and what hides a name behind a wall.
	expect(Math.max(...town.risen)).toBeCloseTo(foot(4) + OVER + 0.2, 6);
	expect(Math.max(...town.hidden)).toBeCloseTo(foot(4) + OVER, 6);
});

test("a town that followed its merges shows what a town opened after them shows", () => {
	for (const [from, to] of [
		[0, 1],
		[1, 2],
		[2, 3],
		[5, 7],
		[0, 3],
		[250, 255],
	] as const) {
		const town = townOf(from);
		town.follow();
		town.run(1);
		town.topic.merges = to;
		town.run(1 + (to - from) * LAID);
		expect([from, to, town.shown()]).toEqual([from, to, townOf(to).shown()]);
		expect([town.crane(), town.truck(), town.pallet()]).toEqual([[], [], []]);
	}
	// A town drawn twice a second lays a merge in the same time: its truck keeps its pace.
	const slow = townOf(0);
	slow.follow();
	slow.run(1);
	slow.topic.merges = 1;
	slow.run(1 + LAID, undefined, 0.5);
	expect(slow.shown()).toEqual(townOf(1).shown());
	expect([slow.crane(), slow.truck(), slow.pallet()]).toEqual([[], [], []]);
});

test("merges told together bring a truck each, one after the other; past three, the older ones are laid at once", () => {
	const town = townOf(8);
	town.follow();
	town.run(1);
	town.topic.merges = 10;
	let most = 0;
	town.run(3 * LAID, () => (most = Math.max(most, town.truck().length)));
	expect([town.poured.length, most]).toEqual([2, 1]);
	const crowd = townOf(8);
	crowd.follow();
	crowd.run(1);
	crowd.topic.merges = 13;
	crowd.run(1.2);
	expect(crowd.shown().laid).toEqual([[foot(4), 0.375]]);
	crowd.run(4 * LAID);
	expect(crowd.poured.length).toBe(3);
	expect(crowd.shown()).toEqual(townOf(13).shown());
});

test("the town's ear hears a merge's bricks as they land on its storey, then the merge in the building, or its storey done", () => {
	const town = townOf(4);
	town.follow();
	town.run(1);
	town.topic.merges = 5;
	town.run(LAID);
	// The bricks land between the share laid before and the one laid now, a little higher each frame.
	expect(town.knocked.length).toBeGreaterThan(3);
	expect(
		town.knocked.every(([y], at) => y >= foot(3) + 0.25 * SH - 1e-6 && y <= foot(3) + 0.5 * SH + 1e-6 && (at === 0 || y >= town.knocked[at - 1]![0])),
	).toBe(true);
	expect(town.knocked.every(([, high]) => high > 3 / 9 && high < 4 / 9)).toBe(true);
	expect(town.heard).toEqual(["merged"]);
	// The merge that ends a storey: heard done.
	const done = townOf(6);
	done.follow();
	done.run(1);
	done.topic.merges = 7;
	done.run(LAID);
	expect(done.heard).toEqual(["built"]);
});

test("the town's ear hears nothing of a merge laid at once", () => {
	for (const [moves, sudden] of [
		[false, false],
		[true, true],
	] as const) {
		const town = townOf(6, moves);
		town.follow();
		town.run(1);
		town.topic.merges = 7;
		town.follow(sudden);
		town.run(LAID);
		expect([town.heard, town.knocked]).toEqual([[], []]);
	}
});

test("with motion reduced, or for what changed while the town was not looked at, a merge is laid at once", () => {
	for (const [moves, sudden] of [
		[false, false],
		[true, true],
	] as const) {
		const town = townOf(6, moves);
		town.follow();
		town.run(1);
		town.topic.merges = 7;
		town.follow(sudden);
		town.run(1.1);
		expect(town.shown()).toEqual(townOf(7).shown());
		expect([town.flights, town.poured, town.crane(), town.truck()]).toEqual([[], [], [], []]);
	}
});

test("motion reduced while a merge is laid: the building shows it at once, and nothing of the site is left", () => {
	let moves = true;
	const town = townOf(1);
	town.works.follow({ add: () => undefined, size: () => 0.02, seen: () => true, moves: () => moves, bricks: () => undefined, rises: () => undefined });
	town.run(1);
	town.topic.merges = 2;
	town.run(8);
	expect(town.crane().length).toBeGreaterThan(1);
	moves = false;
	town.run(8.1);
	expect(town.shown()).toEqual(townOf(2).shown());
	expect([town.crane(), town.truck(), town.pallet()]).toEqual([[], [], []]);
});

test("a crane makes the grains of its mast a length at a time, as it is born and as it goes: no frame makes them all", () => {
	const town = townOf(1);
	town.follow();
	town.run(1);
	town.topic.merges = 2;
	let [before, most] = [0, 0];
	town.run(LAID, () => {
		most = Math.max(most, town.flights.length - before);
		before = town.flights.length;
	});
	// The mast has several lengths, and each made its flight; a frame made two at most (a length, and the jib).
	expect(town.flights.length).toBeGreaterThan(6);
	expect(most).toBeLessThanOrEqual(2);
});

test("nothing comes for a merge that lays nothing, nor for a pull request closed without a merge", () => {
	// At its most storeys, a building takes no more.
	const high = townOf(300);
	high.follow();
	high.run(1);
	high.topic.merges = 301;
	let came = 0;
	high.run(10, () => (came += high.truck().length + high.crane().length));
	expect([came, high.poured, high.shown()]).toEqual([0, [], townOf(300).shown()]);
	// A pull request that opens, then closes, leaves the merges as they were.
	const town = townOf(2);
	town.follow();
	town.run(1);
	town.topic.pulls = [{ url: "https://example.test/pull/7", number: 7, tone: "tone-wait", red: false, done: 1, total: 4 }];
	town.run(3);
	town.topic.pulls = [];
	town.run(10, () => (came += town.truck().length + town.crane().length));
	expect([came, town.poured, town.shown()]).toEqual([0, [], townOf(2).shown()]);
});

test("fewer merges told while the roof goes up over a storey, then motion reduced: the roof is back down, and no net is left over it", () => {
	let moves = true;
	const town = townOf(3);
	town.works.follow({ add: () => undefined, size: () => 0.02, seen: () => true, moves: () => moves, bricks: () => undefined, rises: () => undefined });
	town.run(1);
	town.topic.merges = 4;
	let until = 1;
	while (town.net().length === 0 && until < LAID) town.run((until += 0.05));
	expect(town.net().length).toBe(1);
	[town.topic.merges, moves] = [3, false];
	town.run(until + 0.1);
	expect(town.net()).toEqual([]);
	expect(town.shown()).toEqual(townOf(3).shown());
	// The storey begins again later: its net is back under the roof that goes up.
	[town.topic.merges, moves] = [4, true];
	const nets: number[] = [];
	town.run(until + LAID, () => nets.push(...town.net()));
	expect(Math.max(...nets)).toBeGreaterThan(0.95);
	expect(town.shown()).toEqual(townOf(4).shown());
});

test("fewer merges told than the building shows: it keeps its storeys while the town is open", () => {
	const town = townOf(5);
	town.follow();
	town.run(1);
	town.topic.merges = 2;
	town.run(10);
	expect([town.shown(), town.poured, town.crane()]).toEqual([townOf(5).shown(), [], []]);
});
