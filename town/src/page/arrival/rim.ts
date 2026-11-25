// The edge that eats the page: the cells about to leave glow, in a thin band, as the edge of a dissolve burns. Drawn in
// pixels on a plain canvas under the town's, over the page and its cover (./cover.ts).
import type { Size } from "../camera/size";

export type Glowing = { x: number; y: number; t0: number; size: number };
// How long a cell glows before it leaves.
const EDGE = 0.1;

// The first cell, in the order they leave, that leaves after `built`.
function firstAfter(cells: Glowing[], built: number): number {
	let [low, high] = [0, cells.length];
	while (low < high) {
		const middle = (low + high) >> 1;
		if (cells[middle]!.t0 <= built) low = middle + 1;
		else high = middle;
	}
	return low;
}

export type Colour = [number, number, number];
// A colour of the page as red, green and blue: the browser's own canvas reads every colour the page may write.
export const colourOf = (css: string): Colour => {
	const canvas = Object.assign(document.createElement("canvas"), { width: 1, height: 1 });
	const context = canvas.getContext("2d", { willReadFrequently: true })!;
	context.fillStyle = css;
	context.fillRect(0, 0, 1, 1);
	const [r, g, b] = context.getImageData(0, 0, 1, 1).data;
	return [r!, g!, b!];
};
// A colour taken `k` of the way towards white.
const lifted = (colour: Colour, k: number): Colour => {
	const up = (value: number): number => Math.round(value + (255 - value) * k);
	return [up(colour[0]), up(colour[1]), up(colour[2])];
};
const written = (colour: Colour): string => `rgb(${colour.join(" ")})`;

// The edge burns in the accent the user chose (Settings › Appearance): its sparks whiter at night, its halo paler by day.
export function sparksOf(host: HTMLElement, night: boolean): [Colour, Colour] {
	const accent = colourOf(getComputedStyle(host).getPropertyValue("--accent").trim());
	return night ? [lifted(accent, 0.6), accent] : [accent, lifted(accent, 0.5)];
}

// `size`: the host's box, read at each change only (../camera/size.ts).
export function rim(host: HTMLElement, night: boolean, size: Size): { draw: (cells: Glowing[], built: number) => void; dispose: () => void } {
	const canvas = document.createElement("canvas");
	Object.assign(canvas.style, { position: "absolute", inset: "0", width: "100%", height: "100%", pointerEvents: "none" });
	host.prepend(canvas);
	const context = canvas.getContext("2d")!;
	const [first, second] = sparksOf(host, night);
	const [hot, halo] = [written(first), written(second)];
	let sorted: Glowing[] = [];
	let lit = false;
	return {
		draw(cells, built) {
			if (sorted.length !== cells.length) sorted = cells.toSorted((a, b) => a.t0 - b.t0);
			const dpr = Math.min(devicePixelRatio, 3);
			const [w, h] = [Math.round(size.width * dpr), Math.round(size.height * dpr)];
			if (canvas.width !== w || canvas.height !== h) [canvas.width, canvas.height] = [w, h];
			// Only the cells that leave within EDGE glow.
			const [from, to] = [firstAfter(sorted, built), firstAfter(sorted, built + EDGE)];
			if (from === to && !lit) return;
			context.setTransform(1, 0, 0, 1, 0, 0);
			context.clearRect(0, 0, w, h);
			lit = from < to;
			context.setTransform(dpr, 0, 0, dpr, -size.left * dpr, -size.top * dpr);
			// A faint halo over the cell, then hot sparks the size of the dust: a whole cell lit reads as a square
			// bigger than the points that fly.
			const speck = Math.max(1, Math.round(dpr)) / dpr;
			for (const pass of [0, 1]) {
				context.fillStyle = pass ? hot : halo;
				for (let at = from; at < to; at++) {
					const cell = sorted[at]!;
					const k = (built - (cell.t0 - EDGE)) / EDGE;
					const [left, top] = [cell.x - cell.size / 2, cell.y - cell.size / 2];
					if (!pass) {
						context.globalAlpha = 0.18 * k;
						context.fillRect(left, top, cell.size, cell.size);
						continue;
					}
					context.globalAlpha = 0.45 + 0.55 * k;
					for (const seed of [0.13, 0.71]) {
						const r = Math.abs(Math.sin(cell.x * 12.9898 + cell.y * 78.233 + seed * 43.7) * 43758.5453) % 1;
						const s = (r * 7.3 + seed) % 1;
						context.fillRect(left + r * (cell.size - speck), top + s * (cell.size - speck), speck, speck);
					}
				}
			}
			context.globalAlpha = 1;
		},
		dispose: () => canvas.remove(),
	};
}
