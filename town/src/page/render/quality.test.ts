// When the town changes its drawing's tier: down on frames that are slow one after the other, not on one frame the page
// stalled (a long task, a tab shown again), which says nothing of the machine; up again once the frames are fast for a
// while (a load that passed), and no more after a few falls back. Kept low for the session, a phone that met another
// tab's work once stayed blurred (12/11).

import { expect, test } from "bun:test";
import { startTier } from "./probe";
import { paceMeter, stepper, tiersFor, type Pace } from "./quality";

// A phone drew the town fluid with its passes off and a pixel for 4 on each side, and the town was ugly (13/11): a tier
// that takes away what makes the town is no tier.
test("every tier draws the whole town, never coarser than the screen", () => {
	const whole = { samples: 4, shadows: true, mask: true, tone: true, glow: true, smooth: true };
	// A screen of density 1 is drawn at 2: half of it is still a pixel for each of the screen's.
	expect(tiersFor(2, 1)).toEqual([
		{ ratio: 2, ...whole },
		{ ratio: 1, ...whole },
	]);
	// A phone of density 2.75 is drawn at 2.75: half of it would be coarser than its screen.
	expect(tiersFor(2.75, 2.75)).toEqual([{ ratio: 2.75, ...whole }]);
	expect(tiersFor(3, 1.5)).toEqual([
		{ ratio: 3, ...whole },
		{ ratio: 1.5, ...whole },
	]);
});

// Each tier is drawn for real, from the lowest up: the time of a frame at each (milliseconds).
test("the probe starts the town at the finest tier the machine holds, tried from the lowest", async () => {
	const tried: number[] = [];
	const machine = (times: number[]) => (tier: number) => {
		tried.push(tier);
		return Promise.resolve(times[tier]!);
	};
	// A computer holds every tier: the finest.
	expect(await startTier(4, machine([16, 8, 5, 3]))).toEqual({ start: 0, floor: 0 });
	// A tier just over the budget is not the start; the drawing may rise to it later.
	expect(await startTier(4, machine([44, 20, 9, 4]))).toEqual({ start: 1, floor: 0 });
	// A card slow at the lowest tier starts at it, and the finer ones are not drawn: each would freeze it. The next
	// tier, not tried, is open to a rise: only frames fast for seconds bring one, and such a card has none.
	tried.length = 0;
	expect(await startTier(4, machine([900, 400, 110, 55]))).toEqual({ start: 3, floor: 2 });
	expect(tried).toEqual([3]);
	// One that holds the lowest only: the next is tried, then no finer.
	tried.length = 0;
	expect(await startTier(4, machine([900, 400, 110, 19]))).toEqual({ start: 3, floor: 3 });
	expect(tried).toEqual([3, 2]);
});

// A computer whose card draws the finest tier in 17 ms took 33.5 ms while two agents drew on it, and more a try before:
// it started at half its sharpness for the session, or was told it cannot draw the town (13/11).
test("a computer at another work is not refused the town, and its drawing may rise once the work is over", async () => {
	const machine = (times: number[]) => (tier: number) => Promise.resolve(times[tier]!);
	expect(await startTier(2, machine([33.5, 32.1]))).toEqual({ start: 1, floor: 0 });
	const step = stepper(2, 1, 0);
	expect([step("fast"), step("fast")]).toEqual([0, null]);
	// Slow at the lowest tier, yet over 10 images a second (51.1 ms on that computer, a try later): the town starts
	// there, and the finer tier, not tried, is open to a rise.
	expect(await startTier(2, machine([70, 51.1]))).toEqual({ start: 1, floor: 0 });
	// The first tier tried pays what is left of the programs' preparation: it read 28 to 33 ms where the finer tier,
	// 4 times the pixels, read 12. A tier near its budget does not stop the tries: the finer one is the start.
	expect(await startTier(2, machine([12, 40]))).toEqual({ start: 0, floor: 0 });
	// A finer tier tried and far over the budget is closed: the drawing would rise and fall again.
	expect(await startTier(2, machine([80, 20]))).toEqual({ start: 1, floor: 1 });
	// The same computer, its screen of density 2 (one tier), read 83.4 ms while the agents drew: it holds the town.
	expect(await startTier(1, machine([83.4]))).toEqual({ start: 0, floor: 0 });
	expect(await startTier(2, machine([900, 130]))).toEqual({ start: 1, floor: 0 });
	// Under 4 images a second at the lowest tier: the machine does not hold the town (the count).
	expect(await startTier(2, machine([900, 300]))).toEqual({ start: 2, floor: 2 });
});

// On WebGPU the browser's answer "the card is done" takes a frame or so by itself: read as the card's time, it started
// a computer at half its sharpness, and a town never draws finer than its start (13/11).
test("the probe reads the pace of the frames, not the wait for the browser's answer", async () => {
	const { probe } = await import("./probe");
	// The page's clock is kept to be put back as it was (`finally` below).
	// oxlint-disable-next-line typescript/unbound-method
	const [frames, now] = [globalThis.requestAnimationFrame, performance.now];
	globalThis.requestAnimationFrame = (next) => setTimeout(next, 0) as unknown as number;
	// A clock of its own: a card that takes `cost` ms a frame, and a browser whose answer takes 20 ms by itself.
	let [clock, sent, drawn] = [0, 0, 0];
	performance.now = () => clock;
	const paceOf = (cost: number): Promise<number> => {
		drawn = 0;
		const done = (): Promise<void> => {
			clock += 20 + sent * cost;
			sent = 0;
			return Promise.resolve();
		};
		return probe({ backend: { device: { queue: { onSubmittedWorkDone: done } } } } as unknown as import("./nodes").THREE.WebGPURenderer, () => {
			sent++;
			drawn++;
		});
	};
	try {
		expect(await paceOf(2)).toBe(2);
		// Held: the frame that prepares the buffers, then one frame is enough to know.
		expect(await paceOf(30)).toBe(30);
		expect(drawn).toBe(2);
		expect(await paceOf(400)).toBe(400);
		expect(drawn).toBe(4);
	} finally {
		// oxlint-disable-next-line typescript/unbound-method
		[globalThis.requestAnimationFrame, performance.now] = [frames, now];
	}
});

// The whole drawing, then the same without its samples: no tier asks for it any more, a drawing asked for by hand does
// (`sonar:town-draw`, ./drawer.ts).
const whole = tiersFor(1, 1)[0]!;
const bare = { ...whole, samples: 0 };

// three.js r187's WebGL 2 backend forgets a multisampled target's own buffers when it releases the target: the pipeline
// releases them first (143 MB a change on a phone, both tiers' held after a step down).
test("a released town target releases its multisampled buffers", async () => {
	await import("../test-page");
	const { pipeline } = await import("./pipeline");
	const { THREE } = await import("./nodes");
	const freed: unknown[] = [];
	const renderer = {
		getPixelRatio: () => whole.ratio,
		backend: { textureUtils: { deallocateRenderBuffers: (target: unknown) => freed.push(target) } },
	} as unknown as InstanceType<typeof THREE.WebGPURenderer>;
	const scene = new THREE.Scene();
	const camera = new THREE.OrthographicCamera();
	const { use } = pipeline(renderer, { scene, dust: scene, camera, glow: undefined, clear: false, night: true, start: whole });
	use(bare);
	expect(freed).toHaveLength(1);
});

const feed = (frames: number[]): Pace[] => {
	const pace = paceMeter();
	return frames.map(pace);
};
const steady = (ms: number, count: number): number[] => Array<number>(count).fill(ms);

test("a fast machine with one stalled frame keeps its quality", () => {
	const frames = steady(16, 22);
	frames[8] = 1516;
	expect(feed(frames)).not.toContain("slow");
});

test("a tab shown again after minutes keeps its quality", () => {
	expect(feed([16, 16, 16, 16, 180_000, ...steady(16, 7)])).not.toContain("slow");
});

test("a machine whose frames are all slow is lowered", () => {
	expect(feed([16, 16, 80, 80, 80, 80, 80, 80])).toContain("slow");
});

// On a screen 2 560 px wide, by night, the finest tier drew 36 images a second: frames of 17 ms among frames of 50 and
// 67 ms, 144 in 4 s. Their median stayed 16.7 ms, and the town kept that tier (14/11).
test("a town that skips images one after the other for a second and more is lowered", () => {
	const uneven = Array.from({ length: 24 }, () => [16.7, 16.7, 50, 16.7, 66.7, 16.7]).flat();
	expect(feed(uneven)).toContain("slow");
});

// 1 920 px wide, by night: 229 frames of 240 at 16.7 ms, the others twice as long.
test("a town that skips an image now and then keeps its quality", () => {
	const frames = steady(16.7, 240);
	for (let at = 11; at < frames.length; at += 22) frames[at] = 33.3;
	expect(feed(frames)).not.toContain("slow");
});

test("a burst of the page's work, a tenth of a second long, keeps its quality", () => {
	expect(feed([...steady(16.7, 30), 50, 50, 33.3, 100, ...steady(16.7, 60)])).not.toContain("slow");
});

test("a machine drawing on the processor is lowered within two frames", () => {
	expect(feed([2000, 2000, 1400, 1400])).toEqual([null, null, null, "slow"]);
});

test("fast frames for about three seconds step the drawing up again", () => {
	const paces = feed([16, 16, ...steady(80, 6), ...steady(16, 2 + 6 * 30)]);
	expect(paces.indexOf("slow")).toBeLessThan(paces.indexOf("fast"));
	expect(feed(steady(16, 2 + 6 * 29))).not.toContain("fast");
});

test("the tier goes down and up again, never finer than its start", () => {
	const step = stepper(3, 0);
	expect([step("fast"), step("slow"), step("slow"), step("slow"), step("fast"), step("fast"), step("fast")]).toEqual([null, 1, 2, null, 1, 0, null]);
	const software = stepper(3, 2);
	expect([software("fast"), software("slow")]).toEqual([null, null]);
});

// A tier that skips images is left within two seconds, and found again three seconds later: at three rises, the town
// changed its sharpness seven times in its first seventeen seconds.
test("after one rise, the next fall is kept", () => {
	const step = stepper(3, 0);
	expect([step("slow"), step("fast")]).toEqual([1, 0]);
	expect([step("slow"), step("fast"), step("slow")]).toEqual([1, null, null]);
});

// Only the samples change, not the pixel ratio: the town's target must be released as a resize releases it, or WebGL 2
// draws on into the old buffers and the screen stays 98 % empty (13/11).
test("a drawing that only changes the samples releases the town's target", async () => {
	expect(await releasedBy({})).toEqual({ ratios: [1, 1], released: 1 });
});

// On WebGPU the depth of a multisampled target is a multisampled image, and the programs that read it are prepared for
// that kind: a phone that fell to the lowest tier (no samples) had every frame refused, and showed its signs over an
// empty town (13/11). There the town keeps the samples it started with: its target is neither changed nor released.
test("on WebGPU a town asked for other samples keeps the ones it started with", async () => {
	expect(await releasedBy({ isWebGPUBackend: true })).toEqual({ ratios: [1, 1], released: 0 });
});

// How many times the town's target is released when the drawing loses its samples, on a renderer of this backend.
async function releasedBy(backend: object): Promise<{ ratios: number[]; released: number }> {
	await import("../test-page");
	const { pipeline } = await import("./pipeline");
	const { THREE } = await import("./nodes");
	let released = 0;
	// The method is kept to be called on its own target (`call` below).
	// oxlint-disable-next-line typescript/unbound-method
	const dispose = THREE.RenderTarget.prototype.dispose;
	THREE.RenderTarget.prototype.dispose = function (this: InstanceType<typeof THREE.RenderTarget>) {
		released++;
		dispose.call(this);
	};
	try {
		const renderer = { backend, getPixelRatio: () => whole.ratio } as unknown as InstanceType<typeof THREE.WebGPURenderer>;
		const scene = new THREE.Scene();
		const { use } = pipeline(renderer, {
			scene,
			dust: scene,
			camera: new THREE.OrthographicCamera(),
			glow: undefined,
			clear: false,
			night: false,
			start: whole,
		});
		use(bare);
	} finally {
		THREE.RenderTarget.prototype.dispose = dispose;
	}
	return { ratios: [whole.ratio, bare.ratio], released };
}
