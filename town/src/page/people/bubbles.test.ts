// The bubbles' models (./bubbles.ts), read as the camera sees them: no process, no graphics card.
import { expect, test } from "bun:test";
import type { G } from "../render/shapes";

await import("../test-page");
const { bang, round } = await import("./bubbles");
const { PITCH } = await import("../plan/grid");
const { BALL } = await import("./heaps");

// The points of a model's parts of one kind (../render/shapes.ts#piece: 0 plain, 1 the instance's colour).
function pointsOf(model: G, kind: number): [number, number, number][] {
	const [at, part] = [model.getAttribute("position"), model.getAttribute("aPart")];
	const points: [number, number, number][] = [];
	for (let each = 0; each < at.count; each++) if (part.getX(each) === kind) points.push([at.getX(each), at.getY(each), at.getZ(each)]);
	return points;
}
// A point of a model on the screen of the camera the town opens with, the model turned to it: to the right, up, and
// towards the camera.
const [sin, cos] = [Math.sin(PITCH), Math.cos(PITCH)];
const seen = ([x, y, z]: [number, number, number]): [number, number, number] => [x, y * cos - z * sin, y * sin + z * cos];
const span = (values: number[]): [number, number] => [Math.min(...values), Math.max(...values)];

test("bubbles: the mark of a bubble stands in the middle of its ball's disc as the camera sees it, half the disc tall", () => {
	const mark = pointsOf(bang(), 0).map(seen);
	const [across, up] = [span(mark.map((point) => point[0])), span(mark.map((point) => point[1]))];
	// A model's points are kept in single precision.
	expect([across[0] + across[1], up[0] + up[1]].map((sum) => Math.abs(sum) < 1e-6)).toEqual([true, true]);
	// Its height against the disc's, and its width against its height: a stroke and a dot.
	expect([(up[1] - up[0]) / (2 * BALL), (across[1] - across[0]) / (up[1] - up[0])].map((share) => share.toFixed(2))).toEqual(["0.56", "0.24"]);
});

test("bubbles: the mark's face is flat to the camera and out of the ball, its back in the ball", () => {
	const depths = pointsOf(bang(), 0).map((point) => seen(point)[2]);
	const [back, face] = span(depths);
	// Two depths only: a face and a back, both square to the camera's axis.
	expect(new Set(depths.map((depth) => depth.toFixed(6))).size).toBe(2);
	// The ball's surface under the mark's furthest corner.
	const corner = Math.max(...pointsOf(bang(), 0).map((point) => Math.hypot(seen(point)[0], seen(point)[1])));
	expect([face > BALL, back < Math.sqrt(BALL ** 2 - corner ** 2)]).toEqual([true, true]);
});

test("bubbles: the tail points down and to the left on the screen, past the ball's edge", () => {
	const body = pointsOf(bang(), 1).map(seen);
	const tip = body.reduce((far, point) => (Math.hypot(point[0], point[1]) > Math.hypot(far[0], far[1]) ? point : far));
	expect([tip[0] < 0, tip[1] < 0, Math.hypot(tip[0], tip[1]) > BALL * 1.4]).toEqual([true, true, true]);
	// Nothing else leaves the disc: the ball is round.
	const out = body.filter((point) => Math.hypot(point[0], point[1]) > BALL + 1e-6);
	expect(out.every((point) => point[0] < 0 && point[1] < 0)).toBe(true);
});

test("bubbles: the large bubble has the same ball and tail and no mark: its count is written on it", () => {
	expect([pointsOf(round(), 0).length, pointsOf(bang(), 0).length > 0]).toEqual([0, true]);
	const body = pointsOf(round(), 1);
	// Rounder: drawn over three times larger.
	expect(body.length > pointsOf(bang(), 1).length).toBe(true);
	expect(Math.max(...body.map((point) => Math.hypot(...point))) > BALL * 1.4).toBe(true);
});
