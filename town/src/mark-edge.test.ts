// A mark is whole on the screen or not shown. Only a mark wholly off the screen came in to its edge: one across the
// edge stayed there, cut, 1 to 14 a view (14/11), and passing from one case to the other it jumped by 25 px in a frame
// during a zoom at 1 000 agents (it stood at 1 408 px, then at 1 433 px on a screen 1 440 px wide).
import { expect, test } from "bun:test";
import { marksOf, place } from "./marks-test-page";

const project = ([x, y, z]: [number, number, number]): [number, number] => [x, z - y];
const inside = (mark: number[], width: number, height: number): boolean =>
	mark[0]! >= 0 && mark[1]! >= 0 && mark[0]! + mark[2]! <= width && mark[1]! + mark[3]! <= height;

test("a mark whose people are on the screen is whole on it", () => {
	// Places 2 to 10 px from each edge of a screen 1 440 by 900.
	const figures = [place(0, 6, 1432, 450), place(1, 3, 6, 300), place(2, 12, 700, 896), place(3, 1, 1000, 30)].flat();
	const frame = marksOf(figures, project);
	frame(1);
	expect(frame.drawn.length).toBe(4);
	expect(frame.drawn.filter((mark) => !inside(mark, 1440, 900)).map((mark) => mark.slice(0, 4).map(Math.round))).toEqual([]);
});

test("a mark whose people are all off the screen is not shown, even partly", () => {
	// 6 px past the right edge: its mark's box, 32 px wide, would show its left half.
	const frame = marksOf(place(0, 6, 1446, 450), project);
	frame(1);
	expect(frame.drawn).toEqual([]);
});

test("a mark at the edge moves with its people as the camera slides", () => {
	let shift = 0;
	// A metre is 8 px: a place whose people stand 5 m (40 px) apart on one square, slid 1 px a frame past the right edge
	// until its middle is off the screen. While its count stays, its mark moves apart from its people by 1 px a frame at
	// most.
	const sliding = ([x, y, z]: [number, number, number]): [number, number] => [1360 + (x - 341) * 8 + shift, z - y];
	const frame = marksOf([...place(0, 3, 341, 450), ...place(0, 3, 346, 450)], sliding);
	let last: number[] | undefined;
	let most = 0;
	for (shift = 0; shift <= 90; shift++) {
		frame(1);
		const mark = frame.drawn[0];
		if (mark && last && mark[6] === last[6]) most = Math.max(most, Math.abs(mark[0]! - last[0]! - 1) - 1);
		last = mark;
	}
	expect(most).toBeLessThanOrEqual(1);
});
