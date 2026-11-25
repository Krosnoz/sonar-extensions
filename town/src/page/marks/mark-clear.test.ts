// A mark is cleared whole at the next frame (./far-marks.ts): the marks' canvas is cleared only where the last frame drew.
// A mark that took another grew with its count, past the box it was placed by, and the edge of its ring stayed on the
// canvas frame after frame as it moved: thin lines all round the town and over the page's background (10 000 agents, by
// day, 13/11).
import { expect, test } from "bun:test";
import type { Agent, Figure } from "../render/kit";

await import("../test-page");
const { farMarks } = await import("./far-marks");
const { T } = await import("../render/shapes");

// What the canvas was asked: the boxes of the discs drawn, and the boxes cleared, in CSS pixels.
const painted: number[][] = [];
const cleared: number[][] = [];
const pen = {
	setTransform: () => {},
	beginPath: () => {},
	fill: () => {},
	fillText: () => {},
	arc: (x: number, y: number, r: number) => painted.push([x - r, y - r, x + r, y + r]),
	clearRect: (x: number, y: number, w: number, h: number) => cleared.push([x, y, x + w, y + h]),
};
// The page this test needs, put back after it: the town's other tests run in the same process.
const page = globalThis as Record<string, unknown>;
const [style, doc] = [page["getComputedStyle"], page["document"]];
page["devicePixelRatio"] ??= 1;
const stubbed = (): void => {
	page["getComputedStyle"] = () => ({ paddingTop: "0", getPropertyValue: () => "" });
	page["document"] = { ...(doc as object), createElement: () => ({ style: {}, width: 0, height: 0, getContext: () => pen }) };
};
const restored = (): void => void Object.assign(page, { getComputedStyle: style, document: doc });

const agent = (state: number): Agent => ({ name: "a", state, seed: 0.5, children: [] }) as Agent;
// Two squares of one subject's quarter, ten blocks apart, that show at one spot from afar: 9 and 6 agents, whose marks
// overlap and join, 15 then in a ring larger than the first one's.
const figures: Figure[] = [
	...Array.from({ length: 9 }, (_, at) => ({ topic: 0, agent: agent(0), at: [at * 0.3, 1.6, 0], tall: 1 })),
	...Array.from({ length: 6 }, (_, at) => ({ topic: 0, agent: agent(1), at: [10 * T + at * 0.3, 1.6, 0], tall: 1 })),
] as Figure[];

test("a mark that took another is cleared whole when it moves", () => {
	let shift = 0;
	// Far: a metre is a hundredth of a pixel, the town turned as the camera sees it.
	const project = ([x, y, z]: [number, number, number]): [number, number] => [700 + (x - z) * 0.01, 450 + shift + (x + z) * 0.005 - y * 0.01];
	const layer = { prepend: () => {} } as unknown as HTMLElement;
	stubbed();
	const frame = farMarks(layer, figures, project, { width: 1440, height: 900 } as never, []);
	restored();
	frame(1);
	const drawn = painted.splice(0);
	expect(frame.drawn.length).toBe(1);
	shift = 40;
	frame(1);
	// Each disc of the first frame lies inside what the second one cleared.
	const inside = (box: number[]): boolean => cleared.some((rect) => rect[0]! <= box[0]! && rect[1]! <= box[1]! && rect[2]! >= box[2]! && rect[3]! >= box[3]!);
	expect(drawn.length).toBeGreaterThan(0);
	expect(drawn.filter((box) => !inside(box))).toEqual([]);
});

// A group across the screen's edge: its mark, at its middle, falls off the screen while some of its people are on it. At
// 10 000 agents at the middle zoom, 5 to 14 agents of the screen were neither in a mark nor seen one by one (13/11).
test("a group across the screen's edge keeps its mark on the screen", () => {
	// Five agents just off the left edge, one 30 px in.
	const edge = [0, 0, 0, 0, 0, 3].map((x) => ({ topic: 0, agent: agent(0), at: [x, 1.6, 0], tall: 1 })) as Figure[];
	const project = ([x, y, z]: [number, number, number]): [number, number] => [-30 + x * 20, 450 + z * 10 - y];
	const layer = { prepend: () => {} } as unknown as HTMLElement;
	stubbed();
	const frame = farMarks(layer, edge, project, { width: 1440, height: 900 } as never, []);
	restored();
	frame(1);
	expect(frame.drawn.flatMap((mark) => mark.slice(7))).toContain(5);
});

// A mark a sign covers goes beside it, but never off the town: at 100 agents a mark stood in the air past the island's
// left edge (13/11).
test("a mark moved aside from a sign stays over the town's ground", () => {
	// Two agents on a square at the island's corner, a metre two pixels: the town's ground round them is small.
	const few = [0, 0.4].map((x) => ({ topic: 0, agent: agent(0), at: [x, 1.6, 0], tall: 1 })) as Figure[];
	const project = ([x, y, z]: [number, number, number]): [number, number] => [700 + (x - z) * 2, 450 + (x + z) - y * 2];
	const layer = { prepend: () => {} } as unknown as HTMLElement;
	// A sign over the mark's own place.
	const sign = [690, 420, 710, 445];
	stubbed();
	const frame = farMarks(layer, few, project, { width: 1440, height: 900 } as never, [sign]);
	restored();
	frame(1);
	const [left, top, w, h] = frame.drawn[0]!;
	// Where the mark stands: the middle of its box's foot.
	const [cx, cy] = [left! + w! / 2, top! + h!];
	// The ground under the figures, half a block round them, on the screen.
	const corners = [
		[-T / 2, -T / 2],
		[0.4 + T / 2, -T / 2],
		[0.4 + T / 2, T / 2],
		[-T / 2, T / 2],
	].map(([x, z]) => project([x!, 0, z!]));
	const xs = corners.map(([x]) => x);
	const ys = corners.map(([, y]) => y);
	expect(cx).toBeGreaterThanOrEqual(Math.min(...xs));
	expect(cx).toBeLessThanOrEqual(Math.max(...xs));
	expect(cy).toBeGreaterThanOrEqual(Math.min(...ys));
	expect(cy).toBeLessThanOrEqual(Math.max(...ys));
});
