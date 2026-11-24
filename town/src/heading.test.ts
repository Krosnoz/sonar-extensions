// A turn let go from a low view settles on the nearest isometric heading, within 250 ms, and lands on it exactly: a
// camera left facing the town from a low view showed its façades stacked as an elevation (13/11).

import { expect, test } from "bun:test";
import { glide, settled } from "./heading";

const QUARTER = Math.PI / 2;
const degrees = (radians: number): number => Math.round((radians * 180) / Math.PI);
// Halfway from the lowest view (28°) to the highest (80°), as ./view.ts asks.
const BELOW = (54 * Math.PI) / 180;

test("a turn let go from a low view settles on the nearest isometric heading; from a high view, it stays", () => {
	const low = (40 * Math.PI) / 180;
	expect([0.3, 0.9, -0.9, 2 * Math.PI + 0.7].map((yaw) => degrees(settled(yaw, low, 0, BELOW) ?? Number.NaN))).toEqual([0, 90, -90, 360]);
	expect(settled(0.7, (70 * Math.PI) / 180, 0, BELOW)).toBeNull();
});

test("the heading glides there within 250 ms at 60 frames a second, and lands on it exactly", () => {
	let [yaw, frames] = [Math.PI / 4 - 1e-3, 0];
	while (yaw !== QUARTER && frames < 60) {
		yaw = glide(yaw, QUARTER, 1 / 60);
		frames++;
	}
	expect({ yaw, within: frames / 60 <= 0.25 }).toEqual({ yaw: QUARTER, within: true });
});
