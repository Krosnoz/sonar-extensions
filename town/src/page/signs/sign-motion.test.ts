// The signs follow their roof without jumping: an anchor point held, a height that slides, a far form (sign-motion.ts).
import { expect, test } from "bun:test";
import { ANCHOR_HOLD, LIFT_STEP, anchorOf, follow, formOf, lift } from "./sign-motion";

test("the anchor keeps its point while a point as close to the middle is not clearly lower", () => {
	// Two points as far from the roof's middle, almost at the same height on the screen during a tilt.
	const near = [12, 12, 30];
	let held = anchorOf(
		[
			[100, 200],
			[140, 201],
			[120, 260],
		],
		near,
		-1,
	);
	expect(held).toBe(1);
	// The reading of 13/11: the anchor went from one point to the other and back, its sign 30 px aside at each frame.
	let changes = 0;
	for (let frame = 0; frame < 40; frame++) {
		const wobble = frame % 2 === 0 ? 1 : -1;
		const next = anchorOf(
			[
				[100, 200 + wobble],
				[140, 200 - wobble],
				[120, 260],
			],
			near,
			held,
		);
		if (next !== held) changes++;
		held = next;
	}
	expect(changes).toBe(0);
});

test("the anchor changes its point once only when the camera turns, when the other point comes clearly in front", () => {
	const near = [5, 5];
	let held = -1;
	const seen: number[] = [];
	for (let angle = 0; angle <= 180; angle += 3) {
		const y = Math.cos((angle * Math.PI) / 180) * 20;
		held = anchorOf(
			[
				[100, 300 + y],
				[110, 300 - y],
			],
			near,
			held,
		);
		if (seen.at(-1) !== held) seen.push(held);
	}
	expect(seen).toEqual([0, 1]);
	// It does change when the other point is lower by more than the margin.
	expect(
		anchorOf(
			[
				[0, 100],
				[0, 100 + ANCHOR_HOLD + 1],
			],
			[1, 1],
			0,
		),
	).toBe(1);
});

test("the point closest to the middle always wins over a point held farther", () => {
	expect(
		anchorOf(
			[
				[0, 400],
				[0, 100],
			],
			[20, 10],
			0,
		),
	).toBe(1);
});

test("a roof passing under the sign lifts it by small steps, never at once", () => {
	// The reading of 13/11: a tank that came under the sign lifted it by 25 px in one frame.
	let shown: number | null = lift(null, 0);
	expect(shown).toBe(0);
	const steps: number[] = [];
	for (let frame = 0; frame < 40; frame++) {
		const next = lift(shown, 25);
		steps.push(Math.abs(next - shown));
		shown = next;
	}
	expect(Math.max(...steps)).toBeLessThanOrEqual(LIFT_STEP);
	expect(shown).toBe(25);
	// It comes down the same way.
	expect(lift(25, 0)).toBe(25 - LIFT_STEP);
});

test("a sign held still catches up with its roof step by step, never by a leap of more than 4 px a frame", () => {
	// The reading of 13/11: held within a pixel and a half on each axis, then put back to its place at once, the sign
	// moved 4 to 5.6 px away from its roof in one frame, on the diagonal of a slow turn.
	const [ratio, step] = [1, 0.5];
	let held: [number, number] | null = null;
	let worst = 0;
	let last: [number, number] = [0, 0];
	for (let frame = 0; frame < 400; frame++) {
		// The roof slides diagonally by 0.7 px a frame; the camera moves on by a drawing step, then back (camera.ts).
		const wobble = frame % 3 === 2 ? -step : 0;
		const raw: [number, number] = [100 + frame * 0.7 + wobble, 300 + frame * 0.7 + wobble];
		const next: [number, number] = [follow(held?.[0] ?? null, raw[0], ratio, step), follow(held?.[1] ?? null, raw[1], ratio, step)];
		if (held) worst = Math.max(worst, Math.hypot(next[0] - held[0] - (raw[0] - last[0]), next[1] - held[1] - (raw[1] - last[1])));
		[held, last] = [next, raw];
		// It stays near its roof: never farther than the camera's step and the pixel and a half held.
		expect(Math.abs(next[0] - raw[0])).toBeLessThanOrEqual(step + 1.5);
	}
	// With the height's slide (LIFT_STEP), the gap stays under 4 px.
	expect(worst + LIFT_STEP).toBeLessThan(4);
});

test("a sign held does not move while the camera shakes on the spot", () => {
	let held: number | null = null;
	const moves = new Set<number>();
	for (let frame = 0; frame < 60; frame++) {
		const next = follow(held, 200.3 + (frame % 2 ? 0.5 : 0), 1, 0.5);
		if (held !== null && next !== held) moves.add(frame);
		held = next;
	}
	expect(moves.size).toBe(0);
});

test("at the far level the form changes, even with the same look: the sign fades instead of jumping", () => {
	expect(formOf(0, "")).not.toBe(formOf(1, ""));
	expect(formOf(1, "world-cut")).toBe("world-cut");
	expect(formOf(2, "")).toBe(formOf(1, ""));
});
