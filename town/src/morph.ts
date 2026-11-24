// The page breaks up into the town. Every card and every zone is cut into small cells of the colours the page shows
// there (./sheets.ts). As the front builds the town from left to right, the page leaves along one edge ahead of it
// (./edge.ts), in two dissolves at the same instant: its cells leave one by one, the ground's as dust that lands as a
// tile of its block, a card's as bricks that land on its subject's building or its inhabitant, just when the front lays
// that place (./flights.ts). The way back runs it all backwards: the bricks fly back into the page, which comes back
// whole.
import { shows } from "./cells";
import { covering } from "./cover";
import { dotsOf, reachOf, type Background } from "./dots";
import { dust } from "./dust";
import { edgeOf } from "./edge";
import { HOLD, flights } from "./flights";
import { framing } from "./framing";
import type { Mounted, Topic } from "./kit";
import { rim, sparksOf, type Glowing } from "./rim";
import { sheetsOf, type Sheet } from "./sheets";
import { mapFrame } from "./size";
import { sonar } from "./sonar";
import { fleetOf, type Source, type Zone } from "./sources";
import { reducedMotion } from "./look";
import { openWorld, type Opened } from "./view";
import { NEAR } from "./view-frames";
import { handBack } from "./steps";

// The colour the background's points take as they fall under the town (./dots.ts).
const SEA = { dark: "#30649e", light: "#5dbde0" };
const nothing = (): void => undefined;

// `back`: the cubes fly back into the page; `end`: the page whole at once (another project); `hide`: the town out of sight
// behind another tab, not drawn, kept as it is; `arrived`: the town built, the page all bricks.
// `follow`: the agents as the page shows them now (./live.ts).
export type Morph = { back: () => Promise<void>; end: () => void; hide: (hidden: boolean) => void; arrived: Promise<void>; follow: Mounted["follow"] };

// A frame this late (seconds), three in a row, is the machine's pace.
const SLOW = 0.25;
const LATES = 3;

// The construction's time. It advances by each frame's time, but a frame much later than the ones before (the page busy a
// moment, the town hidden behind another tab) counts as two of them: it slows the construction down and never skips a
// part of it. A machine slow all along keeps the real pace: after a few late frames in a row (SLOW seconds or more), a
// frame counts for its whole time, so that the arrival lasts the same seconds at 20 images a second or at 1. Before, the
// town's first frame took seconds, and the next one jumped over the cards' dissolve and half the town's rise; then a
// machine with no graphics card took ten frames (a minute) to arrive.
function paced(span: number): { tick: (seconds: number) => number; reverse: (pause: number) => void; forward: () => boolean } {
	let [time, direction, last, usual, lates] = [0, 1, -1, 1 / 60, 0];
	return {
		tick(seconds) {
			// With motion reduced, the page is the town at once, and back.
			if (reducedMotion()) return (time = direction > 0 ? span : 0);
			const late = last < 0 ? 0 : Math.max(0, seconds - last);
			lates = late >= SLOW ? lates + 1 : 0;
			const step = lates >= LATES ? late : Math.min(late, usual * 2);
			usual += (Math.min(late, 1) - usual) * 0.2;
			last = seconds;
			time = direction > 0 ? Math.min(span, time + step) : Math.max(0, time - step);
			return Math.min(span, time);
		},
		// Backwards, after `pause` seconds still.
		reverse(pause) {
			[time, direction] = [span + pause, -1];
		},
		forward: () => direction > 0,
	};
}

// The map's zones that hold the agents' cards, and how many columns they make: the town keeps the page's layout.
function zonesOf(sources: Source[]): { islands: Zone[]; columns: number | undefined } {
	const zones = new Map<HTMLElement, string>();
	for (const { island, topic } of sources) if (island && !zones.has(island)) zones.set(island, topic);
	const islands = [...zones].map(([element, topic]) => ({ element, topic }));
	const lefts = islands.map((island) => island.element.getBoundingClientRect().left);
	const columns = lefts.length ? lefts.filter((left, at) => lefts.findIndex((other) => Math.abs(other - left) < 80) === at).length : undefined;
	return { islands, columns };
}

// The points of the cells that leave, for the edge that glows where the page wears away: a card's and a zone's cells
// that take off, and every cell of the ground, so the edge burns all along.
const glowingOf = (cut: Pick<Sheet, "cells" | "size">[], background: Pick<Background, "cells" | "size">): Glowing[] =>
	[...cut.map((sheet) => ({ size: sheet.size, cells: sheet.cells.filter((cell) => cell.flies) })), background].flatMap(({ cells, size }) =>
		cells.filter((cell) => Number.isFinite(cell.t0)).map(({ x, y, t0 }) => ({ x, y, t0, size })),
	);

// The page as it wears away, at `built`: its cover hides it behind the edge, the edge glows. `background`: the map's
// ground (./dots.ts). `cover`: what hides the page itself (./cover.ts).
function wearing(
	cut: Sheet[],
	background: Background,
	edge: ReturnType<typeof rim>,
	cover: ReturnType<typeof covering>,
): { draw: (built: number) => void; clear: () => void } {
	const glowing = glowingOf(cut, background);
	return {
		draw(built) {
			cover.draw(built);
			edge.draw(glowing, built);
		},
		clear() {
			cover.clear();
			edge.dispose();
		},
	};
}

// Once every cube has landed, the camera steps back no farther than where the inhabitants still show.
function stepBack(opened: Opened, near: [number, number]): void {
	const view = opened.mounted.world.view;
	const seenScale = Math.min(view.most, Math.max(1, NEAR * 1.05 * view.unit(1)));
	opened.fly(seenScale, seenScale > 1 ? near : view.whole, true);
}

// Every point's flight, once the camera is where the cubes take off: the cards' into the town, the grid's into the sea.
// The grid's flights in a task of their own (./steps.ts): with the cards', they froze the page half a second.
async function planned(mounted: Mounted, topics: Topic[], cut: Sheet[], host: HTMLElement, theme: "light" | "dark") {
	mounted.focus();
	// The page leaves along one edge over the whole screen, its ground as its zones and its cards (./edge.ts).
	const edge = edgeOf(mapFrame(), reachOf(mounted, host));
	const cards = flights(mounted, topics, cut, host, edge);
	await handBack();
	const grid = dotsOf(mounted, host, SEA[theme], edge);
	return { grains: [...grid.grains, ...cards.grains], grid, last: Math.max(cards.last, grid.last), edge };
}

// The town opened under the page, the page cut into its cells, the camera where the cubes take off.
async function opening(sources: Source[], host: HTMLElement, theme: "light" | "dark", stop?: AbortSignal) {
	const { islands, columns } = zonesOf(sources);
	const topics = fleetOf(sources);
	// The page is cut before the town covers it.
	const shown = sources.filter((source) => shows(source.element));
	const cut = sheetsOf(islands, shown, topics, host);
	const opened = await openWorld(host, topics, theme, true, stop);
	opened.mounted.precompile();
	const { close, near } = framing(opened.mounted.world, topics, islands, columns, host);
	opened.jump(close, near);
	opened.keep(true);
	return { opened, topics, cut, close, near };
}

// Without a sea, nothing hides what the page keeps under the town (zone frames, cards at the edge): the whole page
// hides as soon as the last dots have landed (PageMap's `hide`, under the town's cover), and comes back as soon as the
// town leaves.
function drawPage(opened: Opened, page: ReturnType<typeof wearing>, clock: ReturnType<typeof paced>, last: number, built: () => number): void {
	const { map } = sonar();
	opened.onFrame(() => {
		page.draw(built());
		map.hide(clock.forward() && built() >= last);
	});
}

// A machine that does not hold the town says so while the drawing is prepared (./drawer.ts): nothing of it stays.
async function started(opened: Opened, stop: AbortSignal | undefined, end: () => void): Promise<void> {
	try {
		await opened.start();
		stop?.throwIfAborted();
	} catch (error) {
		end();
		throw error;
	}
}

// `stop`: the opening ends where it is, the page whole again (./toggle.ts, OPENING_LIMIT).
export async function morphIn(sources: Source[], host: HTMLElement, theme: "light" | "dark", stop?: AbortSignal): Promise<Morph> {
	const { opened, topics, cut, close, near } = await opening(sources, host, theme, stop);
	const { mounted } = opened;
	const { grains, grid, last, edge } = await planned(mounted, topics, cut, host, theme);
	if (stop?.aborted) opened.dispose();
	stop?.throwIfAborted();
	const night = theme === "dark";
	const cubes = dust(mounted.dustScene, grains, night, sparksOf(host, night)[0]);
	// The edge's canvas first: the cover goes under it.
	const page = wearing(cut, grid, rim(host, night, opened.size), covering(host, edge, grid.size, cut));
	// It runs until the town counts as arrived (`arrived` of ./kit.ts): its signs show only then.
	const span = Math.max(HOLD + mounted.arrival() + 1.2, last + 0.3);

	const clock = paced(span);
	let [away, built] = [false, 0];
	let finished = nothing;
	let done = new Promise<void>((resolve) => (finished = resolve));
	opened.drive((seconds) => {
		built = clock.tick(seconds);
		cubes.set(built, mounted.world.camera);
		if (clock.forward() && !away && built >= last + 0.15) {
			away = true;
			stepBack(opened, near);
		}
		if (clock.forward() && built >= span) opened.keep(false);
		if (clock.forward() ? built >= span : built <= 0) finished();
		return Math.max(0, built - HOLD);
	});
	drawPage(opened, page, clock, last, () => built);
	// The page whole again, at once, and the town gone: the town still covers the Map then (./toggle.ts).
	const end = (): void => {
		sonar().map.hide(false);
		page.clear();
		cubes.dispose();
		opened.dispose();
		finished();
	};
	await started(opened, stop, end);
	const arrived = done;
	return {
		arrived,
		back: async () => {
			await done;
			done = new Promise<void>((resolve) => (finished = resolve));
			// The camera comes back to where the cubes took off, then they fly back.
			opened.home();
			opened.fly(close, near);
			opened.keep(true);
			clock.reverse(0.8);
			await done;
			end();
		},
		end,
		follow: mounted.follow,
		hide: (hidden) => {
			host.classList.toggle("away", hidden);
			opened.pause(hidden);
		},
	};
}
