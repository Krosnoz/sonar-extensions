// Marks never cover one another: where room lacks, neighbours join into one mark with their summed count. At 100 agents
// from afar, 6 to 11 pairs of marks overlapped by up to 250 square pixels, chained as "6 · 3 · 3" (14/11): a mark was
// placed by its box before it took others, and a lone agent's small flower grew into a group's ring over its neighbours.
import { expect, test } from "bun:test";
import { marksOf, place, shared } from "./marks-test-page";

// A metre is a pixel: the town flat on the screen.
const project = ([x, y, z]: [number, number, number]): [number, number] => [x, z - y];

// Places of 1 to 4 agents strewn over a small area, from a seed: crowded as the squares of a town seen from afar.
const strewn = (seed: number, places: number, spread: number) => {
	let s = seed;
	const next = (): number => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
	return Array.from({ length: places }, (_, topic) => place(topic, 1 + Math.floor(next() ** 2 * 4), 400 + next() * spread, 400 + next() * spread * 0.6)).flat();
};

test("from afar, no two marks overlap, and their counts add up to the agents", () => {
	for (const seed of [1, 7, 42, 99, 123, 2024]) {
		for (const [places, spread] of [
			[20, 200],
			[40, 260],
			[80, 400],
		] as const) {
			const figures = strewn(seed, places, spread);
			const frame = marksOf(figures, project);
			frame(1);
			const marks = frame.drawn;
			const pairs: number[][] = [];
			for (let i = 0; i < marks.length; i++)
				for (let j = i + 1; j < marks.length; j++)
					if (shared(marks[i]!, marks[j]!) > 1) pairs.push([seed, places, marks[i]![6]!, marks[j]![6]!, Math.round(shared(marks[i]!, marks[j]!))]);
			expect(pairs).toEqual([]);
			expect(marks.reduce((sum, mark) => sum + mark[6]!, 0)).toBe(figures.length);
		}
	}
});
