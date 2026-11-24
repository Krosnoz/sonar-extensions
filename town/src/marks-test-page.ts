// The page the far marks (./far-marks.ts) need, for the tests that run them without a browser: a canvas that draws
// nothing, the page's styles, and a clock the test moves. The page is put back after the marks are made: the town's
// other tests run in the same process.
// The page first: the town's modules read it on import.
import "./test-page";
import { farMarks } from "./far-marks";
import type { Agent, Figure } from "./kit";

const pen = { setTransform: () => {}, beginPath: () => {}, fill: () => {}, fillText: () => {}, arc: () => {}, clearRect: () => {} };
// One element stands for the marks' layer and for their canvas.
const element = () => ({ style: {}, width: 0, height: 0, getContext: () => pen, prepend: () => {} });
const page = globalThis as Record<string, unknown>;
page["devicePixelRatio"] ??= 1;

// The clock the marks read, in milliseconds: a test moves it to let a fade run.
export const clock = { now: 0 };

const agent = (state: number): Agent => ({ name: "a", state, seed: 0.5, children: [] });

// `count` agents of one place standing at `x`, `z` on their own subject, `tall` metres tall.
export const place = (topic: number, count: number, x: number, z: number, tall = 1): Figure[] =>
	Array.from({ length: count }, (_, at): Figure => ({ topic, agent: agent(at % 4), at: [x, 1.6, z], tall }));

type Project = (at: [number, number, number]) => [number, number];

// The marks' frame over `figures`, on a screen `width` by `height`.
export function marksOf(figures: Figure[], project: Project, width = 1440, height = 900, signs: number[][] = []): ReturnType<typeof farMarks> {
	const [style, doc, timing] = [page["getComputedStyle"], page["document"], page["performance"]];
	page["getComputedStyle"] = () => ({ paddingTop: "0", getPropertyValue: () => "" });
	page["document"] = Object.assign({}, doc, { createElement: element });
	page["performance"] = { now: () => clock.now };
	try {
		const frame = farMarks(document.createElement("div"), figures, project, { width, height, left: 0, top: 0 }, signs);
		// The clock is read at each frame: it stays the test's for the frames the test runs.
		return Object.assign(
			(shown: number) => {
				page["performance"] = { now: () => clock.now };
				try {
					frame(shown);
				} finally {
					page["performance"] = timing;
				}
			},
			{ drawn: frame.drawn },
		);
	} finally {
		Object.assign(page, { getComputedStyle: style, document: doc, performance: timing });
	}
}

// The area two marks of `drawn` (left, top, width, height) share, in square pixels.
export const shared = (a: number[], b: number[]): number =>
	Math.max(0, Math.min(a[0]! + a[2]!, b[0]! + b[2]!) - Math.max(a[0]!, b[0]!)) * Math.max(0, Math.min(a[1]! + a[3]!, b[1]! + b[3]!) - Math.max(a[1]!, b[1]!));
