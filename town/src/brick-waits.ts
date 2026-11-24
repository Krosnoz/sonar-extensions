// A subject's block is laid by the cubes of its cards, never before them. The front lays a block when it passes it, but
// a card leaves the page when the page's edge reaches it: a card that stands right of its block left after its building
// was built, and its bricks landed on a finished building, up to a second and a half late. The block now waits: its
// ground is laid when the last of its points can land, and its building rises as its bricks land (./delays.ts).
import type { Cell } from "./cells";
import type { Mounted } from "./kit";
import { STREET } from "./pace";
import type { Place } from "./places";

// A cube flies this long at least.
export const SHORTEST = 0.6;

type House = { at: [number, number] };
export type Pair = { cell: Cell; place: Place };

// A height's share of the way from the street to the town's top, as the building's material reads it.
const share = (mounted: Mounted, y: number): number => Math.min(1, Math.max(0, (y - STREET) / Math.max(0.1, mounted.world.top - STREET)));

// The construction time a cube's place is laid, its block's wait counted. `house`: the building the place is of, none
// for a place on the ground.
export const laid = (mounted: Mounted, place: Place, house?: House): number =>
	mounted.when(
		place.at,
		place.origin,
		house ? mounted.delays.read(house.at[0], house.at[1], share(mounted, place.at[1])) : mounted.delays.ground(place.origin[0], place.origin[2]),
	);

// Sets the waits of a subject's block from its cubes, each cell with its place: `bricks` on its building, `points` on
// its ground and its inhabitants. `hold`: how late the front starts.
export function waits(mounted: Mounted, house: House, bricks: Pair[], points: Pair[], hold: number): void {
	const ahead = (time: number): number => mounted.frontAt(time);
	// How many bands further the front must go for a place to be laid as its cube lands, at the soonest: over 0, the
	// place is laid before its cube can be there.
	const need = ({ cell, place }: Pair): number => (ahead(cell.t0 + SHORTEST - hold) - ahead(place.t1)) / mounted.band;
	// The front stops past the town: a wait longer than what it has left to go would leave the place unbuilt.
	const room = Math.min(...[...bricks, ...points].map(({ place }) => (ahead(Infinity) - ahead(place.t1)) / mounted.band - 0.05));
	const fit = (bands: number): number => Math.max(0, Math.min(room, bands));
	const ground = fit(Math.max(0, ...points.map(need)));
	const needs = bricks.map((pair) => ({ up: share(mounted, pair.place.at[1]), by: need(pair) }));
	// The roof's wait, by the bricks alone.
	const last = Math.max(0, ...needs.map((each) => each.by));
	const roof = Math.max(0.001, ...needs.map((each) => each.up));
	// The foot's wait: the least that leaves no brick late, when the wait grows with the height up to the roof's.
	const first = Math.min(
		last,
		Math.max(0, ...needs.filter((each) => each.up < roof).map((each) => (each.by - (last * each.up) / roof) / (1 - each.up / roof))),
	);
	// The building never rises before its ground, and takes as long to rise once its ground is there.
	const foot = fit(Math.max(ground, first));
	const most = fit(foot + last - first);
	// The material reads the wait at the town's top: the roof's, carried on along the same slope.
	mounted.delays.set(house.at[0], house.at[1], { foot, top: foot + (most - foot) / roof, ground });
}
