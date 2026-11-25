// Who stands under the pointer (./note-under.ts): no page, no graphics card.
import { expect, test } from "bun:test";
import type { Figure } from "../render/kit";
import { boxOf, onScreen, under, upOf, type Project } from "./note-under";

// A parallel view from the front: 20 px a metre, the ground's far side higher on the screen.
const project: Project = ([x, y, z]) => [x * 20, 500 - y * 20 - z * 5];
// A figure 1 m tall (20 px) at `x`, `z`, for the session `handle` (null: for none).
const figure = (x: number, z: number, given: Partial<Figure> = {}, handle: string | null = `s${x}`, state = 1): Figure => ({
	topic: 0,
	agent: { name: "", state, seed: 0, children: [], ...(handle ? { handle } : {}) },
	at: [x, 1.6, z],
	tall: 1,
	...given,
});

test("note: the figure under the pointer is found from its feet to its head, a few pixels round it, and no other", () => {
	const figures = [figure(5, 0), figure(10, 0)];
	expect(upOf(project)).toBe(20);
	// The first stands at x 100, its feet at y 498.4, its head at 478.4.
	expect(
		[
			[100, 490],
			[106, 490],
			[100, 476],
			[100, 501],
			[110, 490],
			[100, 470],
			[200, 480],
		].map((at) => under(figures, project, [at[0]!, at[1]!])),
	).toEqual([0, 0, 0, 0, -1, -1, 1]);
});

test("note: in a crowd the body whose middle is nearest the pointer is found", () => {
	// Two bodies 6 px apart, the second a row behind: 5 px higher.
	const figures = [figure(5, 0), figure(5.3, 1)];
	expect([under(figures, project, [101, 492]), under(figures, project, [106, 482])]).toEqual([0, 1]);
});

test("note: people who are specks, one who has gone, one that stands for no session and a crowd off the screen are not found", () => {
	const at: [number, number] = [100, 490];
	expect(under([figure(5, 0, { tall: 0.7 })], project, at)).toBe(-1);
	expect(under([figure(5, 0, { away: true })], project, at)).toBe(-1);
	expect(under([figure(5, 0, {}, null)], project, at)).toBe(-1);
	expect([under([figure(5, 0, { lot: 3 })], project, at, (lot) => lot !== 3), under([figure(5, 0, { lot: 3 })], project, at, () => true)]).toEqual([-1, 0]);
});

test("note: a pinned notebook's inhabitant is on the screen while it shows there one by one, and no more once it left it or reads no more", () => {
	const size = { width: 300, height: 600 };
	// At x 100, feet at 498.4: on the screen; at x 400, past its right side; head at 628.4, under it; feet at -51.6, over it.
	expect([figure(5, 0), figure(20, 0), figure(5, -30), figure(5, 110)].map((each) => onScreen(each, project, size))).toEqual([true, false, false, false]);
	expect(onScreen(figure(5, 0, { tall: 0.7 }), project, size)).toBe(false);
	expect(onScreen(figure(5, 0, { away: true }), project, size)).toBe(false);
	expect(onScreen(figure(5, 0, { lot: 3 }), project, size, (lot) => lot !== 3)).toBe(false);
});

test("note: a figure's top is its head, or over its bubble when it waits", () => {
	const [works, waits] = [boxOf(figure(5, 0), project, 20), boxOf(figure(5, 0, {}, "s", 2), project, 20)];
	expect([works.x, works.feet, works.tall, works.top.toFixed(1), waits.top.toFixed(1)]).toEqual([100, 498.4, 20, "478.4", "469.4"]);
	// Its bubble in its group's large one (./heaps.ts), nothing stands over its head.
	expect([1, 0.5].map((bare) => boxOf(figure(5, 0, { bare }, "s", 2), project, 20).top.toFixed(1))).toEqual(["478.4", "473.9"]);
});
