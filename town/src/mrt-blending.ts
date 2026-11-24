// three.js's WebGL 2 backend sets the blending of each target of a pass with several targets (the town's pass writes its
// colour and its normals) before every draw (WebGLState#setMRTBlending), and then forgets the blending it had set. With
// blending off, as for every opaque part, those settings change nothing that is drawn: three.js turns blending on and
// off for all the targets at once (`gl.enable(gl.BLEND)`), never per target. Skipped then, they were a tenth of a
// frame's script, and three.js no longer sets its own blending again at the next draw.
type State = {
	currentBlendingEnabled: boolean;
	setMRTBlending: (textures: unknown, mrt: unknown, material: unknown) => void;
};

export function lighterBlending(backend: object): void {
	const state = (backend as { state?: Partial<State> }).state;
	const set = state?.setMRTBlending;
	if (!state || !set) return;
	// Called by three.js after the material's own blending is set (WebGLBackend#draw, WebGLState#setMaterial).
	state.setMRTBlending = (textures, mrt, material) => {
		if (state.currentBlendingEnabled) set.call(state, textures, mrt, material);
	};
}
