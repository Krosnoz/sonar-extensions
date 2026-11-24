// Each cell of the page gets its place in the town and its flight there. A card gives its building and its inhabitant;
// a zone seen from far gives its building, its ground and its inhabitants; a zone that shows its cards gives its ground.
// The left of a card feeds the left of its building. The page leaves in two dissolves at the same instant, which the eye
// tells apart: what builds flies as bricks, what lands on the ground as dust (./dust.ts).
import { SHORTEST, laid, waits } from "./brick-waits";
import type { Cell } from "./cells";
import type { Grain } from "./dust";
import { TEXT, patches, type Reach } from "./edge";
import type { Figure, Mounted, Topic } from "./kit";
import { STATE } from "./state-colours";
import { THREE } from "./nodes";
import { body, bricks, tiles, type Place } from "./places";
import type { Sheet } from "./sheets";

// The front starts this late, so that even the first building's cubes leave their card one after the other; the first
// take off at once: the page answers the click.
export const HOLD = 1.4;
// The cubes start this far towards the camera, so they fly over the town and come down into their place.
const DEPTH = 120;

const flying = (sheet: Sheet): Cell[] => sheet.cells.filter((cell) => cell.flies);
// Left to right, a little at random, the bottom of a line first: the order the front lays the building.
function ordered(sheet: Sheet, bottom: number): Cell[] {
	const width = Math.min(260, sheet.element.getBoundingClientRect().width * 0.6);
	return flying(sheet)
		.map((cell) => ({ cell, key: cell.x + (patches(cell.x, cell.y) - 0.5) * width + (bottom - cell.y) * 0.1 }))
		.toSorted((a, b) => a.key - b.key)
		.map(({ cell }) => cell);
}

// What the town makes of a sheet's cells: the share that goes to its building, and to its inhabitants.
type Share = { house: number; people: number };
function shareOf(sheet: Sheet, still: Figure[]): Share {
	if (sheet.card) return sheet.card.state === 1 ? { house: 1, people: 0 } : { house: 0.8, people: 0.2 };
	if (sheet.zoneOfCards) return { house: 0, people: 0 };
	return still.length ? { house: 0.6, people: 0.15 } : { house: 0.7, people: 0 };
}

// Where a cell's point starts: where its cell is on the screen, nearer the camera than the town. Seen from the camera,
// the same place.
export function launcher(mounted: Mounted, host: HTMLElement): (at: [number, number, number], cell: Pick<Cell, "x" | "y">) => [number, number, number] {
	const { view, camera } = mounted.world;
	const unit = view.unit(view.scale);
	const box = host.getBoundingClientRect();
	camera.updateMatrixWorld();
	const m = camera.matrixWorld.elements;
	const right = new THREE.Vector3(m[0], m[1], m[2]).normalize();
	const up = new THREE.Vector3(m[4], m[5], m[6]).normalize();
	const back = new THREE.Vector3(m[8], m[9], m[10]).normalize();
	const spot = new THREE.Vector3();
	return (at, cell) => {
		spot.set(...at).project(camera);
		const [px, py] = [box.left + ((spot.x + 1) / 2) * box.width, box.top + ((1 - spot.y) / 2) * box.height];
		return new THREE.Vector3(...at)
			.addScaledVector(right, (cell.x - px) * unit)
			.addScaledVector(up, (py - cell.y) * unit)
			.addScaledVector(back, DEPTH)
			.toArray();
	};
}

// When each cell of a sheet leaves: as the page's edge reaches it, whatever it is of (a card, a zone, the ground), a
// text just after the background round it. The page leaves as one sheet: timed by the laying of its place in the town,
// or left a moment after the page round it, a card read as kept whole (18/11). Its points then fly longer, and land as
// their place is laid.
export function timed(cells: Cell[], edge: Reach): void {
	for (const cell of cells) cell.t0 = edge(cell.x, cell.y) + (cell.text ? TEXT : 0);
}

// How a cell's point looks as it flies. `size`: its cell's side, in pixels; `builds`: it lands on a building or an
// inhabitant; `dot`: a point of one pixel of the drawing, and `unit`: a pixel of the page, in the town's measure. What
// builds flies as a brick nearly its cell's size, so a gap shows between two bricks, and lands smaller; the rest is dust.
export function lookOf(size: number, builds: boolean, dot: number, unit: number): Pick<Grain, "brick" | "from" | "to"> {
	if (!builds) return { brick: false, from: dot, to: dot };
	const from = size * unit * 0.85;
	return { brick: true, from, to: Math.max(dot, from * 0.5) };
}

// A sheet's cells and their places, and which places are of its building, or of its building and its inhabitants.
type Dealt = { sheet: Sheet; cells: Cell[]; places: Place[]; mine: Set<Place>; building: Set<Place> };
// A block waits for the cubes of its cards: its ground for its points, its building for its bricks (./brick-waits.ts).
function blocksWait(mounted: Mounted, topics: Topic[], dealt: Dealt[]): void {
	topics.forEach((_, topic) => {
		const pairs = dealt
			.filter(({ sheet }) => sheet.topic === topic)
			.flatMap(({ cells, places, mine }) => cells.map((cell, at) => ({ cell, place: places[at]!, brick: mine.has(places[at]!) })));
		waits(
			mounted,
			mounted.world.lots[topic]!.house,
			pairs.filter((pair) => pair.brick),
			pairs.filter((pair) => !pair.brick),
			HOLD,
		);
	});
}

// `last`: when the last point lands.
// `edge`: when each point of the page leaves (./edge.ts).
export function flights(mounted: Mounted, topics: Topic[], sheets: Sheet[], host: HTMLElement, edge: Reach): { grains: Grain[]; last: number } {
	const world = mounted.world;
	let seed = 11;
	const random = (): number => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;
	// Not the spare figures, which no agent has taken (./bodies.ts#Life).
	const still = (topic: number): Figure[] => world.figures.filter((figure) => figure.topic === topic && figure.agent.state !== 1 && !figure.away);
	const share = (sheet: Sheet): Share => shareOf(sheet, still(sheet.topic));
	const feeders = topics.map((_, topic) => sheets.filter((sheet) => sheet.topic === topic && share(sheet).house > 0));
	const counts = feeders.map((list) => list.reduce((sum, sheet) => sum + Math.round(flying(sheet).length * share(sheet).house), 0));
	// A building's bricks go to its cards in turn, so each card feeds the whole building as it rises.
	const houses = topics.map((_, topic) => bricks(mounted, world.lots[topic]!.house, counts[topic]!, random).toSorted((a, b) => a.t1 - b.t1));
	const launch = launcher(mounted, host);
	const bottom = host.getBoundingClientRect().bottom;
	// A point of one pixel of the town's drawing, from the page to its place.
	const unit = world.view.unit(world.view.scale);
	const dot = mounted.pixel * unit * 1.2;
	const grains: Grain[] = [];
	let last = 0;
	for (const sheet of sheets) timed(sheet.cells, edge);
	// Each sheet's cells and their places, the first to leave on the first laid.
	const dealt = sheets
		.filter((each) => each.topic >= 0)
		.map((sheet) => {
			const cells = ordered(sheet, bottom);
			const part = share(sheet);
			const order = feeders[sheet.topic]!.indexOf(sheet);
			const every = feeders[sheet.topic]!.length;
			const mine = order < 0 ? [] : houses[sheet.topic]!.filter((_, at) => at % every === order).slice(0, Math.round(cells.length * part.house));
			const card = sheet.card;
			const figure = card ? world.figures.find((each) => each.agent.handle === card.handle && each.agent.state !== 1) : undefined;
			const folk = card ? (figure ? [figure] : []) : still(sheet.topic);
			const people = folk.length
				? Array.from({ length: Math.round(cells.length * part.people) }, (_, at) => {
						const one = folk[at % folk.length]!;
						return body(mounted, one.at, STATE[one.agent.state]!, random);
					})
				: [];
			const ground = tiles(mounted, world.lots[sheet.topic]!, cells.length - mine.length - people.length, random);
			const places = [...mine, ...people, ...ground].toSorted((a, b) => a.t1 - b.t1);
			return { sheet, cells, places, mine: new Set(mine), building: new Set([...mine, ...people]) };
		});
	blocksWait(mounted, topics, dealt);
	for (const { sheet, cells, places, mine, building } of dealt) {
		const house = world.lots[sheet.topic]!.house;
		cells.forEach((cell, at) => {
			const place = places[at]!;
			const natural = laid(mounted, place, mine.has(place) ? house : undefined) + HOLD;
			const t1 = Math.max(natural, cell.t0 + SHORTEST);
			last = Math.max(last, t1);
			grains.push({
				start: launch(place.at, cell),
				end: place.at,
				t0: cell.t0,
				t1,
				colour: cell.colour,
				into: place.colour,
				seed: random(),
				...lookOf(sheet.size, building.has(place), dot, unit),
			});
		});
	}
	return { grains, last };
}
