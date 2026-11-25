// What each frame of the world's view does: the camera eased and turned, the level chosen by the size of a figure on
// the screen, the inhabitants and the marks faded in or out, the town drawn, then the signs and the marks placed over it.
import type { Camera } from "./camera-follow";
import type { Compass, Heading } from "./compass";
import type { farMarks } from "../marks/far-marks";
import { glide } from "./heading";
import type { Mounted, View, World } from "../render/kit";
import { fitShadow } from "../render/light";
import type { THREE } from "../render/nodes";
import type { paceMeter } from "../render/quality";
import type { signs } from "../signs/signs";

export const NEAR = 12; // CSS pixels per metre from which figures show: a figure is then about 14 px tall.
const CLOSE = 34; // From there, each figure shows its name.

export type Project = (at: [number, number, number]) => [number, number];

// A level is left only a little past the threshold that entered it: a zoom that stops on a threshold would flicker.
const BACK = 10.5 / NEAR;
const levelOf = (perMetre: number, previous: number): number => {
	const [near, close] = [previous >= 1 ? NEAR * BACK : NEAR, previous >= 2 ? CLOSE * BACK : CLOSE];
	return perMetre < near ? 0 : perMetre < close ? 1 : 2;
};

// What changes from a frame to the next. `gliding` while a let go turn glides to its isometric heading (./heading.ts).
// `people` and `marked`: how far the inhabitants and the marks have come; `kept`: the inhabitants show whatever the
// level. `building`: who drives the construction.
export type Run = {
	running: boolean;
	next: number;
	previous: number;
	level: number;
	people: number;
	kept: boolean;
	marked: number;
	gliding: boolean;
	building: ((seconds: number) => number) | null;
};
export const startRun = (): Run => ({
	running: true,
	next: 0,
	previous: 0,
	level: 0,
	people: 0,
	kept: false,
	marked: 0,
	gliding: false,
	building: null,
});
// What the frames read, and `run`, the one owner of what they change.
export type Live = {
	run: Run;
	mounted: Mounted;
	world: World;
	view: View;
	layer: HTMLElement;
	camera: Camera;
	aimed: Heading;
	orient: (yaw: number, pitch: number) => void;
	sun: THREE.DirectionalLight | undefined;
	place: ReturnType<typeof signs>;
	needle: Compass;
	project: Project;
	listeners: ((seconds: number, project: Project) => void)[];
	marking: ReturnType<typeof farMarks>;
	paced: ReturnType<typeof paceMeter>;
	started: number;
};

// Eased as the zoom is, at the same pace: a drag turns the camera smoothly, and stops with the hand.
function turning({ run, view, aimed, orient }: Live, dt: number): void {
	if (Math.abs(aimed.yaw - view.yaw) > 1e-4 || Math.abs(aimed.pitch - view.pitch) > 1e-4) {
		const k = 1 - Math.exp(-dt * 12);
		// A let go turn glides faster, and lands on its heading exactly: the town's pixels fall back on their grid.
		orient(run.gliding ? glide(view.yaw, aimed.yaw, dt) : view.yaw + (aimed.yaw - view.yaw) * k, view.pitch + (aimed.pitch - view.pitch) * k);
	} else if (run.gliding && view.yaw !== aimed.yaw) orient(aimed.yaw, view.pitch);
	if (view.yaw === aimed.yaw) run.gliding = false;
}

function fading({ run, mounted }: Live, dt: number): void {
	run.people = Math.max(0, Math.min(1, run.people + (run.level > 0 || run.kept ? dt : -dt) / 0.35));
	mounted.people(run.people);
	// The marks come once the town is built, at the pace the people come and go.
	run.marked = Math.max(0, Math.min(1, run.marked + (mounted.arrived() ? dt : -dt) / 0.35));
}

export function loop(t: Live, now: number): void {
	const { run, mounted, view, world } = t;
	if (!run.running) return;
	// Slow frames lower the drawing's quality, fast ones raise it again (../render/quality.ts).
	mounted.pace(t.paced(now - run.previous));
	const dt = Math.max(0, Math.min(0.1, (now - run.previous) / 1000));
	run.previous = now;
	t.camera.ease(dt);
	turning(t, dt);
	run.level = levelOf(1 / view.unit(view.scale), run.level);
	t.needle.follow(view);
	fading(t, dt);
	const seconds = (now - t.started) / 1000;
	// The shadow's frame follows what the screen shows: fine and steady at every zoom (../render/light.ts#fitShadow).
	if (t.sun) fitShadow(t.sun, world.camera, world);
	mounted.frame(seconds, run.building ? run.building(seconds) : seconds);
	for (const listener of t.listeners) listener(seconds, t.project);
	t.layer.dataset["level"] = String(run.level);
	t.layer.classList.toggle("shown", mounted.arrived());
	t.place(run.level, t.project);
	// After the signs: the marks keep clear of where they stand now.
	t.marking(run.marked);
	run.next = requestAnimationFrame((at) => loop(t, at));
}
