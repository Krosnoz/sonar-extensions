// How many pixels the town draws, by what the machine can bear. The town is drawn with all that makes it what it is
// (shadows, multisampling, the night's glow and its mask, the rim's tone, smoothed edges, a pixel of its own at least for
// each of the screen's) or not at all: a phone that held it only without them showed a town coarse and flat, and it was
// refused (13/11). A machine that does not hold the lowest tier is not offered the town (./offered.ts).
// The drawing starts at the tier a short probe chose (./probe.ts); if the frames come slowly, it steps down.
// `mask`: the glow kept off what stands in front of its light (./glow-mask.ts); `tone`: the night's rim toned against its
// ground (./outline.ts); `glow`: the night's glow; `smooth`: the edges smoothed (FXAA).
export type Tier = { ratio: number; samples: number; shadows: boolean; mask: boolean; tone: boolean; glow: boolean; smooth: boolean };

// `full`: the ratio the town is drawn at, finer than the screen's on a screen of low density (./kit.ts); `density`: the
// screen's. Half of `full` is a tier only where it is still a pixel for each of the screen's.
export const tiersFor = (full: number, density: number): Tier[] => {
	const all = { samples: 4, shadows: true, mask: true, tone: true, glow: true, smooth: true };
	return [{ ratio: full, ...all }, ...(full / 2 >= density ? [{ ratio: full / 2, ...all }] : [])];
};

// A graphics card's name that draws on the processor: SwiftShader, llvmpipe, Microsoft's basic renderer.
export const softwareName = (name: string): boolean => /swiftshader|llvmpipe|softpipe|software|basic render/i.test(name);
export function software(renderer: { backend: object }): boolean {
	const gl = (renderer.backend as { gl?: WebGL2RenderingContext }).gl;
	const info = gl?.getExtension("WEBGL_debug_renderer_info");
	return softwareName(gl && info ? String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL)) : "");
}

// A frame slower than this (about 20 images a second) is a slow one.
const SLOW = 50;
// The first frames prepare programs and buffers: they say nothing of the machine. After a step down, the frames that
// follow rebuild the targets.
const WARM = 2;
const WINDOW = 6;
// A window of two frames that already last this long (milliseconds) is judged at once: at a few images a second, six
// frames would be the first seconds of the arrival.
const ENOUGH = 1000;

// A frame faster than this (50 images a second) leaves room for a finer tier.
const FAST = 20;
// Windows in a row that must all be fast before the drawing steps up again: about 3 s at 60 images a second.
const RISE = 30;
// Times the drawing may step up then fall again before it keeps its tier, as drei's PerformanceMonitor does (flipflops):
// a machine just at the edge would otherwise switch every few seconds. One: a tier that skips images is left within
// two seconds and found again three seconds later, and at three the town changed its sharpness seven times in its first
// seventeen seconds.
const FLIPS = 1;
// Windows in a row judged together for an uneven pace: about a second at 60 images a second. One window is not judged
// alone: a burst of the page's work lasts a tenth of a second.
const SPAN = 10;
// Over a span, frames this long on average, each window's slowest aside: the town skips images one after the other
// (at 60 images a second, more than one in three, or some for several frames). The median does not see it: on a screen
// 2 560 px wide, by night, the finest tier drew 36 images a second, frames of 17 ms among frames of 50 to 67, and its
// median stayed 16.7 ms (14/11). An image skipped now and then is not judged: one in five by day on that screen.
const UNEVEN = 20;

export type Pace = "slow" | "fast" | null;

// Fed with the time between two frames; says "slow" when the last frames are slow or skip images one after the other,
// "fast" after a long run of fast ones. Judged on their median, not their mean: one frame the page stalled (a long
// task, a tab shown again after minutes) says nothing of the machine.
export function paceMeter(): (frame: number) => Pace {
	let [skip, fast] = [WARM, 0];
	let frames: number[] = [];
	let span: number[] = [];
	const lowered = (): Pace => {
		[skip, fast, span] = [2, 0, []];
		return "slow";
	};
	return (frame) => {
		if (skip > 0) {
			skip--;
			return null;
		}
		frames.push(frame);
		const total = frames.reduce((sum, each) => sum + each, 0);
		if (frames.length < WINDOW && !(frames.length >= 2 && total >= ENOUGH)) return null;
		const sorted = frames.toSorted((a, b) => a - b);
		const median = sorted[Math.floor((sorted.length - 1) / 2)]!;
		span.push((total - sorted.at(-1)!) / (sorted.length - 1));
		frames = [];
		if (median > SLOW) return lowered();
		if (span.length === SPAN) {
			const mean = span.reduce((sum, each) => sum + each, 0) / SPAN;
			span = [];
			if (mean > UNEVEN) return lowered();
		}
		fast = median < FAST ? fast + 1 : 0;
		if (fast < RISE) return null;
		[skip, fast] = [2, 0];
		return "fast";
	};
}

// The tier to draw at next, from `count` tiers and the one the town started at: one down on slow frames, one up again
// on fast ones (a load that passed: another tab's work, the programs prepared at the arrival), never finer than
// `floor`: the start, or a finer tier the probe found near its budget (./probe.ts). After FLIPS rises, the next fall is
// kept.
export function stepper(count: number, start: number, floor = start): (pace: Pace) => number | null {
	let [level, rises, settled] = [start, 0, false];
	return (pace) => {
		if (settled || pace === null) return null;
		if (pace === "slow") {
			if (level >= count - 1) return null;
			settled = rises >= FLIPS;
			return ++level;
		}
		if (level <= floor) return null;
		rises++;
		return --level;
	};
}
