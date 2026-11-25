// The tier the town starts at, from a short probe before the arrival: a few frames of the whole town built, drawn at a
// tier, hidden, while the page still shows. Their pace says whether the machine holds that tier. A computer starts at
// the tier it holds at once (its sharpness does not jump after the arrival); a small graphics card starts low (a phone
// froze for seconds at the finest tier, or drew nothing).
// Elsewhere: drei's PerformanceMonitor and Babylon.js's SceneOptimizer start at a set quality and step after measured
// frames; the probe adds a measure before the first frame the user sees, the steps after it stay (./quality.ts).
import type { THREE } from "./nodes";

// Frames timed at a tier, at most: the least is the machine's own time, a busy moment aside.
const FRAMES = 3;
// The time of a frame (milliseconds) a tier is held under: 30 images a second.
const BUDGET = 33;
// A tier this slow at most (20 images a second) is kept once drawn (./quality.ts, its slow frame): the drawing may rise
// to it.
const NEAR = 50;
// A lowest tier slower than this (4 images a second) is not a card at another work: the machine does not hold the town.
// A computer's card that draws a frame in 17 ms read up to 83 ms while 79 other pages drew on it (13/11); a refusal by
// mistake costs its user the town for a day, a town opened slow costs a touch to close it.
const REFUSED = 250;

// The tiers tried from `tier` to the finest, one after the other, until one is slower than NEAR.
type Tried = { start: number; floor: number; lowest: number };
async function tried(count: number, timeAt: (tier: number) => Promise<number>, tier: number, found: Tried): Promise<Tried> {
	if (tier < 0) return found;
	const time = await timeAt(tier);
	if (tier === count - 1) found.lowest = time;
	if (time <= NEAR) found.floor = tier;
	if (time <= BUDGET) found.start = tier;
	// A tier near its budget does not stop the tries: the first tier tried pays what is left of the programs'
	// preparation, and read 28 to 33 ms where the finer one, 4 times the pixels, read 12 (13/11).
	if (time > NEAR) return found;
	return tried(count, timeAt, tier - 1, found);
}

// The finest tier the machine holds, tried from the lowest up, each drawn for real: what a finer tier costs more differs
// from a card to another. Told from one cheap tier by set factors, a phone was started too fine (its cost was 4 times
// higher with shadows and multisampling together) and a computer too low (it holds the finest at 60 images a second).
// A card at another work when the town opens (other pages drawing, a render) reads slower than it is: a computer that
// draws the finest tier in 17 ms took 33.5 (13/11). So a tier over the budget, yet under NEAR, is not the start but
// the `floor` the drawing may rise to once its frames are fast (./quality.ts#stepper); and the lowest tier over the
// budget is still the start (51 ms on that computer, a try later), unless it is slower than REFUSED: `start` is then
// `count`, the machine holds no tier.
export async function startTier(count: number, timeAt: (tier: number) => Promise<number>): Promise<{ start: number; floor: number }> {
	const { start, floor, lowest } = await tried(count, timeAt, count - 1, { start: count, floor: count, lowest: 0 });
	if (start < count) return { start, floor: Math.min(floor, start) };
	if (lowest > REFUSED) return { start: count, floor: count };
	// The lowest tier far from its budget: the finer one was not tried. Only frames fast for seconds bring a rise to it,
	// and a card truly slow has none.
	return { start: count - 1, floor: lowest > NEAR ? Math.max(0, count - 2) : Math.min(floor, count - 1) };
}

const tick = (): Promise<void> => new Promise((done) => setTimeout(done, 0));
// Waits, a tick at a time, for the card to pass `fence`.
async function passed(gl: WebGL2RenderingContext, fence: WebGLSync): Promise<void> {
	if (gl.getSyncParameter(fence, gl.SYNC_STATUS) === gl.SIGNALED) return;
	await tick();
	return passed(gl, fence);
}
// The frames timed, `at` so far and the least `best`: one frame under the budget says the tier is held; a small card is
// not frozen by more frames than it takes to know.
async function least(frame: () => Promise<number>, answer: number, at: number, best: number): Promise<number> {
	if (at >= FRAMES || best <= BUDGET) return best;
	const time = Math.max(0, (await frame()) - answer);
	return least(frame, answer, at + 1, Math.min(best, time));
}

// The backend's context on WebGL 2, its device on WebGPU, which three.js does not type.
const isContext = (value: unknown): value is WebGL2RenderingContext => typeof value === "object" && value !== null && "fenceSync" in value;
const isDevice = (value: unknown): value is GPUDevice => typeof value === "object" && value !== null && "queue" in value;
function backendOf({ backend }: THREE.WebGPURenderer): { gl?: WebGL2RenderingContext; device?: GPUDevice } {
	if ("gl" in backend && isContext(backend.gl)) return { gl: backend.gl };
	return "device" in backend && isDevice(backend.device) ? { device: backend.device } : {};
}

// The time of a frame of `draw` (milliseconds), from its start to the card done with it.
export async function probe(renderer: THREE.WebGPURenderer, draw: () => void): Promise<number> {
	const { gl, device } = backendOf(renderer);
	// The card has drawn all it was sent: its queue done on WebGPU, a fence passed on WebGL 2, read without blocking.
	const done = async (): Promise<void> => {
		if (!gl) {
			await device?.queue.onSubmittedWorkDone();
			return;
		}
		const fence = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0)!;
		gl.flush();
		await passed(gl, fence);
		gl.deleteSync(fence);
	};
	const waited = async (work: () => void): Promise<number> => {
		const sent = performance.now();
		work();
		await done();
		return performance.now() - sent;
	};
	// Each in a frame of the browser's own: three.js draws the town's pass once a frame, and a second drawing in the same
	// one costs next to nothing (a tier's buffers were then prepared in a frame that was timed).
	const frame = async (): Promise<number> => {
		await new Promise(requestAnimationFrame);
		return waited(draw);
	};
	// The first frame prepares the tier's buffers: it says nothing of the pace.
	await frame();
	// The browser's answer "the card is done" takes up to 40 ms by itself, whatever was drawn: read as the card's time,
	// it started a computer at half its sharpness, for good (13/11).
	const answer = Math.min(await waited(() => {}), await waited(() => {}));
	return least(frame, answer, 0, Infinity);
}
