// Whether the town is offered on this machine: its icon shows only where the town can be drawn whole (../render/quality.ts).
// Read without three.js, which loads at the first touch of the icon only (./toggle.ts).
// - A phone or a tablet is not offered it: one drew 2 images a second with the whole drawing, 24 with every pass off
//   and half the pixels (13/11). It is told by its main pointer, a finger. Not by its card: that phone's card said it
//   had the computers' texture compression, was offered the town, and its user touched the icon to be told no.
// - Nor a machine that draws on its processor.
// - A computer is offered it, and tried at the first touch (../render/probe.ts): one that does not hold the town says so once
//   (`Unheld`), and the page remembers it for a day: the card was perhaps at another work, which a try on another day
//   tells from a card too weak.
// Elsewhere: PlayCanvas and Babylon.js lower their drawing from the platform's name; this reads the pointer, which a
// browser that asks for the computer's page keeps.
import { softwareName } from "../render/quality";

// When the town was not held, in milliseconds.
const KEY = "sonar:town-unheld";
const DAY = 24 * 3600 * 1000;

// The town tried, and not held at its lowest tier.
export class Unheld extends Error {
	override name = "Unheld";
}
export const remembered = (): void => localStorage.setItem(KEY, String(Date.now()));

type Adapter = { info?: { isFallbackAdapter?: boolean }; isFallbackAdapter?: boolean };

export async function offered(): Promise<boolean> {
	// The page tests, whose browser draws on the processor: a drawing asked for is drawn whatever the machine.
	if (localStorage.getItem("sonar:town-draw") !== null) return true;
	if (matchMedia("(pointer: coarse)").matches) return false;
	if (Date.now() - Number(localStorage.getItem(KEY) ?? 0) < DAY) return false;
	const gpu = (navigator as { gpu?: { requestAdapter: () => Promise<Adapter | null> } }).gpu;
	const adapter = await gpu?.requestAdapter().catch(() => null);
	if (adapter) return !(adapter.info?.isFallbackAdapter ?? adapter.isFallbackAdapter ?? false);
	const gl = document.createElement("canvas").getContext("webgl2");
	if (!gl) return false;
	const info = gl.getExtension("WEBGL_debug_renderer_info");
	const held = !softwareName(info ? String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL)) : "");
	// Its context given back at once: a browser gives a page a few only.
	gl.getExtension("WEBGL_lose_context")?.loseContext();
	return held;
}
