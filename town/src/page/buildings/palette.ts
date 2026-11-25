// The colours the houses of the town draw from their style: a row's neighbours never close, and two towers of the town
// never wearing one facade.
import type { Style } from "../../shared/styles";
import { shade } from "./facades-kit";

// A hex colour's red, green and blue.
const rgb = (hex: string): number[] => [1, 3, 5].map((from) => parseInt(hex.slice(from, from + 2), 16));
// How far two colours are, in RGB (0 for something that is not a hex colour).
const apart = (p: string, q: string): number => {
	return Math.hypot(...rgb(p).map((value, at) => value - rgb(q)[at]!)) || 0;
};
// Two neighbouring houses of a row never take colours that close: dozens of twins stood side by side in a big town.
const LIKE = 40;

// A palette that, read in turn, never gives two close colours running: `row` reads one wall and one roof for each house,
// in the order of the row, so each read is the next house's. A read that falls near the last one moves on to the next
// colour of the palette that is not.
// The colour a spread palette's last read gave, which a house that took another one replaces (`took`).
const lasts = new WeakMap<string[], { last: string }>();
function spread(items: string[]): string[] {
	const state = { last: "" };
	const made = new Proxy(items, {
		get(target, key, receiver) {
			if (typeof key !== "string" || !/^\d+$/.test(key)) {
				const own: unknown = Reflect.get(target, key, receiver);
				return own;
			}
			let at = Number(key);
			for (let tries = 0; tries < target.length && state.last && apart(target[at]!, state.last) < LIKE; tries++) at = (at + 1) % target.length;
			state.last = target[at]!;
			return state.last;
		},
	});
	lasts.set(made, state);
	return made;
}
// A style for one row of houses: its walls and its roofs are drawn apart from their neighbours.
export const varied = (style: Style): Style => ({ ...style, walls: spread(style.walls), roofs: spread(style.roofs) });

// The walls of the town's towers. A row only kept its own neighbours apart, so two towers of two blocks often stood in
// the same beige, twins over the roofs. A tower takes, among the colours of `palette` apart from its row neighbour's
// (`before`), the one farthest from every tower's wall so far; the first takes the colour it drew. A style's palette
// holds close beiges: when none is LIKE from every tower's, a darker or a lighter shade of one may be. The row's next
// house is then kept apart from the colour taken, not from the one drawn (`row` reads `walls`, a spread palette).
export function towerWalls(palette: string[]): (walls: string[], drawn: string, before?: string) => string {
	const taken: string[] = [];
	const shades = palette.flatMap((colour) => [shade(colour, 0.82), shade(colour, 1.08)]);
	return (walls, drawn, before) => {
		const far = (colour: string): number => Math.min(...taken.map((each) => apart(colour, each)));
		const best = (list: string[]): string =>
			list.filter((colour) => !before || apart(colour, before) >= LIKE).reduce((p, q) => (far(q) > far(p) ? q : p), drawn);
		const own = best([drawn, ...palette]);
		const chosen = far(own) >= LIKE ? own : best([own, ...shades]);
		taken.push(chosen);
		const state = lasts.get(walls);
		if (state) state.last = chosen;
		return chosen;
	};
}
