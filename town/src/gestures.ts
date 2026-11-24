// The gestures that zoom and slide the town: wheel, pinch, drag, double touch. The camera follows the target they move
// (./camera-follow.ts).
import type { View } from "./kit";
import { follow, type Camera } from "./camera-follow";
import { lockMode, twistBeyond, type PairMode } from "./two-fingers";
import { wheelFactor, wheelPixels } from "./wheel";

// A finger that moved this far (px) is no longer a tap: a sign it started on does not click.
const TAP = 6;
const DOUBLE_TAP = 10;

const angleOf = (a: [number, number], b: [number, number]): number => Math.atan2(b[1] - a[1], b[0] - a[0]);
const gap = (a: [number, number], b: [number, number]): number => Math.hypot(b[0] - a[0], b[1] - a[1]);
const middle = (a: [number, number], b: [number, number]): [number, number] => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];

const onSign = (event: Event): boolean => event.target instanceof Element && !!event.target.closest(".world-sign");
// The compass, and whatever else the town carries that is a control of its own, are left to their own touches.
const own = (event: Event): boolean => event.target instanceof Element && !!event.target.closest(".world-compass");
// The first two fingers down, when there are two.
function twoOf(pointers: Map<number, [number, number]>): [[number, number], [number, number]] | null {
	const [a, b] = [...pointers.values()];
	return a && b ? [a, b] : null;
}
function capture(host: HTMLElement, id: number): void {
	// A pointer that left already cannot be captured; the gesture goes on without.
	try {
		host.setPointerCapture(id);
	} catch {}
}

type Pair = { mode: PairMode | null; angle: number; gap: number; middle: [number, number]; since: number; applied: number };
// The gesture so far: `moved` once a finger went past a tap's reach; `pair` the two fingers' start, when there are two;
// `spent` once two fingers touched, until all lift (the one left must not slide the town).
type Touch = {
	pointers: Map<number, [number, number]>;
	starts: Map<number, [number, number]>;
	moved: boolean;
	spent: boolean;
	lastTap: { at: number; x: number; y: number };
	pair: Pair | null;
	turning: boolean;
};
// What the gestures move: the camera (./camera-follow.ts), and the turn given to `gestures`. `across` and `tilt`: a
// pointer's travel as a turn and a tilt.
type Moves = {
	zoomAt: (factor: number, x: number, y: number) => void;
	drag: (dx: number, dy: number) => void;
	hold: (on: boolean) => void;
	turn: ((yaw: number, pitch: number) => void) | undefined;
	turned: (() => void) | undefined;
	across: (dx: number) => number;
	tilt: (dy: number) => number;
};

function down(host: HTMLElement, t: Touch, moves: Moves, event: PointerEvent): void {
	if (own(event)) return;
	if (t.pointers.size === 0) [t.moved, t.spent] = [false, false];
	// Captured at once, except on a sign: captured, its click would go to the host. Captured when the finger moves.
	if (!onSign(event)) capture(host, event.pointerId);
	const at: [number, number] = [event.clientX, event.clientY];
	t.pointers.set(event.pointerId, at);
	t.starts.set(event.pointerId, at);
	moves.hold(true);
	t.turning = !!moves.turn && event.pointerType === "mouse" && event.button === 0 && !event.shiftKey;
	const now = performance.now();
	if (t.pointers.size === 1) {
		const near = Math.hypot(event.clientX - t.lastTap.x, event.clientY - t.lastTap.y) < DOUBLE_TAP;
		if (now - t.lastTap.at < 300 && near && !onSign(event)) {
			moves.zoomAt(2.5, event.clientX, event.clientY);
			t.lastTap.at = 0;
		}
		return;
	}
	const two = t.pointers.size === 2 ? twoOf(t.pointers) : null;
	if (two) {
		const [a, b] = two;
		[t.moved, t.spent] = [true, true];
		for (const id of t.pointers.keys()) capture(host, id);
		t.pair = { mode: null, angle: angleOf(a, b), gap: gap(a, b), middle: middle(a, b), since: now, applied: 0 };
	}
}

// Two fingers moved: once one of the three moves is locked, the camera follows it.
function pairMoved(pair: Pair, [a, b]: [[number, number], [number, number]], moves: Moves): void {
	const now = { gap: gap(a, b), angle: angleOf(a, b), middle: middle(a, b) };
	const mid = now.middle;
	if (!pair.mode) {
		// An angle is kept within a half turn of the start: the fingers crossing the axis would read a full turn.
		const twist = Math.atan2(Math.sin(now.angle - pair.angle), Math.cos(now.angle - pair.angle));
		pair.mode = lockMode({ zoom: now.gap - pair.gap, twist, radius: pair.gap / 2, tilt: now.middle[1] - pair.middle[1] });
		// The motion before the lock is not played back: the camera follows from here.
		if (pair.mode) [pair.gap, pair.middle] = [now.gap, now.middle];
		return;
	}
	if (pair.mode === "zoom") {
		if (pair.gap > 0) moves.zoomAt(now.gap / pair.gap, mid[0], mid[1]);
		pair.gap = now.gap;
	} else if (pair.mode === "twist") {
		const twist = Math.atan2(Math.sin(now.angle - pair.angle), Math.cos(now.angle - pair.angle));
		const step = twistBeyond(twist, pair.applied);
		pair.applied += step;
		moves.turn?.(step, 0);
	} else {
		// The average of the two fingers' travel, not one finger's: a pinch's wobble cancels out.
		moves.turn?.(0, moves.tilt(now.middle[1] - pair.middle[1]));
		pair.middle = now.middle;
	}
}

function moved(host: HTMLElement, t: Touch, moves: Moves, event: PointerEvent): void {
	const was = t.pointers.get(event.pointerId);
	if (!was) return;
	const at: [number, number] = [event.clientX, event.clientY];
	t.pointers.set(event.pointerId, at);
	const start = t.starts.get(event.pointerId)!;
	if (!t.moved && gap(start, at) >= TAP) {
		t.moved = true;
		capture(host, event.pointerId);
	}
	if (t.spent && !t.pair) return;
	const two = t.pair && t.pointers.size === 2 ? twoOf(t.pointers) : null;
	if (t.pair && two) return pairMoved(t.pair, two, moves);
	if (t.pointers.size > 1) return;
	if (t.turning) moves.turn?.(moves.across(at[0] - was[0]), moves.tilt(at[1] - was[1]));
	else if (t.moved) moves.drag(at[0] - was[0], at[1] - was[1]);
}

// The taps a lift ends: two fingers that touched and left quickly, or one finger's tap, kept for a double tap.
function tapsLifted(t: Touch, moves: Moves, event: PointerEvent): void {
	const [a, b] = [...t.pointers.values()];
	const { pair } = t;
	// Two fingers that touched and left quickly, neither pinching nor twisting: a tap with two fingers, one step back.
	if (pair && !pair.mode && event.type === "pointerup" && t.pointers.size === 2 && performance.now() - pair.since < 300 && a && b)
		moves.zoomAt(1 / 2.5, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2);
	if (t.pointers.size === 1 && !t.moved && !t.spent && event.type === "pointerup") t.lastTap = { at: performance.now(), x: event.clientX, y: event.clientY };
}

function lifted(t: Touch, moves: Moves, event: PointerEvent): void {
	if (!t.pointers.has(event.pointerId)) return;
	tapsLifted(t, moves, event);
	if ((t.pointers.size === 1 && t.turning && t.moved) || t.pair?.mode === "twist") moves.turned?.();
	t.pointers.delete(event.pointerId);
	t.starts.delete(event.pointerId);
	moves.hold(t.pointers.size > 0);
	if (t.pointers.size < 2) t.pair = null;
}

// `turn`: turns the camera about the town and tilts it, in radians, as a 3D map does: a mouse's drag with the
// main button turns it across and tilts it up and down, with Shift or the right button it slides; a finger slides; two
// fingers pinch, twist or move up and down together, one of the three at a time. The listeners are on the host, so that a
// sign under a finger does not stop the gesture.
// `figures`: where the inhabitants stand, from their feet to their heads: none is left under a control of the page.
export function gestures(
	canvas: HTMLCanvasElement,
	view: View,
	host: HTMLElement,
	figures: () => [number, number, number][],
	turn?: (yaw: number, pitch: number) => void,
	// A turn was let go: the mouse's drag that turned, or the fingers that twisted, lifted.
	turned?: () => void,
): Camera {
	// A quarter turn across the canvas' width; from the lowest view to the highest across its height.
	const across = (dx: number): number => (-dx / canvas.clientWidth) * Math.PI * 0.5;
	const tilt = (dy: number): number => (dy / canvas.clientHeight) * (Math.PI / 3);
	const { camera, zoomAt, wheelAt, drag, hold, anchor } = follow(view, host, figures);
	// Where the pointer was at the last notch of the wheel: the zoom stays anchored there until it moves on.
	let wheeled: [number, number] | null = null;
	// While the town comes or goes (`moving`, ./toggle.ts), no gesture reaches it: a drag turned it under the cubes still
	// flying. The host still takes the pointer: the map under it stays still too.
	const still = (event: Event): void => {
		if (!host.classList.contains("moving")) return;
		event.stopImmediatePropagation();
		event.preventDefault();
	};
	for (const type of ["wheel", "pointerdown", "click"]) host.addEventListener(type, still, { capture: true, passive: false });
	host.addEventListener("contextmenu", (event) => event.preventDefault());
	host.addEventListener(
		"wheel",
		(event) => {
			event.preventDefault();
			wheelAt(event.ctrlKey ? Math.exp(-wheelPixels(event) * 0.01) : wheelFactor(wheelPixels(event)), event.clientX, event.clientY);
			wheeled = [event.clientX, event.clientY];
			anchor(true);
		},
		{ passive: false },
	);
	const release = (): void => {
		wheeled = null;
		anchor(false);
	};
	host.addEventListener("pointermove", (event) => {
		if (wheeled && gap(wheeled, [event.clientX, event.clientY]) >= TAP) release();
	});
	host.addEventListener("pointerleave", () => wheeled && release());
	const t: Touch = { pointers: new Map(), starts: new Map(), moved: false, spent: false, lastTap: { at: 0, x: 0, y: 0 }, pair: null, turning: false };
	const moves: Moves = { zoomAt, drag, hold, turn, turned, across, tilt };
	// A sign's click holds only for a tap: a drag that began on it did not mean to open it.
	host.addEventListener(
		"click",
		(event) => {
			if (!t.moved || !onSign(event)) return;
			event.stopPropagation();
			event.preventDefault();
		},
		true,
	);
	host.addEventListener("pointerdown", (event) => down(host, t, moves, event));
	host.addEventListener("pointermove", (event) => moved(host, t, moves, event));
	const lift = (event: PointerEvent): void => lifted(t, moves, event);
	host.addEventListener("pointerup", lift);
	host.addEventListener("pointercancel", lift);
	return camera;
}
