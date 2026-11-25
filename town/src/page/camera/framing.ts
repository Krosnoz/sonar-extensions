// Where the camera starts: all the blocks at once, or as close as a zone's size asks on a page of one column (a phone)
// or a map zoomed in, on the zone the user was looking at. The cells of the page fly from there.
import { PITCH } from "../plan/grid";
import type { Topic, World } from "../render/kit";
import { BOTTOM } from "../plan/plinth";
import { onScreen } from "../arrival/sheets";
import type { Zone } from "../sonar/sources";

// `close`: the zoom's level; `near`: the point looked at.
export type Framing = { close: number; near: [number, number] };

// The level at which a zone of the page and its block in the town are of the same size.
function sizedFor(world: World, seen: HTMLElement[], fallback: number): number {
	const wide = world.view.unit(1);
	const sizes = seen
		.map((island) => (wide * island.getBoundingClientRect().width * 0.8) / (world.lots[0]!.side * 0.92 * Math.min(1, island.offsetWidth / island.offsetHeight)))
		.toSorted((a, b) => a - b);
	return sizes[Math.floor(sizes.length / 2)] ?? fallback;
}

export function framing(world: World, topics: Topic[], islands: Zone[], columns: number | undefined, host: HTMLElement): Framing {
	const view = world.view;
	const spots = topics.map((_, index) => view.over(index));
	const [u0, u1] = [Math.min(...spots.map(([u]) => u)) - 9, Math.max(...spots.map(([u]) => u)) + 9];
	// Below the lowest subject: 6.8 of its block, then the plinth to its foot (it was 9 in all with a plinth 2.72 deep).
	const [v0, v1] = [Math.min(...spots.map(([, v]) => v)) - 8, Math.max(...spots.map(([, v]) => v)) + 6.8 - BOTTOM * Math.cos(PITCH)];
	const wide = view.unit(1);
	const all = Math.min((host.clientWidth * wide) / (u1 - u0), (view.band()[1] * wide) / (v1 - v0));
	const seen = islands.filter((zone) => onScreen(zone.element) > 0);
	const most = seen.reduce<Zone | undefined>((best, zone) => (!best || onScreen(zone.element) > onScreen(best.element) ? zone : best), undefined);
	const sized = sizedFor(
		world,
		seen.map((zone) => zone.element),
		all,
	);
	const close = Math.max(1, Math.min(view.most, columns === 1 || all < sized * 0.4 ? sized : all));
	const looked = topics.flatMap((topic, index) => (topic.name === most?.topic ? [spots[index]!] : []));
	const focus = close > all && looked.length ? looked : spots;
	const near: [number, number] = [focus.reduce((sum, [u]) => sum + u, 0) / focus.length, focus.reduce((sum, [, v]) => sum + v, 0) / focus.length + 2];
	return { close, near };
}
