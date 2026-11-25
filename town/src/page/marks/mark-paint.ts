// What a group's mark (./mark-cloud.ts) is made of, drawn on a 2D canvas over the town from the page's design system
// rather than the town's pixels: the status dot (.ui-dot, --dot), the surface's ring, a hairline of ink at the edge,
// the page's font. Only vector shapes: no pixel is drawn by hand.
// Each mark's edge holds two rings, the surface's then the ink's: one of the two parts from the ground whatever it is, a
// light paving by day or a dark roof by night.
import { STATE } from "../people/state-colours";
import { ORDER } from "./mark-share";

// The page's colours and font, read once from its tokens (./far-marks.ts).
export type Palette = { surface: string; ink: string; font: string };
// A group's mark to draw: its counts per state, at `x`, `y` (over the heads).
export type Placed = { counts: number[]; total: number; x: number; y: number };
export type Look = {
	// The least size of a group's cell on the screen, in CSS pixels: under it, its marks would cover one another.
	room: number;
	// The mark's whole box, its ink's line included: the next frame clears it.
	box: (p: Placed, pen: CanvasRenderingContext2D, palette: Palette) => [number, number, number, number];
	draw: (pen: CanvasRenderingContext2D, p: Placed, palette: Palette) => void;
};

export const label = (total: number): string => (total < 1000 ? String(total) : `${(total / 1000).toFixed(total < 10_000 ? 1 : 0)}k`);
// The ink's line at the edge, in CSS pixels: the whole ink 1.5 px wide parts from a lit paving at over 3:1.
const EDGE = 1.5;
export const single = (p: Placed): number => ORDER.find((state) => p.counts[state]! > 0)!;

// The page's font at a size, set only when it changes: setting it parses it. A canvas resized forgets it (`forgetFont`).
let font = "";
export const fontAt = (pen: CanvasRenderingContext2D, size: number, palette: Palette): void => {
	const wanted = `600 ${size}px ${palette.font}`;
	if (wanted !== font) pen.font = font = wanted;
};
export const forgetFont = (): void => void (font = "");

// A disc of `colour` in a ring of `fill`, an ink hairline round it: the status dot, ringed.
export function dot(pen: CanvasRenderingContext2D, x: number, y: number, r: number, ring: number, colour: string, palette: Palette, fill: string): void {
	pen.beginPath();
	pen.arc(x, y, r + ring + EDGE - 0.5, 0, 2 * Math.PI);
	pen.fillStyle = palette.ink;
	pen.fill();
	pen.beginPath();
	pen.arc(x, y, r + ring - 0.5, 0, 2 * Math.PI);
	pen.fillStyle = fill;
	pen.fill();
	pen.beginPath();
	pen.arc(x, y, r, 0, 2 * Math.PI);
	pen.fillStyle = colour;
	pen.fill();
}

// The centred count, in the ink.
export function count(pen: CanvasRenderingContext2D, text: string, x: number, y: number, colour: string): void {
	pen.fillStyle = colour;
	pen.textBaseline = "middle";
	pen.textAlign = "center";
	pen.fillText(text, x, y + 0.5);
}

export const colourOf = (state: number): string => STATE[state]!;
