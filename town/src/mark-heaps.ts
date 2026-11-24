// The count of a group that waits, written on its large bubble (./heaps.ts): figures on the middle of its ball, drawn
// on the marks' canvas (./far-marks.ts). They are the ball's: they grow and beat with it, and roll when the count
// changes. From afar a place's mark counts those who wait (./mark-cloud.ts): the count shows once the place's people
// read, as their mark goes (./mark-share.ts#READ), so that one of the two shows, never both.
import type { HeightMap } from "./heights";
import { TICK } from "./heaps";
import type { Heap } from "./kit";
import { count, fontAt, label, type Palette } from "./mark-paint";
import { READ, towards } from "./mark-share";

// The figures' height as a share of the ball's radius on the screen, and their least size, in CSS pixels: two
// figures stand in the ball's disc, and one that is small still reads.
const [TALL, LEAST] = [1.05, 11];
// The ink's line round the figures, in CSS pixels: it parts them from the ball's light side as from its shaded one.
const INK = 3;
// How far the figures roll, as a share of their height: the count before goes up and out, the new one comes from under.
const ROLL = 1.1;

// What the counts keep from one frame to the next, by their heap's rank: how much each reads, on its way to whole or
// gone. `hidden`: whether a building stands between a heap's count and the camera.
export type Badges = { heaps: Heap[]; hidden: (heap: Heap) => boolean; reads: (number | undefined)[] };
type Draw = { project: (at: [number, number, number]) => [number, number]; pen: CanvasRenderingContext2D; palette: Palette };

// Whether a building stands between a heap's count and the camera, along the camera's own axis (its view being
// parallel: the third column of `matrix`, the camera's). The ray climbs to the town's highest roof, up to 40 µs a heap:
// it is cast again only once the count or the axis has moved, as a slide or a zoom of the view changes nothing to it.
// A building that rises meanwhile (./plot.ts) is seen at the next of those moves.
export function hiddenOf(hides: HeightMap["hides"], matrix: () => ArrayLike<number>): Badges["hidden"] {
	const last = new Map<Heap, { at: Heap["at"]; toward: [number, number, number]; hidden: boolean }>();
	return (heap) => {
		const [at, axes, was] = [heap.at, matrix(), last.get(heap)];
		const [dx, dy, dz] = [axes[8] ?? 0, axes[9] ?? 0, axes[10] ?? 0];
		// The count's place is written anew at each frame of a flight only (./crowd-heaps.ts).
		if (was?.at === at && was.toward[0] === dx && was.toward[1] === dy && was.toward[2] === dz) return was.hidden;
		const hidden = hides(at, [dx, dy, dz]);
		last.set(heap, { at, toward: [dx, dy, dz], hidden });
		return hidden;
	};
}

const snap = (value: number): number => Math.round(value * devicePixelRatio) / devicePixelRatio;

// How far the heap's figures have rolled, 0 to 1, after `dt` seconds more: fast at first, slow as they come to rest.
function rolled(heap: Heap, dt: number): number {
	const { roll } = heap;
	if (!roll) return 1;
	roll.done += dt / TICK;
	if (roll.done >= 1) heap.roll = undefined;
	return 1 - (1 - Math.min(1, roll.done)) ** 3;
}

// The figures of `text`, `shift` of their roll under their place, `share` of them there.
function inked(pen: CanvasRenderingContext2D, text: string, size: number, shift: number, [alpha, share]: [number, number], palette: Palette): void {
	if (share <= 0) return;
	pen.globalAlpha = alpha * share;
	pen.lineWidth = INK;
	pen.lineJoin = "round";
	pen.strokeStyle = palette.ink;
	pen.textBaseline = "middle";
	pen.textAlign = "center";
	pen.strokeText(text, 0, shift * size * ROLL + 0.5);
	count(pen, text, 0, shift * size * ROLL, palette.surface);
}

// The count of each heap that shows, `shown` the share of the whole view the marks show in, `up` a metre up on the
// screen and `wide` a metre of the ground across it, `dt` the seconds since the last frame: what it draws is added to
// `next`, its drawing to `draws`.
export function badges(
	{ heaps, hidden, reads }: Badges,
	{ project, pen, palette }: Draw,
	[shown, up, wide, dt]: [number, number, number, number],
	next: number[][],
	draws: (() => void)[],
): void {
	for (const [at, heap] of heaps.entries()) {
		if (heap.shows <= 0) {
			// A heap that comes back reads as the view is then, not as it was when its last one went: seen from afar, its
			// count never shows beside its place's mark. And it says its count at once.
			[reads[at], heap.roll] = [undefined, undefined];
			continue;
		}
		// The same measure as the place's mark: its smallest people's height on the screen.
		const least = heap.people.reduce((tall, figure) => (figure.away ? tall : Math.min(tall, figure.tall ?? 0)), Infinity);
		// Nothing is written on a bubble a building hides: its count stood alone over the roof, beside its subject's sign.
		const wanted = least * up < READ || hidden(heap) ? 0 : 1;
		const read = (reads[at] = towards(reads[at] ?? wanted, wanted, dt));
		const turn = rolled(heap, dt);
		const alpha = shown * read;
		if (alpha < 0.02) continue;
		// It follows its bubble as it bobs, on the middle of its ball.
		const [px, py] = project([heap.at[0], heap.at[1] + heap.lift, heap.at[2]]);
		const [x, y] = [snap(px), snap(py)];
		// The ball's radius on the screen at its full size, and now.
		const [full, grown] = [heap.round * wide, heap.shows];
		const size = Math.max(LEAST, Math.round(full * TALL));
		const half = Math.ceil(full * Math.max(1, grown)) + INK;
		const [text, before] = [label(heap.count), heap.roll ? label(heap.roll.from) : ""];
		next.push([x - half, y - half, 2 * half, 2 * half, alpha, -1 - at, heap.count, grown, turn]);
		draws.push(() => {
			// Set before the pen is saved: the font's cache (./mark-paint.ts#fontAt) does not see what a restore undoes.
			fontAt(pen, size, palette);
			pen.save();
			pen.translate(x, y);
			// The figures roll inside the ball's disc, and grow with it.
			pen.beginPath();
			pen.arc(0, 0, Math.max(1, full * grown * 0.94), 0, 2 * Math.PI);
			pen.clip();
			pen.scale(grown, grown);
			inked(pen, before, size, -turn, [alpha, 1 - turn], palette);
			inked(pen, text, size, 1 - turn, [alpha, turn], palette);
			pen.restore();
		});
	}
}
