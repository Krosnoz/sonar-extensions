// A mark moves with its people. A mark that took others stood at its own people's middle, apart from the others': as the
// camera zoomed, that gap grew with the zoom, and the mark slid off its people by 10 to 18 px in a frame at 1 000 agents
// (14/11). Measured as the town's checks do: the move of the mark's middle less the move of its people's feet.
import { expect, test } from "bun:test";
import { marksOf, place } from "./marks-test-page";

test("a mark that took others moves with all its people as the camera zooms", () => {
	let scale = 1;
	// A zoom round the screen's middle, a metre a pixel at first.
	const project = ([x, y, z]: [number, number, number]): [number, number] => [720 + (x - 720) * scale, 450 + (z - y - 450) * scale];
	// Two places 24 px apart, whose marks (32 and 28 px wide) overlap and join: 10 agents and 9.
	const figures = [...place(0, 10, 700, 450), ...place(1, 9, 724, 450)];
	const feet = (members: number[]): [number, number] => {
		const at = members.map((member) => project([figures[member]!.at[0], 0.08, figures[member]!.at[2]]));
		return [at.reduce((sum, [x]) => sum + x, 0) / at.length, at.reduce((sum, [, y]) => sum + y, 0) / at.length];
	};
	const frame = marksOf(figures, project);
	let last: { middle: [number, number]; feet: [number, number] } | undefined;
	let most = 0;
	// 15 % a frame: a fast wheel's zoom; the marks stay joined up to 45 %.
	for (scale = 1; scale <= 1.46; scale += 0.15) {
		frame(1);
		expect(frame.drawn.length).toBe(1);
		const [left, top, w, h] = frame.drawn[0]!;
		const now = { middle: [left! + w! / 2, top! + h! / 2] as [number, number], feet: feet(frame.drawn[0]!.slice(7)) };
		if (last)
			most = Math.max(
				most,
				Math.hypot(now.middle[0] - last.middle[0] - (now.feet[0] - last.feet[0]), now.middle[1] - last.middle[1] - (now.feet[1] - last.feet[1])),
			);
		last = now;
	}
	// A mark stands on the device's pixel: under a pixel on each axis is its rounding.
	expect(most).toBeLessThanOrEqual(1.5);
});

// A mark held whole on the screen at its edge stood still while its people moved: 5 to 17 px a frame in a zoom at 100
// agents (14/11). It comes in to the edge by 4 px a frame at most.
test("a mark at the screen's edge slides off its people by 4 px a frame at most", () => {
	let shift = 0;
	const project = ([x, y, z]: [number, number, number]): [number, number] => [x, z - y + shift];
	// 6 agents' feet 60 px under the top edge, the camera sliding them up 10 px a frame, then still: they stay on the
	// screen, their mark comes to the edge.
	const figures = place(0, 6, 700, 61.68);
	const frame = marksOf(figures, project);
	let last: number[] | undefined;
	let most = 0;
	for (const step of [0, 0, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0]) {
		shift -= 10 * step;
		frame(1);
		const mark = frame.drawn[0];
		if (mark && last && mark[6] === last[6]) most = Math.max(most, Math.abs(mark[1]! - last[1]! + 10 * step));
		last = mark;
	}
	expect(most).toBeLessThanOrEqual(4);
});

// At a corner the mark comes in along both axes: 3 px on each made 4.5 px a frame (100 agents, 14/11).
test("a mark at the screen's corner slides off its people by 4 px a frame at most", () => {
	let shift = 0;
	const project = ([x, y, z]: [number, number, number]): [number, number] => [x + shift, z - y + shift];
	// 6 agents' feet 60 px from the top left corner, slid towards it 10 px a frame on both axes.
	const figures = place(0, 6, 60, 61.68);
	const frame = marksOf(figures, project);
	let last: number[] | undefined;
	let most = 0;
	for (const step of [0, 0, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0]) {
		shift -= 10 * step;
		frame(1);
		const mark = frame.drawn[0];
		if (mark && last && mark[6] === last[6]) most = Math.max(most, Math.hypot(mark[0]! - last[0]! + 10 * step, mark[1]! - last[1]! + 10 * step));
		last = mark;
	}
	expect(most).toBeLessThanOrEqual(4);
});
