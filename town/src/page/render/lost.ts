// What makes the town's drawing start again at a lower tier: its context lost (the browser takes the graphics card back,
// short of memory), a buffer refused (out of memory) or a target that cannot be drawn into. Without it, a phone showed
// the signs over a blank screen, and nothing came back (13/11).
import type { THREE } from "./nodes";

// GL_OUT_OF_MEMORY, GL_INVALID_FRAMEBUFFER_OPERATION.
const REFUSED = new Set([0x0505, 0x0506]);
// How long the browser may take to give a lost context back.
const RESTORE = 3000;

// The WebGL 2 backend's context, which three.js does not type; none on WebGPU.
const isContext = (value: unknown): value is WebGL2RenderingContext =>
	typeof value === "object" && value !== null && "isContextLost" in value && "getError" in value;
function contextOf(renderer: THREE.WebGPURenderer): WebGL2RenderingContext | undefined {
	const { backend } = renderer;
	return "gl" in backend && isContext(backend.gl) ? backend.gl : undefined;
}

// Whether the card refused what the last frames asked: read once after a change of tier, as reading it stalls the page.
export function refused(renderer: THREE.WebGPURenderer): boolean {
	const gl = contextOf(renderer);
	return gl ? gl.isContextLost() || REFUSED.has(gl.getError()) : false;
}

// Whether a lost context comes back: the browser gives it back after three.js called `preventDefault`. WebGPU has no
// such event: a new device is asked for at once.
export function restored(renderer: THREE.WebGPURenderer): Promise<boolean> {
	const gl = contextOf(renderer);
	if (!gl) return Promise.resolve(true);
	if (!gl.isContextLost()) return Promise.resolve(true);
	const canvas = renderer.domElement;
	return new Promise((done) => {
		const back = (): void => {
			clearTimeout(late);
			done(true);
		};
		const late = setTimeout(() => {
			canvas.removeEventListener("webglcontextrestored", back);
			done(false);
		}, RESTORE);
		canvas.addEventListener("webglcontextrestored", back, { once: true });
	});
}
