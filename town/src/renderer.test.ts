// An inhabitant behind a wall shows as a light fill with a line round it (./see-through.ts), drawn once a pixel through
// the stencil. In Edge, on WebGPU, it showed as a flat of its state's colour: no program tested the stencil (14/11).

import { expect, test } from "bun:test";
import { rendererOptions } from "./renderer-options";

test("the renderer keeps a stencil, which three.js gives the programs it prepares ahead", () => {
	expect(rendererOptions(false).stencil).toBe(true);
	expect(rendererOptions(true, undefined).alpha).toBe(true);
});
