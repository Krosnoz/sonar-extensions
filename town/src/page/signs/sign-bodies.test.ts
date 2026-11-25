// The inhabitants' bodies that names and signs keep off: the answer is that of a comparison with each body, in a
// bounded time. Compared with each body, each name of a town of 10 000 agents made 10 000 comparisons, and a frame at the
// closest zoom took a third of a second (13/11).
import { expect, test } from "bun:test";
import { bodyBox, clear } from "./sign-geometry.ts";
import { bodyGrid } from "./sign-bodies.ts";

const [WIDTH, HEIGHT] = [1440, 900];
let seed = 3;
const random = (): number => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;
// A crowd on the screen and round it: an inhabitant is a point of the ground, the camera projects it as it is, its head
// 12 px higher.
const crowd = (count: number) => Array.from({ length: count }, () => ({ at: [random() * 1640 - 100, 12, random() * 1100 - 100] as [number, number, number] }));
const project = ([x, y, z]: [number, number, number]): [number, number] => [x, z - y];

test("the grid answers as the comparison with each body does", () => {
	const figures = crowd(3000);
	const every = figures.map(({ at }) => bodyBox(project(at)[0], project([at[0], 0, at[2]])[1], project(at)[1]));
	const grid = bodyGrid(figures, project, WIDTH, HEIGHT);
	for (let at = 0; at < 4000; at++) {
		// A name and a sign stand whole on the screen.
		const [w, h] = [10 + random() * 120, 10 + random() * 30];
		const [x, y] = [2 + random() * (WIDTH - w - 4), 2 + random() * (HEIGHT - h - 4)];
		const slack = [-2, 0, 2, 40][at % 4]!;
		const skip = at % 3 ? -1 : Math.floor(random() * figures.length);
		expect(grid.clear(x, y, w, h, slack, skip)).toBe(clear(every, x, y, w, h, slack, skip));
	}
});

test("10 000 names against 10 000 bodies in less than 100 ms", () => {
	const figures = crowd(10_000);
	const began = performance.now();
	const grid = bodyGrid(figures, project, WIDTH, HEIGHT);
	for (let at = 0; at < 10_000; at++) grid.clear(random() * WIDTH, random() * HEIGHT, 90, 24, 0, at);
	expect(performance.now() - began).toBeLessThan(100);
});
