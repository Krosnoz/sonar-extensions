// The world's view: the town, the gestures that zoom and slide it (./gestures.ts), and what each level shows over it
// (../signs/signs.ts). Three levels, chosen by the size of a figure on the screen, never by the number of agents
// (./view-frames.ts):
// - the whole town: figures would be a few pixels, so they are hidden; each subject shows a sign over its roof;
// - a quarter: the figures come, in small cubes; each subject shows its name and its counts;
// - a subject: each figure shows its name.
import { reducedMotion } from "../sonar/look";
import type { Camera } from "./camera-follow";
import { compass, type Heading } from "./compass";
import { gestures } from "./gestures";
import { HIGHEST, LOWEST } from "./camera";
import { settled } from "./heading";
import { farMarks } from "../marks/far-marks";
import { mount, type Mounted, type Topic, type View, type World } from "../render/kit";
import { hiddenOf } from "../marks/mark-heaps";
import { THREE } from "../render/nodes";
import { notebook } from "../people/notebook";
import { paceMeter } from "../render/quality";
import { signs } from "../signs/signs";
import { sizeOf, type Size } from "./size";
import { town } from "../plan/town";
import { townEar } from "../sound/town-ear";
import { loop, startRun, type Live, type Project, type Run } from "./view-frames";

const [point, Y] = [new THREE.Vector3(), new THREE.Vector3(0, 1, 0)];

// How the page tells the town that the figure of an agent (`child` null) or of one of its subagents is born or goes
// (../people/layers.ts): an event on the town's host.
declare global {
	interface HTMLElementEventMap {
		"town-life": CustomEvent<{ handle: string; child: number | null; born: boolean }>;
	}
}

export type Opened = {
	mounted: Mounted;
	// The camera eases to this scale and this point of the screen's plane.
	fly: (scale: number, aim: [number, number], slow?: boolean) => void;
	jump: (scale: number, aim?: [number, number]) => void;
	// The camera back to its heading and height of the arrival, at once: the way back to the page reads the cells where
	// the cubes landed through the arrival's camera (../arrival/dots.ts).
	home: () => void;
	// Prepares the drawing, then draws a frame at each of the screen's: called once the scenes hold everything.
	start: () => Promise<void>;
	// Stops drawing (the town out of sight), or draws again.
	pause: (paused: boolean) => void;
	// The host's box, kept up to date without reading the page in a frame.
	size: Size;
	dispose: () => void;
	// Who drives the construction (the morph runs it forwards, then backwards); null: it follows the clock.
	drive: (building: ((seconds: number) => number) | null) => void;
	// The inhabitants show whatever the level: while the morph turns each card into one, it must be seen.
	keep: (people: boolean) => void;
	// Called after each frame, with the page's coordinates of a point of the town.
	onFrame: (listener: (seconds: number, project: Project) => void) => void;
};

// Where a point of the town shows on the page, in the host's pixels.
function projector(camera: THREE.Camera, size: Size): Project {
	const spot = new THREE.Vector3();
	return (at) => {
		spot.set(...at).project(camera);
		return [((spot.x + 1) / 2) * size.width, ((1 - spot.y) / 2) * size.height];
	};
}

const feet = (at: [number, number, number]): [number, number, number] => [at[0], 0, at[2]];

// The drawing prepared before anything moves. From afar: only what the camera frames is prepared, and the rest would be
// at its first frame. Then a first frame, with nothing built yet, so nothing shows: the night's glow prepares its passes
// only when it is first drawn, and froze the first second of the construction.
async function prepared(mounted: Mounted, running: () => boolean): Promise<void> {
	const view = mounted.world.view;
	const [scale, aim] = [view.scale, view.aim];
	view.set(1, view.whole);
	await mounted.compile();
	view.set(scale, aim);
	if (running()) mounted.frame(0, 0);
	await new Promise(requestAnimationFrame);
}

// The gestures, and the turns they give: a drag aims the camera's heading and height, a let go turn glides to the
// isometric heading nearest.
function steered(host: HTMLElement, view: View, world: World, run: Run, home: Heading, aimed: Heading, orient: Live["orient"]): Camera {
	const standing = (): [number, number, number][] => world.figures.flatMap(({ at }) => [at, feet(at)]);
	return gestures(
		host.querySelector("canvas")!,
		view,
		host,
		standing,
		(yaw, pitch) => {
			aimed.yaw += yaw;
			aimed.pitch = Math.min(HIGHEST, Math.max(LOWEST, aimed.pitch + pitch));
			run.gliding = false;
		},
		() => {
			// Below halfway from the lowest view to the highest.
			const heading = settled(aimed.yaw, aimed.pitch, home.yaw, (LOWEST + HIGHEST) / 2);
			if (heading === null) return;
			aimed.yaw = heading;
			// With motion reduced, the camera is on it at once.
			if (reducedMotion()) orient(aimed.yaw, view.pitch);
			else run.gliding = true;
		},
	);
}

// The signs over the town. A sign's subject: the camera aims at its house, from where the camera now looks. A figure a
// wall hides keeps its name when the town draws its silhouette through the wall (../render/see-through.ts).
function signsOver(layer: HTMLElement, mounted: Mounted, camera: Camera): ReturnType<typeof signs> {
	const { world } = mounted;
	const view = world.view;
	const aimOver = (index: number): [number, number] => {
		const anchor = world.anchors.find((each) => each.index === index);
		return anchor ? view.screenOf(anchor.at) : view.over(index);
	};
	return signs(
		layer,
		world,
		mounted.pixel,
		(index) => camera.fly(view.most, aimOver(index)),
		(figure, hidden) => !hidden || figure.seenThrough === true,
		mounted.inView,
	);
}

function openedOf(t: Live, home: Heading, size: Size, stop: () => void): Opened {
	const { run, mounted, camera, aimed } = t;
	const resume = (): void => {
		cancelAnimationFrame(run.next);
		run.previous = performance.now();
		run.next = requestAnimationFrame((at) => loop(t, at));
	};
	return {
		start: async () => {
			await prepared(mounted, () => run.running);
			if (run.running) resume();
		},
		pause: (paused) => (paused ? cancelAnimationFrame(run.next) : resume()),
		mounted,
		fly: camera.fly,
		jump: camera.jump,
		home: () => {
			[aimed.yaw, aimed.pitch] = [home.yaw, home.pitch];
			t.orient(home.yaw, home.pitch);
		},
		drive: (given) => void (run.building = given),
		keep: (shown) => void (run.kept = shown),
		onFrame: (listener) => void t.listeners.push(listener),
		size,
		dispose: () => {
			run.running = false;
			t.needle.dispose();
			stop();
			mounted.dispose();
			t.layer.remove();
		},
	};
}

// `ended`: the town's opening ends there, at the next step of its build (../sonar/toggle.ts, OPENING_LIMIT).
export async function openWorld(host: HTMLElement, topics: Topic[], theme: "light" | "dark", clear = false, ended?: AbortSignal): Promise<Opened> {
	const mounted = await mount(host, town, topics, theme, clear, ended);
	const { world } = mounted;
	const view = world.view;
	const layer = document.createElement("div");
	layer.className = "world-layer";
	host.append(layer);
	// The camera turns about the town and tilts over it; the town stays still. The sun turns with the camera, so
	// that the faces the user sees stay lit from the same side of the screen at every heading.
	// The heading and height the camera comes to by default (the town's own: ./camera.ts#homeOf).
	const home = { yaw: view.yaw, pitch: view.pitch };
	const aimed = { ...home };
	const sun = mounted.scene.children.find((child): child is THREE.DirectionalLight => child instanceof THREE.DirectionalLight);
	const sunFrom = sun?.position.clone().sub(sun.target.position);
	const orient = (yaw: number, pitch: number): void => {
		camera.carry(view.orient(yaw, pitch));
		if (sun && sunFrom) sun.position.copy(sun.target.position).add(point.copy(sunFrom).applyAxisAngle(Y, yaw));
	};
	const run = startRun();
	host.addEventListener("town-life", ({ detail }) => void mounted.play(detail.handle, detail.child, detail.born));
	const camera = steered(host, view, world, run, home, aimed, orient);
	// The sun turns with the camera: a camera that starts turned has it turned already.
	if (home.yaw !== 0) orient(home.yaw, home.pitch);
	const place = signsOver(layer, mounted, camera);
	const needle = compass(host, home, aimed, orient, () => run.running);
	const { size, stop } = sizeOf(host);
	const project = projector(world.camera, size);
	const hidden = hiddenOf(world.heights.hides, () => world.camera.matrixWorld.elements);
	const marking = farMarks(layer, world.figures, project, size, place.boxes, { heaps: world.heaps, hidden });
	const notes = notebook(host, layer, world.figures, size, mounted.inView);
	const paced = paceMeter();
	run.previous = performance.now();
	const started = run.previous;
	const t: Live = {
		run,
		mounted,
		world,
		view,
		layer,
		camera,
		aimed,
		orient,
		sun,
		place,
		needle,
		project,
		// The town's ear hears what each frame shows (../sound/town-sound.ts).
		listeners: [notes.frame, (_seconds, at) => townEar().frame(at, size)],
		marking,
		paced,
		started,
	};
	return openedOf(t, home, size, () => {
		stop();
		notes.dispose();
		townEar().quiet();
	});
}
