// The world's harness: renderer (./renderer.ts), arrival (a front paced by ./pace.ts, construction in small cubes), instanced parts
// (./parts.ts), the drawing and its tier (./drawer.ts). A world (./town.ts) only says what stands where and how it moves. A
// building rises in its own colours, without a glow: a glow saturated to white and read as a flash.
import { uniform } from "three/tsl";
import type { Delays } from "./delays";
import type { HeightMap } from "./heights";
import { flying, type Flight } from "./layer-grains";
import { light } from "./light";
import type { Stage, Wanted } from "./live-steps";
import type { Pull } from "./pulls";
import { THREE, rgb, type Node, type Vec3 } from "./nodes";
import { parts, uniforms, type How, type Part, type Uniforms } from "./parts";
import { PLOT, pace } from "./pace";
import { drawer } from "./drawer";
import type { Pace } from "./quality";
import { handBack, stepped, type Steps } from "./steps";
import { topOf } from "./size";
import { paintStates } from "./state-colours";
import { fitted, rendererFor } from "./renderer";
import { colourOf, sparksOf } from "./rim";
import { moves, stageOf, thrown } from "./stage";
import type { Spot } from "./camera";

// `act`: what its last tool has it hold while it works (./sources.ts#actOf); none, its crate.
export type Agent = { name: string; state: number; seed: number; children: number[]; handle?: string; act?: number };
// `pulls`: the open pull requests of its sessions (./pulls.ts); none when left out.
// `landing`: those merged while the town is open, whose storey is being laid (./landing.ts).
// `merges`: how many merges the subject has, its closed sessions' too: its building's height (./merge-floors.ts).
// `held`: a subject to come, which the town holds a block for (./plot.ts): not built yet, without a name until it comes.
export type Topic = {
	name: string;
	agents: Agent[];
	working: number;
	waiting: number;
	reviewing: number;
	pulls?: Pull[];
	landing?: Pull[];
	merges?: number;
	held?: boolean;
};
export type Kit = {
	night: boolean;
	aspect: number;
	random: () => number;
	uTime: Node;
	scene: THREE.Scene;
	part: (geometry: THREE.BufferGeometry, count: number, how?: How) => Part;
	// Where a point lies along the front's way: what lies there is built when the front passes it.
	along: (x: number, y: number, z: number) => number;
	blank: Vec3;
	// The block the town holds for a subject to come: its middle, how far its own front is, the share of its building
	// laid and that building's top (./plot-mask.ts). Left out where nothing is drawn.
	plot?: (x: number, z: number, front: number, share: number, top: number) => void;
	// The camera's heading now, in radians from the isometric one (./camera.ts): what faces the camera reads it
	// (./heaps.ts#facing). Left out where no camera turns.
	heading?: () => number;
};
// Where a figure stands now, for its name at the nearest level.
// `seenThrough`: what hides the figure shows its silhouette through (./see-through.ts), so a figure under a wall
// (`heights.hides`) is still on the screen, where its name may stand.
// `tall`: how tall the figure stands, in metres (the marks read its size on the screen, ./far-marks.ts).
// `lot`: the crowd it belongs to (./lots.ts), which the camera sees or not: a figure of a lot out of view is off the screen.
// `away`: the figure has gone (./layers.ts): it has no name.
// `bare`: how far the bubble of one that waits has left its head for its group's large one (./heaps.ts), 0 to 1: what
// stands over its head comes down with it.
export type Figure = {
	topic: number;
	agent: Agent;
	at: [number, number, number];
	seenThrough?: boolean;
	tall?: number;
	lot?: number;
	away?: boolean;
	bare?: number;
};
// The large bubble of a place's group that waits (./heaps.ts). `on`: the group has it, with `count` agents in it.
// `at`, `lift`: the middle of its ball, where its count is written, and how high it bobs now. `round`: its ball's
// radius at its full size, in metres. `shows`: how much of it is there, 0 to 1, and a little over as it lands or beats.
// `ticked`: the town's second its count last changed on a bubble that stayed. `roll`: its figures roll from the count
// before, `done` from 0 to 1 (./mark-heaps.ts).
// `people`: its place's figures, whose size on the screen says whether its count reads (./mark-heaps.ts).
export type Heap = {
	on: boolean;
	count: number;
	at: [number, number, number];
	round: number;
	lift: number;
	shows: number;
	people: Figure[];
	ticked?: number;
	roll?: { from: number; done: number } | undefined;
};
export type World = {
	camera: THREE.OrthographicCamera;
	// The town's box on the screen, how much of it the page's top bar hides, and the page's floating controls over it.
	frame: (width: number, height: number, top?: number, controls?: Spot[]) => void;
	range: [number, number];
	base: number;
	top: number;
	center: [number, number, number];
	reach: number;
	background: string;
	tick: (seconds: number) => void;
	glow?: [number, number];
	// The subjects' roofs, where their sign stands.
	// `roof`: the points of the roof's own surface clear of what stands on it, where the sign's anchor may stand; `crown`: the
	// tops of what stands higher on that roof (a hut, a tank), which the sign stands over (./roofs.ts#crownOf).
	anchors: { at: [number, number, number]; roof: [number, number, number][]; crown: [number, number, number][]; topic: Topic; index: number }[];
	figures: Figure[];
	// One per place of the town.
	heaps: Heap[];
	// The middle of each subject's block on the ground, and its side: a zone of the page lies down there.
	lots: {
		at: [number, number];
		side: number;
		house: { at: [number, number]; w: number; d: number; top: number; wall: string; roof: string; paving: string };
	}[];
	// The figure of an agent (`child` null) or of one of its subagents is born, or goes, in layers, from the town's second
	// `at` (./births.ts#played). `size`: a grain's, in metres. Returns its grains' flight, null without such a figure.
	play: (handle: string, child: number | null, born: boolean, at: number, size: number) => Flight | null;
	// Who is there now, while the town is open: its figures follow (./live.ts).
	follow: (wanted: Wanted[], on: Stage, now?: boolean) => void;
	// How many times its people have changed since: what says them (./signs.ts) says them again.
	revision: () => number;
	// What is built, by height on the ground: a figure behind a building has no name over the wall.
	heights: HeightMap;
	view: View;
};
// The camera: `scale` 1 frames the whole town; `aim` is the point looked at, in the screen's plane (right, up).
export type View = {
	scale: number;
	aim: [number, number];
	whole: [number, number];
	most: number;
	set: (scale: number, aim: [number, number]) => void;
	// The camera's heading and how far down it looks, in radians; `orient` turns and tilts it.
	yaw: number;
	pitch: number;
	// Returns how an aim of the old heading reads in the new one, by the ground under it.
	orient: (yaw: number, pitch: number) => (aim: [number, number]) => [number, number];
	// A point of the town on the screen's plane, in the axes `aim` is given in.
	screenOf: (at: [number, number, number]) => [number, number];
	over: (index: number) => [number, number];
	// World units per CSS pixel of the screen at this scale.
	unit: (scale: number) => number;
	// The town's outline on the screen's plane, at the camera's heading: a convex polygon, counter-clockwise.
	outline: () => [number, number][];
	// The band of the screen the camera frames: its top and its height, in CSS pixels from the town's box.
	band: () => [number, number];
};
// `steps`: the same build, in steps that give the browser its hand back (./steps.ts).
export type SceneDef = { dir: [number, number, number]; build: (kit: Kit, topics: Topic[]) => World; steps?: (kit: Kit, topics: Topic[]) => Steps<World> };

function seeded(seed: number): () => number {
	let s = seed;
	return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;
}

// The size of a pixel of the drawing, in CSS pixels, chosen once from the screen: one on a phone, two on a computer.
// It never changes with the zoom: the scene is drawn again at every level.
export const pixelFor = (width: number, height: number): number => (Math.min(width, height) < 600 ? 1 : 2);

// `frame(seconds, building)`: the town's life runs on `seconds`, its construction on `building` (the same by default): a
// construction run backwards takes the town apart while its inhabitants keep walking.
export type Mounted = {
	world: World;
	frame: (seconds: number, building?: number) => void;
	// Prepares the drawing programs without blocking the page; called once the scenes hold everything they draw.
	compile: () => Promise<void>;
	// Starts preparing the town's programs, everything shown, while the page still plans its flights (./morph.ts): the
	// card makes them meanwhile. `compile` waits for them.
	precompile: () => void;
	// Whether the camera sees a crowd's lot at the last frame (./lots.ts).
	inView: (lot: number) => boolean;
	people: (shown: number) => void;
	arrived: () => boolean;
	// The figure of an agent (`child` null) or of one of its subagents is born, or goes, in layers (./layers.ts), now.
	// False when the town has no such figure.
	play: (handle: string, child: number | null, born: boolean) => boolean;
	// The agents as the page shows them now: the town's figures follow, by layers and grains where the camera shows
	// them. `now`: at once everywhere (what changed while the town came, or was out of sight).
	follow: (wanted: Wanted[], now?: boolean) => void;
	// Told how fast the frames come, draws a tier lower or finer (./quality.ts).
	pace: (pace: Pace) => void;
	dispose: () => void;
	pixel: number;
	// Where the front is, and where a point is along its way: a card flies as the front comes to its inhabitant.
	front: () => number;
	along: (at: [number, number, number]) => number;
	band: number;
	// The seconds the front takes over the whole town.
	arrival: () => number;
	// Slows the front over what the camera shows now: called once the camera is placed, before `when` is read.
	focus: () => void;
	// The construction time at which the cube at `at` is laid, of a part placed at `origin`: a piece of the page flies
	// there to arrive just then.
	when: (at: [number, number, number], origin?: [number, number, number], past?: number) => number;
	// Where the front is at a construction time, and how much later each subject's building is laid (./delays.ts).
	frontAt: (building: number) => number;
	delays: Delays;
	scene: THREE.Scene;
	// Drawn over the town on its grid of pixels, without its edges: the cubes of the page.
	dustScene: THREE.Scene;
};

// What the frames of a mounted town share: its values, its pace, its world, its drawing, which parts are shown, whether
// its people show, and how far it was last built.
type Live = {
	u: Uniforms;
	time: ReturnType<typeof pace>;
	world: World;
	drawing: ReturnType<typeof drawer>;
	shown: (people: boolean, all?: boolean) => void;
	cull: ReturnType<typeof parts>["cull"];
	crowd: boolean;
	lastBuilt: number;
	// The grains of the figures born or going (./layer-grains.ts), the bricks thrown since the town opened (./stage.ts),
	// and a grain's size at the town's scale now.
	air: ReturnType<typeof flying>;
	cubes: ReturnType<typeof thrown>;
	grain: () => number;
	inView: (lot: number) => boolean;
};

// The town's frames, its programs prepared, and the share of its people shown.
function controls(live: Live): Pick<Mounted, "frame" | "compile" | "precompile" | "people" | "arrived" | "play" | "follow"> {
	const { u, time, world, drawing, shown, cull, air } = live;
	const stage = stageOf(u.top, air, live.cubes, live.grain, (lot) => live.crowd && moves() && live.inView(lot), moves);
	return {
		follow: (wanted, now) => world.follow(wanted, stage, now),
		frame(seconds, building = seconds) {
			live.lastBuilt = building;
			u.time.value = seconds;
			u.building.value = building;
			u.front.value = time.front(building);
			// The inhabitants of the lots the camera does not see are not drawn (./lots.ts).
			cull(world.camera);
			world.tick(seconds);
			air.tick(seconds, world.camera);
			live.cubes.tick(seconds, world.camera);
			drawing.render();
		},
		// A mark of 0 says a figure is there (./parts.ts#Part): the town's first instant is not one.
		play: (handle, child, born) => {
			const flight = world.play(handle, child, born, Math.max(u.time.value, 0.001), live.grain());
			if (flight) air.add(flight);
			return !!flight;
		},
		// Every part drawn while the programs are prepared: a part shown later (the people, at the first zoom) would prepare
		// its own in a frame, and freeze it. The probe draws the whole town built, then puts the construction back where it
		// was.
		compile: async () => {
			shown(live.crowd, true);
			await drawing.compile((built) => {
				const building = built ? time.total() + 2 : live.lastBuilt;
				u.building.value = building;
				u.front.value = time.front(building);
			});
			shown(live.crowd);
		},
		// Everything stays shown until `compile` is over: no frame is drawn before.
		precompile: () => {
			shown(live.crowd, true);
			drawing.precompile();
		},
		people: (share) => {
			u.people.value = share;
			if (share > 0 === live.crowd) return;
			live.crowd = share > 0;
			shown(live.crowd);
		},
		arrived: () => live.lastBuilt > time.total() + 1,
	};
}

// The town taken down.
function upkeep(drawing: ReturnType<typeof drawer>, resized: { disconnect: () => void }): Pick<Mounted, "dispose"> {
	return {
		dispose: () => {
			resized.disconnect();
			void drawing.renderer().dispose();
			drawing.renderer().domElement.remove();
		},
	};
}

// Each hand given back may end the build: an opening past its time limit stops there, its drawing let go.
const handOf = (renderer: THREE.WebGPURenderer, stop?: AbortSignal) => async (): Promise<void> => {
	await handBack();
	if (stop?.aborted) void renderer.dispose();
	stop?.throwIfAborted();
};

// `clear`: nothing is drawn where the town is not built yet, so the page under it shows until the front comes.
export async function mount(host: HTMLElement, def: SceneDef, topics: Topic[], theme: "light" | "dark", clear = false, stop?: AbortSignal): Promise<Mounted> {
	const night = theme === "dark";
	paintStates(host);
	const random = seeded(7);
	const cssPixel = pixelFor(host.clientWidth, host.clientHeight);
	const renderer = await rendererFor(host, clear);
	const scene = new THREE.Scene();
	const along = (x: number, y: number, z: number): number => x * def.dir[0] + y * def.dir[1] + z * def.dir[2];
	const u = uniforms();
	u.dir.value.fromArray(def.dir);
	const [red, green, blue] = colourOf(getComputedStyle(host).getPropertyValue("--accent").trim());
	u.accent.value.fromArray(new THREE.Color().setRGB(red / 255, green / 255, blue / 255, THREE.SRGBColorSpace).toArray());
	const { part, shown, settle, hold, cull, inView } = parts(scene, u, along, night);
	const blank = rgb(night ? "#12100e" : "#f5f2ec");
	const aspect = host.clientWidth / (host.clientHeight - topOf(host));
	const plot: Kit["plot"] = (x, z, front, share, top) => {
		u.plot.value.set(x, z, front, share);
		u.plotTop.value = top;
		// Its lamps' light changes hands when what stands on the new ground has risen at the block's middle.
		hold(x, z, front >= PLOT.fresh);
	};
	// The world makes its camera: its heading is read once the world is there.
	const made: { world?: World } = {};
	const kit: Kit = { night, aspect, random, uTime: u.time, scene, part, along, blank, plot, heading: () => made.world?.view.yaw ?? 0 };
	const hand = handOf(renderer, stop);
	const world = def.steps ? await stepped(def.steps(kit, topics), 25, undefined, hand) : def.build(kit, topics);
	made.world = world;
	settle();
	// The drawing's light (its sky drawn for the reflections) and passes are made in a task of their own (./steps.ts).
	await hand();
	shown(false);
	if (!clear) scene.background = new THREE.Color(world.background);
	const time = pace(world, along);
	[u.band.value, u.lead.value, u.base.value, u.top.value, u.front.value] = [time.band, time.lead, world.base, world.top, time.front(0)];

	const dustScene = new THREE.Scene();
	const sparks = uniform(0);
	const passes = { scene, dust: dustScene, camera: world.camera, glow: world.glow, clear, night, sparks };
	// A town that starts on a machine without a graphics card starts at the lowest tier, and without shadows.
	const shadows = (on: boolean): void => light(scene, renderer, world, night, host.clientWidth < 600, on);
	const drawing = drawer(host, renderer, (canvas) => rendererFor(host, clear, canvas), passes, shadows);
	const resized = fitted(host, drawing.renderer, world);

	// A grain is a point of one pixel of the town's drawing, as the page's (./flights.ts).
	const grain = (): number => cssPixel * world.view.unit(world.view.scale) * 1.2;
	const [air, cubes] = [flying(dustScene, u.accent.value, sparks), thrown(dustScene, night, sparksOf(host, night)[0])];
	const live: Live = { u, time, world, drawing, shown, cull, crowd: false, lastBuilt: 0, air, cubes, grain, inView };
	return {
		world,
		...controls(live),
		pace: drawing.pace,
		inView,
		pixel: cssPixel,
		front: () => u.front.value,
		along: (at) => along(...at),
		band: time.band,
		arrival: time.total,
		focus: () => time.focus(world.camera),
		when: time.when,
		frontAt: time.front,
		delays: u.delays,
		scene,
		dustScene,
		...upkeep(drawing, resized),
	};
}
