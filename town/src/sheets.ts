// The page cut into sheets of cells before the town covers it: each zone of the map, and each card it shows. A zone seen
// from far shows its summary, not its cards: it is cut whole.
import { cut, type Cell } from "./cells";
import { pixelFor, type Topic } from "./kit";
import type { Source, Zone } from "./sources";

export type Sheet = {
	element: HTMLElement;
	cells: Cell[];
	size: number;
	topic: number;
	card?: Source;
	zoneOfCards: boolean;
};

// A brick's side, in pixels, at least: smaller, a brick did not show its faces; twice bigger, the bricks hid the town.
const BRICK = 9;

const bare = (colour: string): boolean => colour === "rgba(0, 0, 0, 0)" || colour === "transparent";
// The page's colour behind a zone or a row: a cell takes the colour the page really shows there.
function backdrop(): string {
	for (const element of [document.body, document.documentElement]) {
		const colour = getComputedStyle(element).backgroundColor;
		if (!bare(colour)) return colour;
	}
	return "#ffffff";
}

// How much of an element the screen shows, in square pixels: the map is zoomed, and what is off the screen leaves
// without a point.
export function onScreen(element: HTMLElement): number {
	const r = element.getBoundingClientRect();
	return Math.max(0, Math.min(innerWidth, r.right) - Math.max(0, r.left)) * Math.max(0, Math.min(innerHeight, r.bottom) - Math.max(0, r.top));
}

// `islands`: the map's zones; `shown`: the cards the map shows.
export function sheetsOf(islands: Zone[], shown: Source[], topics: Topic[], host: HTMLElement): Sheet[] {
	const topicOf = (name: string): number => topics.findIndex((topic) => topic.name === name);
	const under = backdrop();
	const area = [...islands.map((zone) => zone.element), ...shown.map((source) => source.element)].reduce((sum, element) => sum + onScreen(element), 0);
	// The page turns to dust: a point every two or three pixels, about twenty-four thousand at most, whatever the page.
	const size = Math.max(pixelFor(host.clientWidth, host.clientHeight) + 1, Math.round(Math.sqrt(area / 24000)));
	const sheet = (element: HTMLElement, topic: string, skip: DOMRect[], card?: Source): Sheet => {
		// What gives a building (a card, a zone seen from far) is cut into bricks, twice the dust's side or more: the eye
		// tells the bricks that build from the dust of the ground (./flights.ts).
		const side = card || !skip.length ? Math.max(size * 2, BRICK) : size;
		return { element, cells: cut(element, side, under, skip), size: side, topic: topicOf(topic), ...(card ? { card } : {}), zoneOfCards: skip.length > 0 };
	};
	return [
		...islands.map(({ element: island, topic }) =>
			sheet(
				island,
				topic,
				shown.filter((source) => island.contains(source.element)).map((source) => source.element.getBoundingClientRect()),
			),
		),
		...shown.map((source) => sheet(source.element, source.topic, [], source)),
	];
}
