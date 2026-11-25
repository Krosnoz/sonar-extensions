// Where the night's glow may not fall: on a surface that stands in front of the light it would carry. The glow is the
// bright pixels blurred over the screen, whatever their depth, so a lamp's head just behind a roof spilled 3 to 4 pixels
// of its light over the roof's edge, as if the lamp stood in front of it.
import { float, Fn, If, luminance, max, screenSize, screenUV, step, vec2 } from "three/tsl";
import type { Node, THREE, Vec4 } from "./nodes";

// How far around a pixel its glow's sources are looked for, in pixels, and in how many directions: the glow at night
// reaches about 5 pixels before it fades out.
const RINGS = [1.5, 3, 5];
const DIRECTIONS = 8;
// How much farther (in the depth buffer's 0 to 1) a light must be to stand behind the pixel: a lamp's head and the post
// under it, or a window and its wall, are at one depth.
const BEHIND = 0.001;
// A glow fainter than this changes no pixel: a 15th of the step of 8 bits at the darkest colour, after the conversion to
// sRGB (12.92 times steeper there).
const FAINT = 1 / 65536;

// The share of the glow a pixel keeps: 1 off any light, 0 where every bright pixel round it lies behind it.
// Read only where there is a glow to keep, and while `on` (the tier, ./quality.ts): the 49 reads of each pixel were
// paid over the whole screen. A light's depth is read only for a bright pixel. In a branch, each texture is read at its
// one level: a shader may not guess a level where neighbouring pixels may take the other way.
export function glowKept(colour: THREE.TextureNode, depth: THREE.TextureNode, threshold: number, halo: Vec4, on: Node): Node {
	return Fn(() => {
		const kept = float(1).toVar();
		If(
			max(halo.r, max(halo.g, halo.b))
				.greaterThan(float(FAINT))
				.and(on.greaterThan(float(0))),
			() => {
				const top = float(0);
				const here = depth.sample(screenUV).level(top).r.toConst();
				const behind = float(0).toVar();
				const lights = float(0).toVar();
				for (const ring of RINGS)
					for (let k = 0; k < DIRECTIONS; k++) {
						const angle = (k * 2 * Math.PI) / DIRECTIONS;
						const at = screenUV.add(vec2(Math.cos(angle) * ring, Math.sin(angle) * ring).div(screenSize));
						If(luminance(colour.sample(at).level(top).rgb).greaterThanEqual(float(threshold)), () => {
							lights.addAssign(1);
							behind.addAssign(step(BEHIND, depth.sample(at).level(top).r.sub(here)));
						});
					}
				kept.assign(float(1).sub(behind.div(lights.max(1))));
			},
		);
		return kept;
	})();
}
