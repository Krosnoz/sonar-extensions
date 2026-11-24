// What the town's renderer is made with (./renderer.ts).

// `stencil`: the town's pass draws into a target that has one (./outline.ts), which the silhouettes behind a wall test
// (./see-through.ts). three.js r187 prepares a pass's programs ahead with the renderer's own stencil, not the target's
// (Renderer#compileAsync): without it no program tested the stencil on WebGPU, and a silhouette's line covered its fill
// as a flat of its state's colour (14/11).
export const rendererOptions = (clear: boolean, canvas?: HTMLCanvasElement) =>
	({ canvas, antialias: false, alpha: clear, stencil: true, powerPreference: "high-performance" }) as const;
