// What each subject of the town looks like: its place, its flat roof, its mansard's tone, its modern facade.
import { styleOf } from "./designs";
import { PLACES } from "./squares";
import { MODERNS } from "./storeys";
import { FLATS, MANSARDS } from "./roofs";

// The parasols' colours, dull and close to each other: bright ones make a square noisy.
export const PARASOLS = ["#e9dcc4", "#c9a58a", "#9db5a6"];

// FNV-1a, as in city.ts: two close names fall far apart.
const hash = (text: string): number => Array.from(text).reduce((h, c) => Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0, 2166136261);

// What a subject's own seed (its name, hashed) draws: its place (`PLACES`), its flat roof (`FLATS`) and its mansard's
// tone (`MANSARDS`). A town never gives two subjects the same one while another is free, and starts the draw again when
// all are taken.
export type Look = { place: number; flat: number; tone: number; modern: number };
export function looksOf(topics: { name: string }[]): Look[] {
	const used = { place: new Set<number>(), flat: new Set<number>(), tone: new Set<number>(), modern: new Set<number>() };
	const draw = (kind: keyof typeof used, count: number, from: number): number => {
		if (used[kind].size >= count) used[kind].clear();
		let at = from % count;
		while (used[kind].has(at)) at = (at + 1) % count;
		used[kind].add(at);
		return at;
	};
	return topics.map(({ name }, index) => {
		const seed = hash(name);
		// Only the modern buildings (the third style) draw a facade among `MODERNS`: three offices were one same glass band.
		const modern = styleOf(index) === 2 ? draw("modern", MODERNS.length, seed >>> 8) : 0;
		return { place: draw("place", PLACES.length, seed), flat: draw("flat", FLATS, seed >>> 12), tone: draw("tone", MANSARDS.length, seed >>> 20), modern };
	});
}
