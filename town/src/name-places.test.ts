// The figures' names of a town of 10 000 agents, at each frame: a name shows only at the nearest level. At the others, a
// frame projects no figure and writes no class once the names are hidden; at every level, a class is written only when
// it changes. Placed at every frame, the 10 000 names took about 10 ms of each, and 16 s of a 90 s arrival.
import { expect, test } from "bun:test";
import type { Figure } from "./kit";
import { namePlaces, type Name, type NameFrame } from "./name-places.ts";

const g = globalThis as Record<string, unknown>;
g["devicePixelRatio"] ??= 1;

function town(count: number) {
	const writes = { count: 0 };
	const names: Name[] = Array.from({ length: count }, (_, at) => {
		// A name is made hidden (./signs.ts): made shown and hidden at its first frame, the 10 000 names of a big town started
		// 10 000 transitions at once and froze the page 2 s.
		const classes = new Set<string>(["world-off", "world-unplaced"]);
		const node = {
			classList: {
				toggle: (name: string, on: boolean) => {
					writes.count++;
					if (on) classes.add(name);
					else classes.delete(name);
				},
				contains: (name: string) => classes.has(name),
			},
			style: { transform: "" },
			animate: () => ({}),
		} as unknown as HTMLElement;
		const figure: Figure = { topic: 0, agent: { name: `a${at}`, state: at % 4, seed: 0, children: [] }, at: [at % 100, 1.6, Math.floor(at / 100)] };
		return { node, figure, shown: false, cut: false, at: [null, null] };
	});
	const projected = { count: 0 };
	const named = names.map((): [number, number][] => [[60, 20]]);
	const frame = (level: number, onView: NameFrame["onView"] = () => true): NameFrame => ({
		level,
		onView,
		project: ([x, , z]) => (projected.count++, [100 + x * 20, 100 + z * 20]),
		step: 0.5,
		fresh: 0,
		slack: 2,
		named,
		width: 1440,
		tall: 900,
		bar: 0,
		margin: 16,
		taken: [],
		room: Infinity,
		bodies: { clear: () => true },
		seen: () => true,
	});
	return { names, writes, projected, place: namePlaces(names), frame };
}

test("away from the nearest level, a frame projects no figure and writes no class once the names are hidden", () => {
	const { names, writes, projected, place, frame } = town(10_000);
	place(frame(0));
	expect(writes.count).toBe(0);
	expect(names.every((name) => name.node.classList.contains("world-off"))).toBe(true);
	[writes.count, projected.count] = [0, 0];
	const started = performance.now();
	for (let at = 0; at < 100; at++) place(frame(at % 2));
	expect(performance.now() - started).toBeLessThan(50);
	expect(writes.count).toBe(0);
	expect(projected.count).toBe(0);
});

test("at the nearest level, the names placed show, and a class is written only when it changes", () => {
	const { names, writes, place, frame } = town(10_000);
	place(frame(0));
	writes.count = 0;
	place(frame(2));
	const shown = names.filter((name) => name.shown);
	expect(shown.length).toBeGreaterThan(0);
	expect(shown.every((name) => !name.node.classList.contains("world-off"))).toBe(true);
	expect(names.filter((name) => !name.shown).every((name) => name.node.classList.contains("world-off"))).toBe(true);
	// The names shown: .world-off and .world-unplaced off and .world-cut set, once each.
	expect(writes.count).toBe(3 * shown.length);
	expect(shown.every((name) => !name.node.classList.contains("world-unplaced"))).toBe(true);
	expect(names.filter((name) => !name.shown).every((name) => name.node.classList.contains("world-unplaced"))).toBe(true);
	writes.count = 0;
	place(frame(2));
	// Shown again at the same place: only .world-cut is set again, as before.
	expect(writes.count).toBe(shown.length);
	place(frame(0));
	expect(names.every((name) => !name.shown && name.node.classList.contains("world-off"))).toBe(true);
});

test("a figure of a crowd out of the camera's view is not projected, and its name hides", () => {
	const { names, projected, place, frame } = town(1000);
	place(frame(2));
	const shownBefore = names.filter((name) => name.shown).length;
	expect(shownBefore).toBeGreaterThan(0);
	projected.count = 0;
	// Only the figures of the first column are in view.
	const column = (figure: Figure): boolean => figure.at[0] === 0;
	place(frame(2, column));
	expect(projected.count).toBe(names.filter((name) => column(name.figure)).length);
	expect(names.filter((name) => name.shown).every((name) => column(name.figure))).toBe(true);
});
