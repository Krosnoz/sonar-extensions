// The camera follows a target, eased: a gesture moves the target, the camera catches up at every frame, and once there
// takes the inhabitants out from under the page's controls.
import type { View } from "./kit";
import { reducedMotion } from "./look";
import { bound, onIsland } from "./bounds";
import { controlsOver } from "./size";

// How far from a control of the page an inhabitant's body stays, in CSS pixels; and the half width of that body, in
// metres (./figures.ts#person, arms included): measured from the figure's axis, 12 px left 8 px to its arm (12/11).
const ROOM = 12;
const BODY = 0.4;
// How fast the rebound at the nearest level goes out and back: 80 ms out, then back to within 0.1 % in 160 ms.
const SPRING = 30;

export type Camera = {
	// The camera eases to this scale and this point of the screen's plane; `slow`: the morph's step back.
	fly: (scale: number, aim: [number, number], slow?: boolean) => void;
	jump: (scale: number, aim?: [number, number]) => void;
	// Moves the camera `dt` seconds towards its target.
	ease: (dt: number) => void;
	// The camera turned or tilted: its target, given on the old screen's axes, read on the new ones.
	carry: (map: (aim: [number, number]) => [number, number]) => void;
};

type Target = { scale: number; aim: [number, number] };
// What the camera follows, and how. `pace`: how fast the camera catches up: a gesture at once, the morph's step back to
// the whole town slowly.
// `settle`: the camera moved to a new target, and has not yet cleared the controls once it got there; `held` while a
// finger or the pointer holds the town.
// `anchored` while the pointer stays where the wheel zoomed: the point under it must stay there, as on any map, so the
// inhabitants come out from under the controls only once the pointer moves on. Moving the camera after each notch
// shifted the point under the pointer by 58 to 160 px at the second notch (12/11).
// `heading`: the heading and height at the last frame: a turn or a tilt moves the inhabitants on the screen, the aim
// barely. `spring`: the rebound at the nearest level (wheelAt): the seconds left before it springs back to `back`.
type Follow = {
	view: View;
	host: HTMLElement;
	figures: () => [number, number, number][];
	target: Target;
	pace: number;
	settle: boolean;
	held: boolean;
	anchored: boolean;
	heading: number[];
	spring: { left: number; back: Target } | null;
};

// The visible rectangle is held on the island (./bounds.ts), not only the screen's middle.
const clampAim = ({ view, host }: Follow, aim: [number, number], scale: number): [number, number] =>
	bound(view.outline(), view.whole, aim, scale, [host.clientWidth, view.band()[1]], view.unit(1));

function aimAt(f: Follow, scale: number, aim: [number, number], speed = 12, most = f.view.most): void {
	const kept = Math.min(most, Math.max(1, scale));
	f.target = { scale: kept, aim: clampAim(f, aim, kept) };
	f.pace = speed;
	[f.settle, f.anchored, f.spring] = [true, false, null];
}

// The aim that takes every inhabitant out from under the page's floating controls (./size.ts#controlsOver): the
// shorter of two moves, up over every control they are near, or aside past the inner edges, when all go the same way.
// Mixed, a crowd by the town's button pushed right and one by the settings pushed left kept one of them there.
function unhidden({ view, host, figures }: Follow, aim: [number, number], scale: number, controls: ReturnType<typeof controlsOver>): [number, number] {
	const [[top, height], unit] = [view.band(), view.unit(scale)];
	const room = ROOM + BODY / unit;
	let [up, aside, mixed] = [0, 0, false];
	for (const at of figures()) {
		const [u, v] = view.screenOf(at);
		const [x, y] = [host.clientWidth / 2 + (u - aim[0]) / unit, top + height / 2 - (v - aim[1]) / unit];
		for (const each of controls) {
			if (x < each.left - room || x > each.right + room || y < each.top - room || y > each.bottom + room) continue;
			up = Math.max(up, y - each.top + room);
			const side = each.left + each.right < host.clientWidth ? each.right + room - x : each.left - room - x;
			mixed ||= aside * side < 0;
			if (Math.abs(side) > Math.abs(aside)) aside = side;
		}
	}
	return !mixed && Math.abs(aside) < up ? [aim[0] - aside * unit, aim[1]] : [aim[0], aim[1] - up * unit];
}

// Zooms about a point of the screen: what is under it stays under it. `most`: the nearest level it may reach.
function zoomAt(f: Follow, factor: number, x: number, y: number, most = f.view.most, speed = 12): void {
	const { view, host, target } = f;
	const [rect, [top, height]] = [host.getBoundingClientRect(), view.band()];
	// About the middle of what the camera frames, under the page's top bar.
	const [dx, dy] = [x - rect.left - rect.width / 2, rect.top + top + height / 2 - y];
	const scale = Math.min(most, Math.max(1, target.scale * factor));
	const [before, after] = [view.unit(target.scale), view.unit(scale)];
	// Nothing else moves the aim: a rule that kept the steeple under the bar overrode the pointer at every step.
	const [aim, pointed]: [number, number][] = [
		[target.aim[0] + dx * (before - after), target.aim[1] + dy * (before - after)],
		[target.aim[0] + dx * before, target.aim[1] + dy * before],
	];
	const closer = scale > target.scale && scale <= view.most;
	aimAt(f, scale, aim!, speed, most);
	// Zooming in on the island's ground, the point under the pointer stays there: it is on the screen and on the
	// island, so the town is never lost. Held to the bound, the centred axis and the screen kept over the island slid
	// a court of the front edge out by the screen's bottom, 41 to 118 px at the first notches (14/11). Zooming out
	// goes back to the bound, as the whole town is framed at level 1.
	if (closer && onIsland(view.outline(), pointed!)) f.target = { scale, aim: aim! };
}

// At the nearest level, a notch that zooms in springs the camera 4 % past it about the pointer, then back, within
// 250 ms: the limit reads, as a list's edge does, and the level stays. Nothing moves with motion reduced. Without it,
// the last notches did nothing, with no sign why (12/11).
function wheelAt(f: Follow, factor: number, x: number, y: number): void {
	if (factor <= 1 || f.target.scale < f.view.most * 0.999) return zoomAt(f, factor, x, y);
	if (f.spring || reducedMotion()) return;
	const back = f.target;
	zoomAt(f, 1.04, x, y, f.view.most * 1.04, SPRING);
	f.spring = { left: 0.08, back };
}

// A drag follows the finger at once: easing would leave the town behind it.
// Past the bound after a zoom on the island's edge (zoomAt), a drag moves freely towards it, and not farther from it:
// bound at once, the town jumped back at the first pixel of the drag.
function towards(f: Follow, from: [number, number], aim: [number, number], scale: number): [number, number] {
	const [kept, was] = [clampAim(f, aim, scale), clampAim(f, from, scale)];
	const out = Math.hypot(was[0] - from[0], was[1] - from[1]);
	if (out < 1e-9 || Math.hypot(kept[0] - aim[0], kept[1] - aim[1]) <= out) return out < 1e-9 ? kept : aim;
	return from;
}
function drag(f: Follow, dx: number, dy: number): void {
	const { view, target } = f;
	const unit = view.unit(target.scale);
	const aim = towards(f, target.aim, [target.aim[0] - dx * unit, target.aim[1] + dy * unit], target.scale);
	aimAt(f, target.scale, aim);
	f.target = { scale: f.target.scale, aim };
	// Held to the same bounds as the target: past them, the camera would jerk back when the finger stops.
	view.set(view.scale, towards(f, view.aim, [view.aim[0] - dx * view.unit(view.scale), view.aim[1] + dy * view.unit(view.scale)], view.scale));
}

// Once there, and the town let go, the inhabitants come out from under the controls, once. Not over the whole
// town: the inhabitants are hidden there, and its framing leaves the controls clear already (./camera.ts).
// After a turn or a tilt too, once it stopped: a tilted view kept an inhabitant 8 px from a control (12/11).
function clearControls(f: Follow, scale: number): void {
	const { view, target } = f;
	const turned = view.yaw !== f.heading[0] || view.pitch !== f.heading[1];
	f.heading = [view.yaw, view.pitch];
	if (turned) [f.settle, f.anchored] = [true, false];
	if (!f.settle || f.held || f.anchored || turned || target.scale <= 1) return;
	const there = Math.abs(scale / target.scale - 1) < 0.01 && Math.hypot(view.aim[0] - target.aim[0], view.aim[1] - target.aim[1]) < view.unit(scale);
	if (!there) return;
	f.settle = false;
	// A few passes: a step that clears a crowd from one control may bring another under the next (the town's button
	// and the settings sit side by side on a phone).
	const controls = controlsOver(f.host);
	let aim = target.aim;
	for (let pass = 0; pass < 4; pass++) {
		const out = unhidden(f, aim, target.scale, controls);
		// Nobody under a control: the target stays. Bound again, it moved by up to 13 px, as the bound held a
		// held aim a little elsewhere (13/11).
		if (out[0] === aim[0] && out[1] === aim[1]) break;
		const next = clampAim(f, out, target.scale);
		if (Math.hypot(next[0] - aim[0], next[1] - aim[1]) < view.unit(target.scale) / 4) break;
		aim = next;
	}
	f.target = { scale: target.scale, aim };
}

// Eased in the log of the scale: each step of the zoom takes the same time, near or far.
function ease(f: Follow, dt: number): void {
	const { view } = f;
	if (f.spring && (f.spring.left -= dt) <= 0) [f.target, f.spring] = [f.spring.back, null];
	const { target } = f;
	const k = 1 - Math.exp(-dt * f.pace);
	const scale = Math.exp(Math.log(view.scale) + (Math.log(target.scale) - Math.log(view.scale)) * k);
	view.set(scale, [view.aim[0] + (target.aim[0] - view.aim[0]) * k, view.aim[1] + (target.aim[1] - view.aim[1]) * k]);
	clearControls(f, scale);
}

export function follow(view: View, host: HTMLElement, figures: () => [number, number, number][]) {
	const f: Follow = {
		view,
		host,
		figures,
		target: { scale: 1, aim: view.whole },
		pace: 12,
		settle: false,
		held: false,
		anchored: false,
		heading: [view.yaw, view.pitch],
		spring: null,
	};
	const camera: Camera = {
		// With motion reduced (Settings › Appearance, or the device's), the camera is there at once.
		fly: (scale, aim, slow = false) => (reducedMotion() ? camera.jump(scale, aim) : aimAt(f, scale, aim, slow ? 2.6 : 12)),
		jump: (scale, aim) => {
			aimAt(f, scale, aim ?? view.whole);
			view.set(f.target.scale, f.target.aim);
		},
		// Called at every frame of a turn: re-armed only when the target really moved, so the controls are read once.
		carry: (map) => {
			const aim = clampAim(f, map(f.target.aim), f.target.scale);
			if (Math.hypot(aim[0] - f.target.aim[0], aim[1] - f.target.aim[1]) > view.unit(f.target.scale)) f.settle = true;
			f.target = { scale: f.target.scale, aim };
		},
		ease: (dt) => ease(f, dt),
	};
	return {
		camera,
		zoomAt: (factor: number, x: number, y: number, most?: number, speed?: number) => zoomAt(f, factor, x, y, most, speed),
		wheelAt: (factor: number, x: number, y: number) => wheelAt(f, factor, x, y),
		drag: (dx: number, dy: number) => drag(f, dx, dy),
		hold: (on: boolean) => void (f.held = on),
		anchor: (on: boolean) => void (f.anchored = on),
	};
}
