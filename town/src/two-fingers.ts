// What two fingers on the town do: one of zoom, twist or tilt, chosen by their first motion that goes far enough.

// Two fingers do one thing at a time: the first motion that goes far enough decides, and holds until they lift.
export type PairMode = "zoom" | "twist" | "tilt";
// How far a finger must travel (px) before the gesture is chosen, and the twist (radians, about 6°) that is only a hand's
// wobble.
export const LOCK = 8;
export const DEAD_TWIST = (6 * Math.PI) / 180;
// What the fingers did since they touched: `zoom` the change of their distance (px), `twist` of their angle (radians),
// `radius` half their distance (px), `tilt` the middle's vertical travel (px).
export type PairMoves = { zoom: number; twist: number; radius: number; tilt: number };
export function lockMode({ zoom, twist, radius, tilt }: PairMoves): PairMode | null {
	// A twist inside the dead zone counts for nothing: a pinch is never quite straight.
	const scores: [PairMode, number][] = [
		["zoom", Math.abs(zoom)],
		["twist", Math.abs(twist) > DEAD_TWIST ? Math.abs(twist) * radius : 0],
		["tilt", Math.abs(tilt)],
	];
	const [mode, far] = scores.reduce((best, each) => (each[1] > best[1] ? each : best));
	return far >= LOCK ? mode : null;
}
// The turn to apply for a twist, once past the dead zone: the part of the twist beyond it, minus what was applied.
export function twistBeyond(twist: number, applied: number): number {
	const beyond = Math.sign(twist) * Math.max(0, Math.abs(twist) - DEAD_TWIST);
	return beyond - applied;
}
