// A mark that takes a new place fades in there (./far-marks.ts, ./mark-share.ts#fadedIn). On a busy machine a frame comes
// late: the mark must not show at its new place at once, which reads as a jump of its width (13/11: 4 to 11 marks a turn
// jumped by 32 to 64 px at 30 images a second, none at 60).
import { expect, test } from "bun:test";
import { fadedIn } from "./mark-share";

test("a mark at a new place is still faint after one frame, however late the frame", () => {
	for (const late of [1 / 60, 1 / 30, 0.1, 0.65]) expect(fadedIn(0, late)).toBeLessThanOrEqual(0.3);
});

test("a mark fades in whole within a quarter of a second at 60 images a second", () => {
	let seen = 0;
	for (let frame = 0; frame < 15; frame++) seen = fadedIn(seen, 1 / 60);
	expect(seen).toBe(1);
});
