// A project's town style as the extension keeps it: the style the user chose (`style`), else the one drawn for the
// project and kept (`drawn`): the style the fewest other projects' towns showed, so that two projects' towns differ
// without a setting, and a town keeps its look when another project comes or goes. Shared by the server part and the
// page: no import of either.

import type { WorldStyle } from "./styles";

// The order counts: among styles as rare, the draw takes the first.
export const WORLD_STYLES = ["riverside", "brick", "sun", "neon", "fjord", "oasis"] as const satisfies readonly WorldStyle[];
// Every style of the town is one of the list: a style added to ./styles.ts and not here fails tsc.
const whole: [Exclude<WorldStyle, (typeof WORLD_STYLES)[number]>] extends [never] ? true : false = true;
void whole;

// `null`: none chosen (the draw shows), or none drawn yet.
export type World = { readonly style: WorldStyle | null; readonly drawn: WorldStyle | null };

export const NONE: World = { style: null, drawn: null };

export const isStyle = (value: unknown): value is WorldStyle => WORLD_STYLES.some((style) => style === value);

// The style a project's town shows: none before the draw.
export const shownOf = (world: World | undefined): WorldStyle | null => world?.style ?? world?.drawn ?? null;

// The style the fewest of the other towns show, the first of the list among equals.
export function leastTaken(others: readonly (WorldStyle | null)[]): WorldStyle {
	const count = (style: WorldStyle) => others.filter((each) => each === style).length;
	return WORLD_STYLES.toSorted((a, b) => count(a) - count(b))[0]!;
}

// A world read from JSON: an object whose `style` and `drawn` are each a style, null or absent. Anything else, null.
export function worldOf(value: unknown): World | null {
	if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
	const { style = null, drawn = null } = value as { style?: unknown; drawn?: unknown };
	if ((style !== null && !isStyle(style)) || (drawn !== null && !isStyle(drawn))) return null;
	return { style, drawn };
}
