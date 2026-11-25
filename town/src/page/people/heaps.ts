// The bubbles of a crowd that waits. A bubble stands over the head of each agent that waits for the user: twelve of
// them on one place stood in a heap, each over the faces of the row behind. From HEAP agents that wait on a place, their
// bubbles fly into one large bubble over the group, which carries their count (../marks/mark-heaps.ts); under HEAP, each one
// takes its own back. Which bubble goes where: ./crowd-heaps.ts; the bubbles' models: ./bubbles.ts.

// From how many agents that wait on one place their bubbles gather.
export const HEAP = 4;
// The large bubble's scale, and how long a bubble takes to its new place, in seconds of the town.
export const [BIG, FLY] = [3.2, 0.45];
// The radius of a bubble's ball at a scale of 1 (./bubbles.ts#bang).
export const BALL = 0.12;
// How long a change of the large bubble's count shows, in seconds: the bubble beats once, its figures roll.
export const TICK = 0.3;

// How a bubble is turned for its mark and its tail to face a camera at the heading `yaw` (../camera/camera.ts: 0 is the
// isometric one). The figures stand in the town and show their backs to a camera gone round them; a bubble is a sign
// to the user, and a mark seen from behind says nothing.
export const facing = (yaw: number): number => Math.PI / 4 + yaw;

const share = (linear: number): number => Math.min(1, Math.max(0, linear));

// The large bubble's size on its way from `from` to `to`, `linear` the share of its flight done. It comes a tenth
// past its size and settles, as a thing that lands; it leaves slowly then faster, as the small ones leave it. At one
// pace both ways, its count was whole before the ball was, and the ball stopped dead.
export function swollen(from: number, to: number, linear: number): number {
	const [done, left] = [share(linear), share(linear) - 1];
	// Where it starts and where it lands are said, not worked out: the sum is a hair off at both ends.
	if (done <= 0 || done >= 1) return done <= 0 ? from : to;
	return from + (to - from) * (to > from ? 1 + 2.70158 * left ** 3 + 1.70158 * left ** 2 : done ** 3);
}

// How much larger the large bubble is drawn `since` seconds after its count changed: one beat.
export const beat = (since: number): number => (since >= 0 && since < TICK ? 1 + 0.12 * Math.sin((Math.PI * since) / TICK) : 1);

// How much higher a small bubble flies than the straight way, in metres: it hops to its group's bubble, and back.
export const hop = (linear: number): number => 1.2 * share(linear) * (1 - share(linear));

// x, y, z and scale.
export type Spot = [number, number, number, number];
// A bubble on its way: where it was when its place changed, since when, where it goes and where it is now. `on`:
// whether it goes to its group's large bubble.
type Fly = { from: Spot; to: Spot; at: Spot; since: number; on: boolean };
// What has a bubble. `heap`: where it rests while its group has its large bubble.
export type Flown = { heap?: Spot | undefined; fly?: Fly | undefined };

// Over the head of a figure at (x, z) in a crowd at the scale `k`.
export const headOf = (x: number, z: number, k: number): Spot => [x, 1.75 * k, z, 1.5 * k];

// Where the bubbles of a group rest, the middle of its places at (x, z), its crowd at the scale `k`: in its large
// bubble, at no size.
export const restOf = (x: number, z: number, k: number): Spot => [x, 1.12 * k + 0.45 + BALL * BIG, z, 0];

// How far a bubble drawn at the size `s` has left its head, where its size is `whole`: 0 to 1, for it shrinks to
// nothing on its way to the large one. Bounded: a crowd that changes its scale meanwhile gives a size past `whole`.
export const leftOf = (s: number, whole: number): number => Math.min(1, Math.max(0, 1 - s / whole));

// How high the name of one that waits stands, in metres: over its bubble, and down to where the others' stand as its
// bubble leaves for the large one (`bare`, ../render/kit.ts#Figure).
export const nameOver = (bare = 0): number => 1.6 + 0.65 * (1 - bare);

const same = (one: Spot, other: Spot): boolean => one.every((value, at) => Math.abs(value - other[at]!) < 1e-4);

// Where the bubble of `who` is at the town's second `seconds`. `away`: its place out of a heap. It flies to its heap
// and back, and to its heap's new place when its group moves. `sudden`: it is in place at once.
export function flown(who: Flown, away: Spot, seconds: number, sudden = false): Spot {
	const [on, to] = [!!who.heap, who.heap ?? away];
	const starts = sudden ? -FLY : seconds;
	const fly = (who.fly ??= { from: away, to, at: away, since: starts, on });
	if (fly.on !== on || (on && !same(fly.to, to))) [fly.from, fly.since, fly.on] = [fly.at, starts, on];
	fly.to = to;
	const linear = Math.min(1, (seconds - fly.since) / FLY);
	const done = linear * linear * (3 - 2 * linear);
	const between = (at: 0 | 1 | 2 | 3): number => fly.from[at] + (to[at] - fly.from[at]) * done;
	fly.at = [between(0), between(1), between(2), between(3)];
	return fly.at;
}

// Whether the bubble of `who` rests where it goes.
export const rests = (who: Flown, seconds: number): boolean => !who.fly || seconds >= who.fly.since + FLY;
