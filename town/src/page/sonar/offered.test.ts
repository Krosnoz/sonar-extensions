// Where the town is offered: on a computer whose card draws it whole, and nowhere else. A phone drew it at 2 images a
// second, then fluid with its passes off and a pixel for 4 on each side: ugly, and refused (13/11).

import { expect, test } from "bun:test";
import { offered } from "./offered";

type Card = { fallback?: boolean; name?: string };
type Machine = { touch?: boolean; gpu?: Card; gl?: Card; kept?: Record<string, string> };

// The answer on the page of a machine: whether a finger is its main pointer (`touch`), its card as WebGPU says it
// (`gpu`), as WebGL 2 says it (`gl`), and what the page kept. Every card says it has the computers' texture
// compressions, as a phone's did (below). The page is put back after: these tests share their process with the others.
async function offeredOn({ touch = false, gpu, gl, kept = {} }: Machine): Promise<boolean> {
	const page = globalThis as Record<string, unknown>;
	const names = ["localStorage", "navigator", "document", "matchMedia"];
	const before = names.map((name) => Object.getOwnPropertyDescriptor(page, name));
	const set = (name: string, value: unknown): unknown => Object.defineProperty(page, name, { value, configurable: true, writable: true });
	const adapter = gpu && { features: { has: () => true }, info: { isFallbackAdapter: gpu.fallback ?? false } };
	const extensions: Record<string, unknown> = {
		WEBGL_debug_renderer_info: { UNMASKED_RENDERER_WEBGL: 1 },
		WEBGL_compressed_texture_s3tc: {},
		WEBGL_lose_context: { loseContext: () => {} },
	};
	const context = gl && { getExtension: (name: string) => extensions[name] ?? null, getParameter: () => gl.name ?? "" };
	set("localStorage", { getItem: (key: string) => kept[key] ?? null });
	set("navigator", adapter ? { gpu: { requestAdapter: () => Promise.resolve(adapter) } } : {});
	set("document", { createElement: () => ({ getContext: () => context ?? null }) });
	set("matchMedia", (query: string) => ({ matches: touch && query === "(pointer: coarse)" }));
	try {
		return await offered();
	} finally {
		names.forEach((name, at) => (before[at] ? Object.defineProperty(page, name, before[at]) : delete page[name]));
	}
}

const COMPUTER = "ANGLE (NVIDIA, NVIDIA GeForce RTX 3070 Direct3D11 vs_5_0 ps_5_0, D3D11)";
const PHONE = "ANGLE (Qualcomm, Adreno (TM) 619, OpenGL ES 3.2)";

test("a computer's card is offered the town, on WebGPU and on WebGL 2", async () => {
	expect(await offeredOn({ gpu: {}, gl: { name: COMPUTER } })).toBe(true);
	expect(await offeredOn({ gl: { name: COMPUTER } })).toBe(true);
});

// The phone's card said it had the computers' texture compression, was offered the town, and drew an image in 406 ms:
// its user touched the icon to be told it does not work (13/11). What a card says of itself does not tell a phone.
test("a phone or a tablet is not offered the town, whatever its card says", async () => {
	expect(await offeredOn({ touch: true, gpu: {}, gl: { name: PHONE } })).toBe(false);
	expect(await offeredOn({ touch: true, gl: { name: PHONE } })).toBe(false);
	expect(await offeredOn({ touch: true, gpu: {}, gl: { name: COMPUTER } })).toBe(false);
});

test("a machine that draws on its processor is not offered the town", async () => {
	expect(await offeredOn({ gpu: { fallback: true } })).toBe(false);
	expect(await offeredOn({ gl: { name: "ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero)), SwiftShader driver)" } })).toBe(false);
	expect(await offeredOn({})).toBe(false);
});

// A card at another work the day of the try is not a card too weak: the town is offered again the day after.
test("a computer whose card did not hold the town is not offered it again that day", async () => {
	const hours = (count: number): string => String(Date.now() - count * 3600 * 1000);
	expect(await offeredOn({ gpu: {}, kept: { "sonar:town-unheld": hours(1) } })).toBe(false);
	expect(await offeredOn({ gpu: {}, kept: { "sonar:town-unheld": hours(25) } })).toBe(true);
});

test("a drawing asked for by hand is offered whatever the machine", async () => {
	expect(await offeredOn({ touch: true, gl: { name: PHONE }, kept: { "sonar:town-draw": "{}" } })).toBe(true);
});
