// The town's renderer: made over the host, at the drawing's density, and fitted to the host's size (./kit.ts#mount).
import type { World } from "./kit";
import { lighterBlending } from "./mrt-blending";
import { THREE } from "./nodes";
import { rendererOptions } from "./renderer-options";
import { controlsOver, topOf } from "./size";

// `canvas`: the one a lost drawing had, so that the gestures and the page's order stay as they were.
export async function rendererFor(host: HTMLElement, clear: boolean, canvas?: HTMLCanvasElement): Promise<THREE.WebGPURenderer> {
	const renderer = new THREE.WebGPURenderer(rendererOptions(clear, canvas));
	if (clear) renderer.setClearColor(0x000000, 0);
	await renderer.init();
	lighterBlending(renderer.backend);
	// Drawn at a density of 2 on every screen. On a screen of density 1 or 1.5, the browser shrinks the
	// drawing: each pixel of the screen averages several of the drawing's, so edges are smooth and steady when the town
	// moves. On a phone of density 3, 2 draws 2.25 times fewer pixels for a difference the eye barely sees.
	// The drawing has a whole number of pixels per pixel of the screen (2.5 on a density of 1.25, 3 on 1.5): a ratio that
	// is not whole smears each edge across the screen's pixels, differently as the town moves.
	renderer.setPixelRatio(Math.min(3, Math.ceil(2 / devicePixelRatio) * devicePixelRatio));
	renderer.toneMapping = THREE.NeutralToneMapping;
	renderer.shadowMap.enabled = true;
	if (canvas) return renderer;
	host.append(renderer.domElement);
	Object.assign(renderer.domElement.style, { position: "absolute", inset: "0", width: "100%", height: "100%", touchAction: "none" });
	return renderer;
}

// The drawing takes the host's size, now and at each change.
export function fitted(host: HTMLElement, renderer: () => THREE.WebGPURenderer, world: World): ResizeObserver {
	const fit = (): void => {
		renderer().setSize(host.clientWidth, host.clientHeight, false);
		world.frame(host.clientWidth, host.clientHeight, topOf(host), controlsOver(host));
	};
	fit();
	const resized = new ResizeObserver(fit);
	resized.observe(host);
	return resized;
}
