// A place on the screen that holds still while the camera wavers under it. The camera steps by a pixel of the drawing
// (./camera.ts): while it turns, a roof's place creeps forward, then falls back by that step, and creeps again. A sign
// rounded to the screen's pixels at every frame followed each of those falls: it jumped a whole pixel there and back, and
// a label's text blinked where the town barely moved.
// A slow turn moves a roof by less than a pixel of the screen a frame. Held within three quarters of a pixel, a sign moved
// a pixel at nearly every frame of it: a sharp text that steps a pixel at two frames in a row blinks at its strokes' edges.
// Held within a pixel and a half, it moves at most one frame in two at that pace.
const HOLD = 1.5;

// Where a sign stands, in CSS pixels, rounded to a pixel of the screen (`ratio` of them per CSS pixel): it stays at
// `held` while the place `raw` is within the camera's step (`step`, in CSS pixels) and HOLD pixels of the screen, and moves
// on only once the place has gone farther. `held` null: the sign shows anew, at its place.
export const steady = (held: number | null, raw: number, ratio: number, step: number): number =>
	held !== null && Math.abs(raw - held) < step + HOLD / ratio ? held : Math.round(raw * ratio) / ratio;

// How long the camera holds still before the signs count as at rest: a drag paused for a frame is still a gesture.
const SETTLE = 150;
// Whether the camera has held still for SETTLE ms, told its pose at each frame (any text that changes as it moves).
export const stillness = (): ((pose: string, now: number) => boolean) => {
	let [last, movedAt] = ["", 0];
	return (pose, now) => {
		if (pose !== last) [last, movedAt] = [pose, now];
		return now - movedAt >= SETTLE;
	};
};
