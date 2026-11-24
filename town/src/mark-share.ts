// The arithmetic of the marks' look, free of the page (no colour table, no canvas): the order of the states, and how
// many points each state gets in a ring of points.

// How long a mark takes to fade in at a new place, in seconds.
const FADE = 0.15;

// The most a frame counts for in the fade, in seconds: a frame that comes late (a busy machine) showed the mark two
// thirds visible at once at its new place, a jump of its width.
const LATE = 1 / 30;

// How much a mark shows a frame of `dt` seconds after it showed `seen` (0 to 1).
export const fadedIn = (seen: number, dt: number): number => Math.min(1, seen + Math.min(dt, LATE) / FADE);

// The height of a place's people on the screen, in CSS pixels, from which they read one by one: their mark goes.
export const READ = 15;
// How long a mark takes to go or come back as its people come to read or turn back to specks, in seconds. Faded on the
// people's height instead, it stayed half shown with the camera still (./mark-rest.test.ts).
const SWAP = 0.2;

// How much a mark shows a frame of `dt` seconds after it showed `seen`, on its way to `wanted` (0 or 1).
export const towards = (seen: number, wanted: number, dt: number): number => {
	const step = Math.min(dt, LATE) / SWAP;
	return wanted > seen ? Math.min(wanted, seen + step) : Math.max(wanted, seen - step);
};

// The states most urgent first, as the page lists them: waiting, to review, at work, idle.
export const ORDER = [2, 3, 1, 0];

// How many points each state gets of `n`: the largest remainders, each state present keeping at least one.
export function pointsOf(counts: number[], total: number, n: number): { state: number; points: number }[] {
	const states = ORDER.filter((state) => counts[state]! > 0);
	const quotas = states.map((state) => (counts[state]! * n) / total);
	const points = quotas.map((quota) => Math.max(1, Math.floor(quota)));
	let left = n - points.reduce((sum, each) => sum + each, 0);
	const byRemainder = quotas.map((quota, at) => [quota - Math.floor(quota), at] as const).toSorted((a, b) => b[0] - a[0]);
	for (let k = 0; left !== 0 && byRemainder.length > 0 && k <= 4 * n; k++) {
		const [, at] = byRemainder[k % byRemainder.length]!;
		if (left > 0) [points[at], left] = [points[at]! + 1, left - 1];
		else if (points[at]! > 1) [points[at], left] = [points[at]! - 1, left + 1];
	}
	return states.map((state, at) => ({ state, points: points[at]! }));
}
