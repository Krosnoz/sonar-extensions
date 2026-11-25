// The lit windows of a facade seen from afar, by night. A pane is a few tenths of a metre: from the whole town's view it
// is a pixel or two, and an amber pane beside a dark wall or frame lit a pixel one frame and not the next as the town
// turned (on the phone, 1 600 blinking pixels a frame, nearly all of them the windows of the towers and the houses).
// As a painter does from afar, the pane and the wall round it melt into their mean: the panes dim towards the share of
// light of the whole facade, and the wall takes part of that light. Near, nothing changes.
import { abs, cameraViewMatrix, clamp, float, fwidth, length, max, mix, normalWorld, positionView, smoothstep, step, vec3, vec4 } from "three/tsl";
import type { Node, Vec4 } from "../render/nodes";

// A typical pane's width (the houses' 0.34 to 0.5, the towers' 0.42): the blend starts when it is 4 pixels wide and is
// whole at 2.
const PANE = 0.42;
// How much of the blend is done at most: the rest keeps the pattern of lit and dark windows that reads as a town by
// night. At 0.75 the houses lost their lit windows under a beige veil; at 0.5 the blinking pixels of the whole town's
// view on the phone fell from about 1 700 to about 900 a frame.
const MOST = 0.5;
// The share of a facade that is glass, its frames and walls between: the mean light of a bay is the panes' times it.
const GLASS = 0.3;
// How much of that mean the wall takes: half keeps the facades warm without the veil.
const WALL = 0.5;

// How many metres of a face one pixel of the screen covers: `wide` along the face, across its width, `tall` up an upright
// face. The camera is orthographic: a pixel is the same length of the view's plane anywhere on the screen (`pixel`), but
// a face seen aslant crowds more of its width into it. Measured on the view's plane alone, a mullion or a pane's edge of
// "1.5 pixels" was one pixel or less on a face turned 45° from the camera, and blinked as the town turned. The face's
// direction comes from its normal (a window's frames carry their wall's: ../render/shapes.ts#flat), so all the faces of a
// detail agree. A face lying flat (the ground, a roof's top) keeps the view's pixel.
export function facePixel(): { pixel: Node; wide: Node; tall: Node } {
	const pixel = fwidth(positionView.x);
	const flatness = length(normalWorld.xz);
	const along = vec3(normalWorld.z.negate(), 0, normalWorld.x).div(max(flatness, 0.001));
	// How much of a metre along the face, and up it, shows on the screen's width and height.
	const across = abs(cameraViewMatrix.mul(vec4(along, 0)).x);
	const up = abs(cameraViewMatrix.mul(vec4(0, 1, 0, 0)).y);
	const sideways = step(0.3, flatness);
	const upright = step(abs(normalWorld.y), 0.5);
	return { pixel, wide: mix(pixel, pixel.div(max(across, 0.05)), sideways), tall: mix(pixel, pixel.div(max(up, 0.05)), upright) };
}

// `night` the light of a pane as the shader gives it (../render/part-material.ts#emissive): how much of it gives way to the facade's mean
// from afar, and the facade's mean. A window is lit by night from its phase 0.8 (35 % of them, at 0.9), and the others,
// whose phases run from 0.6 to 0.78, at 1.05 once the share at work (`data.w`) passes their phase. The blend follows the
// pane's width on the screen along its facade: a face seen aslant blends sooner than one seen square.
export function farPanes(data: Vec4): { far: Node; mean: Node; wall: Node } {
	const far = smoothstep(0.25, 0.5, facePixel().wide.div(PANE)).mul(MOST);
	const lit = float(0.35 * 0.9).add(clamp(data.w.sub(0.6).div(0.18), 0, 1).mul(0.65 * 1.05));
	return { far, mean: lit.mul(GLASS), wall: float(WALL) };
}

// A pane's light `own` from afar.
export const paneFrom = (own: Node, panes: { far: Node; mean: Node }): Node => mix(own, panes.mean, panes.far);
