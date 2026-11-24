// Who stands under the pointer, for an inhabitant's card (./notebook.ts). The town reads nothing under the pointer
// from its drawing: a figure is found from where it stands on the screen, as its name is placed (./signs.ts). Free of
// the page: no element, no graphics card.
import type { Figure } from "./kit";
import { READ } from "./mark-share";

export type Project = (at: [number, number, number]) => [number, number];
// A figure on the screen, in CSS pixels: its middle, its feet, its height, and its top (over the bubble of one who
// waits).
export type Box = { x: number; top: number; feet: number; tall: number };

// The height the feet are drawn at, in metres.
const GROUND = 0.08;
// How far the bubble of one who waits rises over its head, as a share of its height.
const BUBBLE = 0.45;
// How far from a body the pointer still finds it, in CSS pixels: a body a few pixels wide is hard to aim at.
const [ASIDE, ABOVE] = [8, 4];

// A metre up on the screen, in CSS pixels: the view is parallel, so the same for every figure.
export const upOf = (project: Project): number => project([0, 0, 0])[1] - project([0, 1, 0])[1];

// Where a figure stands on the screen. Its own height (`tall`), not its place's (`figure.at[1]`): in a crowd made
// small, that one stands far over the head.
export function boxOf(figure: Figure, project: Project, up: number): Box {
	const [x, feet] = project([figure.at[0], GROUND, figure.at[2]]);
	const tall = (figure.tall ?? 0) * up;
	// The bubble of one that waits leaves its head for its group's large one (`bare`): what stands over it comes down
	// with the bubble, down to the head once nothing is left there.
	const over = figure.agent.state === 2 ? BUBBLE * (1 - (figure.bare ?? 0)) : 0;
	return { x, top: feet - tall * (1 + over), feet, tall };
}

// Whether a figure can be pointed at: it stands for a session, has not gone, reads one by one (people who are specks
// have their place's mark instead, ./far-marks.ts), and its crowd is on the screen (`inView`, ./lots.ts).
const pointed = (figure: Figure, up: number, inView: (lot: number) => boolean): boolean =>
	!figure.away && !!figure.agent.handle && (figure.tall ?? 0) * up >= READ && (figure.lot === undefined || inView(figure.lot));

// Whether a figure shows one by one on a screen of `size`: a notebook pinned on one that left the screen, or that the
// camera now sees from afar, would point at nobody.
export function onScreen(figure: Figure, project: Project, size: { width: number; height: number }, inView: (lot: number) => boolean = () => true): boolean {
	const up = upOf(project);
	if (!pointed(figure, up, inView)) return false;
	const { x, top, feet } = boxOf(figure, project, up);
	return x >= 0 && x <= size.width && feet >= 0 && top <= size.height;
}

// The figure under the pointer, as its rank in `figures`; -1: none. In a crowd the bodies cover one another: the one
// whose middle is nearest the pointer, a pixel across counted as two up or down.
export function under(figures: Figure[], project: Project, [px, py]: [number, number], inView: (lot: number) => boolean = () => true): number {
	const up = upOf(project);
	let [found, near] = [-1, Infinity];
	for (const [at, figure] of figures.entries()) {
		if (!pointed(figure, up, inView)) continue;
		const { x, feet, tall } = boxOf(figure, project, up);
		if (Math.abs(px - x) > Math.max(ASIDE, tall * 0.32) || py < feet - tall - ABOVE || py > feet + ABOVE) continue;
		const far = Math.hypot(px - x, (py - (feet - tall / 2)) / 2);
		if (far < near) [found, near] = [at, far];
	}
	return found;
}
