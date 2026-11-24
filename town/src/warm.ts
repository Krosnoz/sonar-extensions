// The town's first frame, drawn hidden before the probe, with its programs made aside. `compileAsync` leaves out what a
// frame prepares by itself: the sun's shadow (three.js r187 draws no shadow map while it precompiles), the glow's passes.
// Made in a frame of the probe, each program was made at once by the card, and the page froze 1 to 1.7 s, twice (13/11).
// Here three.js makes them as `compileAsync` does (`createRenderPipelineAsync`), and leaves out of the frame what is
// not ready (`Pipelines#isReady`); the frame is drawn again until it asks for no new program.
// Elsewhere: three.js's own `compileAsync` (src/renderers/common/Renderer.js) uses the same path for the scene's
// materials; Babylon.js's `whenReadyAsync` waits for every effect to be compiled before the first frame.
import type { THREE } from "./nodes";

type Pipelines = {
	updateForRender: (object: unknown) => void;
	getForRender: (object: unknown, promises?: Promise<void>[] | null) => unknown;
};

// Frames at most: a pass may show only once the one before it is drawn (the glow, after the town).
const ROUNDS = 4;

// three.js keeps its pipelines in a field it does not type.
const isPipelines = (value: unknown): value is Pipelines =>
	typeof value === "object" && value !== null && "updateForRender" in value && "getForRender" in value;

// One hidden frame, its new programs made aside; then the next, `left` frames at most, until one asks for none.
async function rounds(pipelines: Pipelines, draw: () => void, left: number): Promise<void> {
	const own = pipelines.updateForRender;
	const pending: Promise<void>[] = [];
	pipelines.updateForRender = (object) => void pipelines.getForRender(object, pending);
	try {
		draw();
	} finally {
		pipelines.updateForRender = own;
	}
	if (pending.length === 0) return;
	await Promise.all(pending);
	if (left > 1) await rounds(pipelines, draw, left - 1);
}

export async function warmed(renderer: THREE.WebGPURenderer, draw: () => void): Promise<void> {
	const pipelines: unknown = Reflect.get(renderer, "_pipelines");
	// WebGL 2 tells a program's end by a frame of the browser: its first frame stays as it was.
	if (!isPipelines(pipelines) || !("isWebGPUBackend" in renderer.backend)) return;
	await rounds(pipelines, draw, ROUNDS);
}
