// How a subject's sign moves with the camera (./signs.ts): it follows its roof without a jump. What must change at once (its
// anchor's point, its place, its form) fades in anew; what may change by degrees (its height over the roof) glides.

// A sign or a name that shows anew, or changes its place or its form, fades in: never a jump. The end is the element's own
// opacity (a line shows at 0.8). Hiding fades by its class (world.css).
export const fadeIn = (node: HTMLElement): void => void node.animate([{ opacity: 0, offset: 0 }], { duration: 150, easing: "ease-out" });

// How much lower on the screen another point of the roof must stand before the anchor leaves its point for it. Two points
// as near the roof's middle stand at nearly the same height while the camera tilts: the anchor went from one to the
// other and back, its sign 30 px across at each frame.
export const ANCHOR_HOLD = 6;
// Which of a roof's points the anchor stands on: the nearest to the roof's middle (`near`, in tenths of a unit: equal
// distances tie), and of those the one nearer the camera, lower on the screen (`points`): a point behind the stair hut
// was hidden by it. The point it held (`held`) stays while it ties and stands less than ANCHOR_HOLD px higher.
export const anchorOf = (points: [number, number][], near: number[], held: number): number => {
	const least = Math.min(...near);
	let best = -1;
	for (const [at, point] of points.entries()) if (near[at] === least && (best < 0 || point[1] > points[best]![1])) best = at;
	return held >= 0 && near[held] === least && points[held]![1] >= points[best]![1] - ANCHOR_HOLD ? held : best;
};

// How far a sign's height over its roof moves at a frame, in CSS pixels. A hut or a tank that comes under the sign's span
// as the camera turns lifts the sign over it: lifted at once, it jumped up to 25 px. Within this step, and the pixel and a
// half a sign is held within (./steady.ts), it moves less than 4 px a frame more than its roof.
export const LIFT_STEP = 1.5;
// The height a sign stands at over its roof, moved toward `wanted` by LIFT_STEP at most. `shown` null: the sign shows anew,
// at its height.
export const lift = (shown: number | null, wanted: number): number =>
	shown === null ? wanted : shown + Math.max(-LIFT_STEP, Math.min(LIFT_STEP, wanted - shown));

// Where a sign stands on one axis of the screen, in CSS pixels, rounded to a pixel of the screen (`ratio` of them per CSS
// pixel). It holds still while its place `raw` wavers within the camera's step (`step`) and a pixel and a half of the
// screen, as ./steady.ts does; past that, it is pulled behind the place, to the edge of that reach, rather than put back
// on it. Put back on its place, it caught up the whole reach at one frame, on each axis: 4 to 5.6 px from its roof on
// the diagonal of a slow turn (13/11). Pulled, it moves with its roof, within a pixel of the screen.
const FOLLOW_HOLD = 1.5;
export const follow = (held: number | null, raw: number, ratio: number, step: number): number => {
	const reach = step + FOLLOW_HOLD / ratio;
	if (held !== null && Math.abs(raw - held) < reach) return held;
	const from = held === null ? raw : raw - Math.sign(raw - held) * (reach - 0.5 / ratio);
	return Math.round(from * ratio) / ratio;
};

// A sign's form: its look (./sign-looks.ts), and far out (level 0) its pictogram alone, whatever its look. From level 1 to
// 0 the label shrank to the pictogram on the same look, without fading, its foot 100 px aside.
export const formOf = (level: number, look: string): string => (level === 0 ? "far" : look);
