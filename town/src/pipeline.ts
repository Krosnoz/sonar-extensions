// How a frame of the town is drawn. The scene is drawn at the drawing's density (./renderer.ts), and its edges are drawn
// from the depth and the normals as an illustration's ink (./outline.ts). Nothing is computed at the screen's resolution
// over it but the smoothing of its edges and the glow of the night: no ambient occlusion.
import { convertToTexture, dot, Fn, fract, If, max, screenCoordinate, sin, uniform, vec2, vec4 } from "three/tsl";
import { bloom } from "three/addons/tsl/display/BloomNode.js";
import { fxaa } from "three/addons/tsl/display/FXAANode.js";
import { glowKept } from "./glow-mask";
import { THREE, typed, type Vec4 } from "./nodes";
import { OutlinePassNode } from "./outline";
import type { Tier } from "./quality";
import { drawingRatio } from "./see-through";

// The image copied into a target of the screen's size, for FXAA, which reads its neighbours: without a depth buffer,
// which three.js gives it by default and nothing reads (7 MB on a phone, 20 MB on a computer).
const copy = (image: Vec4): THREE.TextureNode => convertToTexture(image, null, null, { depthBuffer: false });

// The outline is drawn a CSS pixel and a half wide, as an illustration's ink, whatever the screen's density.
const reachAt = (ratio: number): number => Math.round(1.5 * ratio);

type Drawn = {
	scene: THREE.Scene;
	dust: THREE.Scene;
	camera: THREE.Camera;
	glow: [number, number] | undefined;
	clear: boolean;
	night: boolean;
	// 1 while a figure is born or goes in layers (./layer-grains.ts).
	sparks: THREE.UniformNode<"float">;
	// The quality it starts at (./quality.ts).
	start: Tier;
};

// The passes a tier keeps (./quality.ts), switched without preparing a program again.
type Switches = { masked: THREE.UniformNode<"float">; glowing: THREE.UniformNode<"float">; smoothing: THREE.UniformNode<"float"> };

type Released = { deallocateRenderBuffers: (target: THREE.RenderTarget) => void };
const isReleased = (utils: unknown): utils is Released =>
	typeof utils === "object" && utils !== null && "deallocateRenderBuffers" in utils && typeof utils.deallocateRenderBuffers === "function";

// three.js r187's WebGL 2 backend forgets a multisampled target's own buffers when the target is released (a resize, a
// tier): they stayed allocated, 143 MB on a phone at each change, and a phone stepping down held both tiers' (13/11).
// Released here first, while the backend still knows them.
function releasing(renderer: THREE.WebGPURenderer, town: OutlinePassNode): void {
	const utils: unknown = "textureUtils" in renderer.backend ? renderer.backend.textureUtils : undefined;
	if (isReleased(utils)) town.renderTarget.addEventListener("dispose", () => utils.deallocateRenderBuffers(town.renderTarget));
}

// The town's own pass, with its ink.
function townPass(renderer: THREE.WebGPURenderer, { scene, camera, start }: Drawn): OutlinePassNode {
	const town = new OutlinePassNode(scene, camera, reachAt(renderer.getPixelRatio()));
	// The pass makes its normals' and depth's textures when it is first drawn: asked now, its drawing programs are
	// prepared for the same targets as the frames'.
	for (const name of ["depth", "normal"]) town.getTextureNode(name);
	releasing(renderer, town);
	// The scene is drawn with 4 samples per pixel (the renderer's own smoothing is off, and the pass would take its 0): a
	// window's frame or a mullion about a pixel wide, seen aslant, then keeps a steady colour as the camera turns, instead of
	// showing in one frame and vanishing in the next (about 60 % fewer blinking pixels).
	town.options.samples = start.samples;
	town.toned.value = start.tone ? 1 : 0;
	drawingRatio.value = start.ratio;
	return town;
}

// The cubes of the page are drawn apart, over the town: the edges of the town's pass would outline each small cube in
// dark, and turn the page's colours into grey rubble.
function withCubes(image: Vec4, { dust, camera }: Drawn, passes: THREE.PassNode[]): Vec4 {
	const specks = new THREE.PassNode(THREE.PassNode.COLOR, dust, camera, { minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter });
	const cubes = specks.getTextureNode("output");
	passes.push(specks);
	// The pass's colours are already multiplied by their opacity: mixed by it again, a soft spark darkened the town.
	return vec4(image.rgb.mul(cubes.a.oneMinus()).add(cubes.rgb), max(image.a, cubes.a));
}

// The glow by day, its strength and its threshold: nothing the sun lights is that bright, only a figure born or going
// in layers (./layers.ts) and its sparks.
const DAY: [number, number] = [0.6, 1.5];

// The glow of the night, and by day of a figure born or going. Its light is its opacity too: over the page, a glow is a
// halo, not a black screen. None of it falls on what stands in front of its light (./glow-mask.ts).
function withGlow(image: Vec4, town: OutlinePassNode, { glow, night, sparks }: Drawn, { masked, glowing }: Switches): Vec4 {
	const [strength, threshold] = night ? (glow ?? [0.6, 1]) : DAY;
	const bloomed = bloom(image, strength, 0.5, threshold);
	const lit = (): boolean => glowing.value > 0 && (night || sparks.value > 0);
	// Off, its passes are not drawn at all, and what they last drew is not added. By day they are drawn with the first
	// frame too, which prepares their programs: prepared at a figure's first spark, they would freeze its frame.
	const render = bloomed.updateBefore.bind(bloomed);
	let primed = night;
	bloomed.updateBefore = (frame) => {
		if (primed && !lit()) return undefined;
		primed = true;
		return render(frame);
	};
	const raw = typed(bloomed, "vec4").mul(night ? glowing : glowing.mul(sparks));
	const halo = raw.mul(glowKept(town.getTextureNode("output"), town.getTextureNode("depth"), threshold, raw, masked));
	return vec4(image.rgb.add(halo.rgb), max(image.a, max(halo.r, max(halo.g, halo.b))));
}

// The edges of the shapes and of the ink smoothed, as an illustration's, instead of stairs. Off, the image is read as it
// is, without FXAA's 9 to 30 reads a pixel.
function smoothed(image: Vec4, { smoothing }: Switches): Vec4 {
	const copied = copy(image);
	const fxaaed = typed(fxaa(copied), "vec4");
	const chosen = Fn(() => {
		const out = vec4(0).toVar();
		If(smoothing.greaterThan(0), () => void out.assign(fxaaed)).Else(() => void out.assign(copied));
		return out;
	});
	return typed(chosen(), "vec4");
}

// A 255th of noise, fixed on the screen, before the colours are written in 8 bits: a slow gradient (the sky's light on a
// wall, a pool of light) shows as bands otherwise. It is scaled to the step the conversion to sRGB makes at this colour,
// so a dark colour gets no more noise than a light one.
function dithered(image: Vec4): Vec4 {
	const noise = fract(sin(dot(screenCoordinate, vec2(12.9898, 78.233))).mul(43758.5453)).sub(0.5);
	const step = image.rgb
		.max(0.0003)
		.pow(1 - 1 / 2.2)
		.mul(2.2 / 255);
	return vec4(image.rgb.add(noise.mul(step)), image.a);
}

// Another tier, while the town is drawn: the samples of the target, the ink's reach in the new pixels, the passes.
// WebGPU: the depth of a multisampled target is a multisampled image, and the programs that read it (the ink, the
// glow's mask) are prepared for that kind. With another sample count, every frame was refused ("Sample count (1) of
// [Texture depth] doesn't match expectation") and the town stayed empty: a phone that fell to the lowest tier showed
// its signs over nothing (13/11). There the samples the town started with are kept; WebGL 2 reads a resolved depth.
function user(renderer: THREE.WebGPURenderer, town: OutlinePassNode, start: Tier, { masked, glowing, smoothing }: Switches): (tier: Tier) => void {
	const fixed = "isWebGPUBackend" in renderer.backend;
	return ({ ratio, samples: asked, ...tier }) => {
		const samples = fixed ? start.samples : asked;
		[masked.value, glowing.value, smoothing.value] = [tier.mask ? 1 : 0, tier.glow ? 1 : 0, tier.smooth ? 1 : 0];
		town.toned.value = tier.tone ? 1 : 0;
		// Released as a resize releases it (RenderTarget#setSize): WebGL 2 kept drawing into the old multisampled buffers
		// when only the samples changed, the pixel ratio the same, and the screen stayed 98 % empty (13/11).
		if (town.options.samples !== samples) town.renderTarget.dispose();
		town.options.samples = samples;
		town.renderTarget.samples = samples;
		town.reach.value = reachAt(ratio);
		drawingRatio.value = ratio;
	};
}

// `compile`: prepares the passes' drawing programs without blocking the page. Prepared by the first frame instead, they
// froze the page for seconds after the click.
export function pipeline(
	renderer: THREE.WebGPURenderer,
	drawn: Drawn,
): { drawn: THREE.RenderPipeline; compile: () => Promise<void>; use: (tier: Tier) => void } {
	const { clear, start } = drawn;
	const piped = new THREE.RenderPipeline(renderer);
	const town = townPass(renderer, drawn);
	const passes: THREE.PassNode[] = [town];
	const switches: Switches = { masked: uniform(start.mask ? 1 : 0), glowing: uniform(start.glow ? 1 : 0), smoothing: uniform(start.smooth ? 1 : 0) };
	let image: Vec4 = town;
	if (clear) image = withCubes(image, drawn, passes);
	image = withGlow(image, town, drawn, switches);
	piped.outputNode = dithered(smoothed(image, switches));
	// One pass after the other: each sets the renderer's target while it prepares.
	const compile = (): Promise<void> => passes.reduce((before, each) => before.then(() => each.compileAsync(renderer)), Promise.resolve());
	return { drawn: piped, compile, use: user(renderer, town, start, switches) };
}
