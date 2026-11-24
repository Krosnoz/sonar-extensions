// Where a turn of the camera settles once let go. From a low view, a heading that faces the town shows its facades
// stacked as an elevation (13/11): the camera glides to the nearest isometric heading, a quarter turn from the default,
// as isometric games turn their view by quarter turns. From a high view, nearer a plan, any heading reads.

const QUARTER = Math.PI / 2;
// How fast the glide goes: from an eighth of a turn away, it lands within 250 ms.
const RATE = 26;
// How near the glide lands on its heading at once: a tenth of a degree, under a pixel's turn.
const LAND = 0.002;

// The isometric heading nearest `yaw`, on the default heading's quarter turns (`home`), when the view is lower than
// `below`; else null.
export function settled(yaw: number, pitch: number, home: number, below: number): number | null {
	return pitch < below ? home + Math.round((yaw - home) / QUARTER) * QUARTER : null;
}

// The heading after `dt` seconds of the glide from `yaw` to `target`: on it, exactly, once near.
export function glide(yaw: number, target: number, dt: number): number {
	const next = yaw + (target - yaw) * (1 - Math.exp(-dt * RATE));
	return Math.abs(target - next) < LAND ? target : next;
}
