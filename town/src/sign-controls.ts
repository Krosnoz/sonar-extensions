// The page's controls over the town, which no sign, line or anchor goes under (./signs.ts).
import { GAP } from "./sign-geometry";
import { controlsOver } from "./size";
import { floating } from "./sonar";

// Each button seen over the town (./size.ts#controlsOver: the voice orb, the settings), and Ping, the town's buttons, the
// compass even hidden, as boxes [left, top, right, bottom] in the signs' `layer`, with GAP of room. A line under the orb hid
// its anchor.
export const controlsAbove = (layer: HTMLElement): number[][] => {
	const box = layer.getBoundingClientRect();
	const host = layer.parentElement;
	const shift = host?.getBoundingClientRect() ?? box;
	const seen = host
		? controlsOver(host).map(({ left, top, right, bottom }) => [left + shift.left, top + shift.top, right + shift.left, bottom + shift.top])
		: [];
	// What the page keeps floating over the Map (PageMap's `floating`), and the town's own controls.
	const named = [
		...floating(),
		...[...document.querySelectorAll<HTMLElement>(".town-map, .world-compass, .town-phone")].map((node) => node.getBoundingClientRect()),
	]
		.filter((rect) => rect.width > 0)
		.map((rect) => [rect.left, rect.top, rect.right, rect.bottom]);
	return [...seen, ...named].map(([left, top, right, bottom]) => [
		left! - box.left - GAP,
		top! - box.top - GAP,
		right! - box.left + GAP,
		bottom! - box.top + GAP,
	]);
};
