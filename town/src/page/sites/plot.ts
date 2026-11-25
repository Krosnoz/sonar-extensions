// A subject comes while the town is open: a session opens on a subject the town has no building for. The town held a
// block for it (../plan/layout.ts#cityGrid), where the town's decor stood (./held-block.ts). A front of its own crosses that
// block alone (./plot-mask.ts): the ground is laid again behind it, never taken away; what stood there leaves as
// bricks, the cubes a card's building is built of (../arrival/dust.ts), each thrown from where it stood to land on the new
// building, which rises bottom-up as they land, a scaffold round the storey being laid (./scaffolds.ts).
// Nothing is made up: the block is built for a subject one of the page's sessions has, and the town stays read only.
// With motion reduced, or for what changed while the town was not looked at, the block is built at once. One block a
// town's opening: the next subject shows at the next one.
import type { Old } from "../plan/city";
import type { Grain } from "../arrival/dust";
import type { Block } from "../plan/grid";
import type { Kit, Topic } from "../render/kit";
import { FLY } from "../people/layer-grains";
import { END } from "../people/layers";
import type { Stage, Wanted } from "../people/live-steps";
import { N } from "../render/nodes";
import { LAND, PLOT, STREET } from "../arrival/pace";
import type { House } from "./rising";
import { BD, BW, SH, T } from "../render/shapes";

type Point = [number, number, number];

// Where the block's front starts, in its bands, and the bands it crosses in a second.
const [FROM, PACE] = [-1.5, 1.235];
// The building's rise: its seconds, and how much of its height is laid at its start and at its end (its roof stands
// over its top, `ROOF` high).
const [RISE, LOW, HIGH, ROOF] = [3, -0.05, 1.2, 0.6];
// How many bricks build it, a brick's side as it leaves and as it lands, and the least a brick flies.
const [BRICKS, LEAVES, LANDS, SHORTEST] = [700, 1.5 / N, 0.9 / N, 0.6];
// How much of the spray of the town's opening the bricks keep.
const SPRAY = 0.6;
// The lowest its scaffold stands, and how long before the rise it is born: it stands when the first brick lands.
const [GROUND, LEAD] = [0.08, END + FLY * 1.2];
// A front that far, a share that high: the whole block is built.
const BUILT = 100;

// `topic`: the subject to come, the last of the town's (`index`). `house`, `block`: its building and its block, as the
// town built them, hidden. `old`: what stands there meanwhile. `high`: the town's top.
export type Held = { topic: Topic; index: number; house: House; block: Block; old: Old; high: number };

// The seconds of its building, from its start. `riseAt`: its ground lies under all of it, it rises; `total`: it is built.
function timesOf(kit: Kit, { house, block, high }: Held) {
	const { x, z } = house.wall;
	const top = house.top + ROOF;
	const need = (y: number): number => LAND + ((1 - LAND) * (y - STREET)) / Math.max(0.1, high - STREET);
	// How far a place lies along the block's front, in bands.
	const local = (px: number, pz: number): number => ((kit.along(px, 0, pz) - kit.along(block.x, 0, block.z)) / T) * PLOT.bands;
	const corners = [-1, 1].flatMap((a) => [-1, 1].map((b) => local(x + (a * BW) / 2, z + (b * BD) / 2)));
	const riseAt = (PLOT.relay + PLOT.ragged + Math.max(...corners) - FROM) / PACE + 0.1;
	return {
		top,
		riseAt,
		total: riseAt + RISE + 0.2,
		// When what stood at a place is taken.
		taken: ([px, py, pz]: Point): number => ((py >= STREET ? PLOT.old - need(py) : PLOT.relay + PLOT.ragged / 2) + local(px, pz) - FROM) / PACE,
		// When the building's height `y` is laid, and the share of its height laid at a second.
		laid: (y: number): number => riseAt + (((y - STREET) / (top - STREET) + 0.03 - LOW) / (HIGH - LOW)) * RISE,
		share: (since: number): number => (since < riseAt ? -1 : LOW + Math.min(1, (since - riseAt) / RISE) * (HIGH - LOW)),
	};
}
type Times = ReturnType<typeof timesOf>;

// The building's places, on the two sides the camera sees and on its roof (as ../arrival/places.ts#bricks).
function placesOf({ wall, top }: House): Point[] {
	const { x, z } = wall;
	const size = Math.sqrt(((BW + BD) * top + BW * BD) / BRICKS);
	const steps = (from: number, to: number): number[] =>
		Array.from({ length: Math.max(1, Math.floor((to - from) / size)) }, (_, at) => from + (at + 0.5) * size);
	const all: Point[] = [];
	for (const y of steps(GROUND, top)) {
		for (const pz of steps(z - BD / 2, z + BD / 2)) all.push([x + BW / 2, y, pz]);
		for (const px of steps(x - BW / 2, x + BW / 2)) all.push([px, y, z + BD / 2]);
	}
	for (const px of steps(x - BW / 2, x + BW / 2)) for (const pz of steps(z - BD / 2, z + BD / 2)) all.push([px, top + 0.2, pz]);
	return all;
}

// Each brick leaves what stood on the block as it is taken, the first taken for the first laid. `start`: the town's
// second the block's building starts at.
function bricksOf(kit: Kit, { house, old }: Held, times: Times, start: number): Grain[] {
	const from = old.standing.toSorted((a, b) => times.taken(a.at) - times.taken(b.at));
	if (!from.length) return [];
	const to = placesOf(house).toSorted((a, b) => a[1] - b[1] || kit.random() - 0.5);
	return to.map((end, at): Grain => {
		const source = from[Math.floor((at * from.length) / to.length)]!;
		const t1 = start + times.laid(end[1]);
		return {
			start: source.at,
			end,
			t0: Math.min(start + times.taken(source.at), t1 - SHORTEST),
			t1,
			colour: source.colour,
			into: house.wall.color,
			seed: kit.random(),
			brick: true,
			from: LEAVES,
			to: LANDS,
			spray: SPRAY,
		};
	});
}

export function plots(kit: Kit, held: Held, topics: Topic[]) {
	const { topic, index, house, block } = held;
	const show = (front: number, share: number, top: number): void => kit.plot?.(block.x, block.z, front, share, top);
	show(-BUILT, -1, house.top + ROOF);
	let stage: Stage | null = null;
	let [came, sudden, start, since] = [false, false, Infinity, 0];
	let times: Times | null = null;
	// When each brick lands and where, the first to land first, and how many have landed: they are heard as they land.
	let [landing, landed]: [[number, Point][], number] = [[], 0];
	// The bricks landed since the last frame are heard, unless what changed is there at once.
	const knocks = (on: Stage, seconds: number, quick: boolean): void => {
		const was = landed;
		while (landed < landing.length && landing[landed]![0] <= seconds) landed++;
		const last = landing[landed - 1];
		// Its roof's bricks land over its top: as high as it goes.
		if (landed > was && last && !quick) on.knock?.(last[1], Math.min(1, (last[1][1] - GROUND) / Math.max(0.1, house.top - GROUND)));
	};
	return {
		// The first subject of the page's sessions the town has no building for takes the block. `now`: what changed while
		// the town was not looked at is there at once. A session not filed yet takes none: every new session starts so,
		// and is most often filed under a subject that exists a moment later; the block is for the subject it gets.
		follow(wanted: Wanted[], on: Stage, now = false): void {
			[stage, sudden] = [on, sudden || now];
			if (came) return;
			const coming = wanted.find((each) => !each.unfiled && !topics.some((known) => known !== topic && known.name === each.topic));
			if (!coming) return;
			[came, topic.name] = [true, coming.topic];
		},
		// One step of the block's building. True once, when it is built: its subject is one of the town's.
		tick(seconds: number): boolean {
			if (!stage) return false;
			const quick = sudden || !stage.moves();
			sudden = false;
			if (!came || !topic.held) return false;
			if (start === Infinity) {
				// Its merges, if it has some, are laid already (./sites.ts): the building is as high as they make it.
				[start, times] = [Math.max(seconds, 0.001), timesOf(kit, held)];
				stage.rises(times.top);
				if (quick) start = -Infinity;
				else {
					const bricks = bricksOf(kit, held, times, start);
					stage.bricks(bricks, start + times.total + 0.3);
					landing = bricks.map((brick): [number, Point] => [brick.t1, brick.end]).toSorted((a, b) => a[0] - b[0]);
				}
			}
			since = seconds - start;
			knocks(stage, seconds, quick);
			if (since < times!.total) {
				show(FROM + since * PACE, times!.share(since), times!.top);
				return false;
			}
			show(BUILT, BUILT, times!.top);
			topic.held = false;
			// A building that rose under the user's eyes is heard done; one there at once is not.
			if (start !== -Infinity && !quick) stage.hear?.("built", [house.wall.x, times!.top, house.wall.z]);
			return true;
		},
		// Its scaffold stands from just before the building rises until it is built, round the storey being laid.
		busy: (at: number): boolean => at === index && !!times && topic.held === true && since >= times.riseAt - LEAD,
		foot(): number {
			const laid = STREET + Math.max(0, times?.share(since) ?? 0) * ((times?.top ?? 0) - STREET);
			return Math.min(house.top - SH, Math.max(GROUND, laid - SH / 2));
		},
	};
}
