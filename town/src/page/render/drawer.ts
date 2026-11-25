// The town's drawing: its renderer, its passes (./pipeline.ts) and its tier (./quality.ts). The tier starts where a short
// probe says (./probe.ts), steps with the frames' pace, steps down when the card refuses a buffer, and the whole drawing
// starts again one tier lower when the card is lost (./lost.ts). Past the lowest, the page says the town failed rather
// than leave a blank screen.
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { refused, restored } from "./lost";
import { THREE } from "./nodes";
import { Unheld } from "../sonar/offered";
import { pipeline } from "./pipeline";
import { probe, startTier } from "./probe";
import { software, stepper, tiersFor, type Pace, type Tier } from "./quality";
import { shownDrawn } from "./shown-drawn";
import { warmed } from "./warm";

type Passes = Omit<Parameters<typeof pipeline>[1], "start">;
// Times the drawing may start again before the page gives up.
const RESTARTS = 2;
// Frames after a change of tier before the card's refusals are read: the change allocates at the first.
const CHECK = 2;

export type Drawer = {
	renderer: () => THREE.WebGPURenderer;
	render: () => void;
	compile: (built: (on: boolean) => void) => Promise<void>;
	// Starts making the programs of what the scenes hold now; `compile` waits for it, then makes the rest.
	precompile: () => void;
	pace: (pace: Pace) => void;
};

// For the page tests, whose browser draws on the processor: `sonar:town-draw` holds a drawing in JSON, a tier and what
// it changes of it (samples, passes, shadows, ratio), read before any program is prepared; that tier is then kept,
// whatever the machine.
type Asked = Partial<Tier> & { tier?: number };
const isAsked = (value: unknown): value is Asked => typeof value === "object" && value !== null;
function askedOf(text: string | null): Asked | null {
	const value: unknown = JSON.parse(text ?? "null");
	return isAsked(value) ? value : null;
}

// The tiers, the one asked by a page test drawn as asked, and the tier the town keeps, if any.
function tiersAsked(renderer: THREE.WebGPURenderer): { tiers: Tier[]; fixed: string | null } {
	const tiers = tiersFor(renderer.getPixelRatio(), devicePixelRatio);
	const asked = askedOf(localStorage.getItem("sonar:town-draw"));
	const pinned = asked ? Math.min(tiers.length - 1, asked.tier ?? 0) : null;
	if (asked && pinned !== null) tiers[pinned] = { ...tiers[pinned]!, ...asked };
	const fixed = pinned !== null ? String(pinned) : null;
	return { tiers, fixed };
}

// The drawing, its one owner of what changes: the renderer and its passes (`piece`), the tier drawn (`level`), the
// next tier the pace asks (`next`), and the frames counted since the start.
type Drawing = {
	host: HTMLElement;
	make: (canvas: HTMLCanvasElement) => Promise<THREE.WebGPURenderer>;
	passes: Passes;
	tiers: Tier[];
	fixed: string | null;
	renderer: THREE.WebGPURenderer;
	piece: ReturnType<typeof pipeline>;
	level: number;
	next: (pace: Pace) => number | null;
	frames: number;
	checkAt: number;
	restarts: number;
	restarting: boolean;
	early: Promise<void> | null;
};

// The tier drawn, read by the page tests.
function apply(d: Drawing, at: number): void {
	d.level = at;
	const tier = d.tiers[at]!;
	d.host.dataset["tier"] = String(at);
	d.renderer.setPixelRatio(tier.ratio);
	d.renderer.setSize(d.host.clientWidth, d.host.clientHeight, false);
	d.piece.use(tier);
	d.checkAt = d.frames + CHECK;
}

function fail(host: HTMLElement): void {
	host.dataset["failed"] = "1";
	host.dispatchEvent(new CustomEvent("town-failed", { bubbles: true }));
}

// A new renderer on the same canvas, one tier lower: the scenes keep their objects, which the new renderer sends to
// the card again; the sky's light is drawn again for it.
async function restart(d: Drawing): Promise<void> {
	if (d.restarting) return;
	d.restarting = true;
	d.restarts++;
	d.host.dataset["restarts"] = String(d.restarts);
	const lower = Math.min(d.tiers.length - 1, d.level + 1);
	if (d.restarts > RESTARTS || !(await restored(d.renderer))) return fail(d.host);
	try {
		// The lost renderer is left to the garbage collector, not released: three.js's WebGL 2 release loses the
		// context on purpose, and lost the one just given back (13/11).
		d.renderer = await d.make(d.renderer.domElement);
		d.renderer.onDeviceLost = () => void restart(d);
		d.passes.scene.environment = new THREE.PMREMGenerator(d.renderer).fromScene(new RoomEnvironment(), 0.04).texture;
		d.level = lower;
		d.host.dataset["tier"] = String(lower);
		d.renderer.setPixelRatio(d.tiers[lower]!.ratio);
		d.renderer.setSize(d.host.clientWidth, d.host.clientHeight, false);
		d.piece = pipeline(d.renderer, { ...d.passes, start: d.tiers[lower]! });
		await d.piece.compile();
		if (d.fixed === null) d.next = stepper(d.tiers.length, lower);
		d.restarting = false;
	} catch (error) {
		console.error("town: the drawing did not start again", error);
		fail(d.host);
	}
}

async function compile(d: Drawing, built: (on: boolean) => void): Promise<void> {
	await d.early;
	await d.piece.compile();
	// On WebGPU a probed tier keeps the samples of the start (./pipeline.ts#user): no program is prepared again.
	if (d.fixed !== null) return;
	const canvas = d.renderer.domElement;
	canvas.style.visibility = "hidden";
	built(true);
	await warmed(d.renderer, () => d.piece.drawn.render());
	const probed: string[] = [];
	const { start, floor } = await startTier(d.tiers.length, async (tier) => {
		apply(d, tier);
		const time = await probe(d.renderer, () => d.piece.drawn.render());
		probed.push(`${tier}: ${time.toFixed(1)}`);
		return time;
	});
	// The lowest tier is the least the town is drawn at (./quality.ts): a machine that does not hold it shows none.
	if (start === d.tiers.length) throw new Unheld(`town: not held (${probed.join(" | ")})`);
	built(false);
	apply(d, start);
	await shownDrawn(canvas, () => d.piece.drawn.render());
	d.next = stepper(d.tiers.length, start, floor);
}

// `make`: a renderer, on the canvas of the lost one when given. `shadows`: told whether the start tier keeps them.
export function drawer(
	host: HTMLElement,
	first: THREE.WebGPURenderer,
	make: (canvas: HTMLCanvasElement) => Promise<THREE.WebGPURenderer>,
	passes: Passes,
	shadows: (on: boolean) => void,
): Drawer {
	const { tiers, fixed } = tiersAsked(first);
	// A machine that draws on its processor does not hold the town (../sonar/offered.ts): no program is prepared for it.
	if (fixed === null && software(first)) throw new Unheld("town: drawn on the processor");
	const level = fixed !== null ? Math.min(tiers.length - 1, Math.max(0, Number(fixed) || 0)) : 0;
	const next = fixed !== null ? (): null => null : stepper(tiers.length, level);
	shadows(tiers[level]!.shadows);
	const piece = pipeline(first, { ...passes, start: tiers[level]! });
	const d: Drawing = {
		host,
		make,
		passes,
		tiers,
		fixed,
		renderer: first,
		piece,
		level,
		next,
		frames: 0,
		checkAt: CHECK,
		restarts: 0,
		restarting: false,
		early: null,
	};
	first.setPixelRatio(tiers[level]!.ratio);
	host.dataset["tier"] = String(level);
	first.onDeviceLost = () => void restart(d);

	return {
		renderer: () => d.renderer,
		render() {
			if (d.restarting) return;
			d.piece.drawn.render();
			if (++d.frames !== d.checkAt || !refused(d.renderer)) return;
			if (d.level < tiers.length - 1) apply(d, d.level + 1);
			else void restart(d);
		},
		precompile() {
			d.early ??= d.piece.compile();
		},
		compile: (built) => compile(d, built),
		pace(pace) {
			const at = d.next(pace);
			if (at !== null && !d.restarting) apply(d, at);
		},
	};
}
