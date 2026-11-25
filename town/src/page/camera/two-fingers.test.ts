// The lock of the two fingers' mode: pure functions of ./two-fingers.ts.
import { expect, test } from "bun:test";
import { DEAD_TWIST, LOCK, lockMode, twistBeyond } from "./two-fingers.ts";

const still = { zoom: 0, twist: 0, radius: 100, tilt: 0 };

test("nothing locks before 8 px", () => {
	expect(lockMode({ ...still, zoom: LOCK - 1 })).toBeNull();
	expect(lockMode({ ...still, tilt: -(LOCK - 1) })).toBeNull();
});
test("a straight pinch locks the zoom, even with a little twist", () => {
	expect(lockMode({ ...still, zoom: 20, twist: DEAD_TWIST * 0.9 })).toBe("zoom");
});
test("a twist in the dead zone never locks the twist", () => {
	expect(lockMode({ ...still, twist: DEAD_TWIST * 0.99, radius: 1000 })).toBeNull();
});
test("a real twist locks the twist", () => {
	expect(lockMode({ ...still, twist: 0.3, radius: 100 })).toBe("twist");
});
test("two fingers going up lock the tilt", () => {
	expect(lockMode({ ...still, tilt: -30, zoom: 5, twist: 0.02 })).toBe("tilt");
});
test("the twist applied starts after the dead zone and stays continuous", () => {
	expect(twistBeyond(DEAD_TWIST * 0.5, 0)).toBe(0);
	const step = twistBeyond(DEAD_TWIST + 0.1, 0);
	expect(step).toBeCloseTo(0.1);
	expect(twistBeyond(DEAD_TWIST + 0.1, step)).toBeCloseTo(0);
	expect(twistBeyond(-(DEAD_TWIST + 0.1), 0)).toBeCloseTo(-0.1);
});
