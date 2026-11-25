// The town's first frame, hidden, prepares the programs `compileAsync` leaves out (the sun's shadow, the night's glow)
// on the side: a program made in a frame of the probe froze the page for a second or more (13/11).

import { expect, test } from "bun:test";
import { warmed } from "./warm";
import type { THREE } from "./nodes";

// A renderer whose frame asks a pipeline for each of `objects`; `made` says how each was made.
function card(objects: string[]) {
	const made = new Map<string, "aside" | "in the frame">();
	const pipelines = {
		getForRender(object: string, promises: Promise<void>[] | null = null) {
			if (made.has(object)) return;
			if (promises === null) return void made.set(object, "in the frame");
			promises.push(Promise.resolve().then(() => void made.set(object, "aside")));
		},
		updateForRender(object: string) {
			this.getForRender(object);
		},
	};
	const renderer = { backend: { isWebGPUBackend: true }, _pipelines: pipelines } as unknown as THREE.WebGPURenderer;
	const draw = (): void => objects.forEach((object) => pipelines.updateForRender(object));
	return { renderer, draw, made, pipelines };
}

test("the first frame's programs are made aside, and the next frame makes none", async () => {
	const { renderer, draw, made, pipelines } = card(["town", "shadow", "glow"]);
	// The method is only compared, never called: the warming must put the same one back.
	// oxlint-disable-next-line typescript/unbound-method
	const own = pipelines.updateForRender;
	await warmed(renderer, draw);
	expect([...made.values()]).toEqual(["aside", "aside", "aside"]);
	// The frames after it draw as before.
	// oxlint-disable-next-line typescript/unbound-method
	expect(pipelines.updateForRender).toBe(own);
	draw();
	expect([...made.values()]).not.toContain("in the frame");
});

test("a pass the first frame did not reach is made aside at the next", async () => {
	const objects = ["town"];
	const { renderer, made, pipelines } = card(objects);
	let frames = 0;
	// The glow's passes show once the town is drawn.
	const draw = (): void => {
		if (++frames === 2) objects.push("glow");
		objects.forEach((object) => pipelines.updateForRender(object));
	};
	await warmed(renderer, draw);
	expect(Object.fromEntries(made)).toEqual({ town: "aside", glow: "aside" });
});

test("WebGL 2 draws its first frame as before", async () => {
	const { renderer, draw, made } = card(["town"]);
	(renderer as unknown as { backend: object }).backend = {};
	await warmed(renderer, draw);
	expect(made.size).toBe(0);
});
