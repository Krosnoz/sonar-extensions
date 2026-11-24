// With the camera still, a mark is whole or gone, and it goes only once its own place's people read (15 px tall). The
// marks faded out between 10 and 16 px on the town's people's mean height: a place whose people stood smaller (a square
// packed tighter) kept a pale mark over them, 37 agents in 92 at the middle zoom (100 agents, 1 920 px, by night, 14/11).
import { expect, test } from "bun:test";
import { clock, marksOf, place } from "./marks-test-page";

// A metre of height is `up` px on the screen; across, a metre is a pixel.
const camera =
	(up: number) =>
	([x, y, z]: [number, number, number]): [number, number] => [x, z - y * up];
// How much each place's agents' mark shows: `firsts` are each place's first figure.
const shown = (drawn: number[][], firsts: number[]): number[] => firsts.map((first) => drawn.find((mark) => mark.slice(7).includes(first))?.[4] ?? 0);
// A second of frames at 60 a second, the camera still.
const still = (frame: (shown: number) => void): void => {
	for (let k = 0; k < 60; k++) {
		clock.now += 1000 / 60;
		frame(1);
	}
};

test("a place's mark stays whole until its own people read, however tall the others", () => {
	// 20 px a metre: the first place's people 12 px tall, the second's 20 px.
	const figures = [...place(0, 6, 400, 450, 0.6), ...place(1, 6, 900, 450, 1)];
	const frame = marksOf(figures, camera(20));
	still(frame);
	expect(shown(frame.drawn, [0, 6])).toEqual([1, 0]);
});

test("with the camera still, a mark is whole or gone, never between", () => {
	for (const up of [11, 12, 13, 14, 15, 16, 17]) {
		const frame = marksOf([...place(0, 6, 400, 450), ...place(1, 3, 900, 450, 0.9)], camera(up));
		still(frame);
		for (const opacity of shown(frame.drawn, [0, 6])) expect([0, 1]).toContain(opacity);
	}
});

test("a mark fades out over several frames, not at once, as its people come to read", () => {
	let up = 14;
	const frame = marksOf(place(0, 6, 400, 450), ([x, y, z]) => [x, z - y * up]);
	still(frame);
	up = 16;
	clock.now += 1000 / 60;
	frame(1);
	const [first] = shown(frame.drawn, [0]);
	expect(first).toBeGreaterThan(0);
	expect(first).toBeLessThan(1);
});
