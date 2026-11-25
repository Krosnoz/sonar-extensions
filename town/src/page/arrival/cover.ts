// What hides the page behind its edge (./edge.ts): one canvas of the colour behind the page, a pixel of it for a case of
// a few pixels of the screen, painted case by case as the edge reaches each. Nothing of the page is copied, moved or
// kept whole: it leaves where it stands, its cards as its ground, at the same instant. The page itself is never touched:
// a mask image on its things, or a shape cut in the map, made the browser draw the page again at each change, and the
// page flickered (17/11).
import { TEXT, type Reach } from "./edge";
import { colourOf } from "./rim";
import type { Sheet } from "./sheets";
import { mapFrame } from "../camera/size";

// How many of the times, in order, are at `built` or before.
function passed(times: Float32Array, built: number): number {
	let [low, high] = [0, times.length];
	while (low < high) {
		const middle = (low + high) >> 1;
		if (times[middle]! <= built) low = middle + 1;
		else high = middle;
	}
	return low;
}

// `side`: a case's side, in pixels. `cut`: the page's sheets of cells; those that hold a text leave after the ground
// round them.
export function covering(
	host: HTMLElement,
	edge: Reach,
	side: number,
	cut: Pick<Sheet, "cells" | "size">[],
): { draw: (built: number) => void; clear: () => void } {
	const from = mapFrame();
	const [cols, rows] = [Math.ceil(from.width / side), Math.ceil(from.height / side)];
	const centre = (at: number): [number, number] => [from.left + ((at % cols) + 0.5) * side, from.top + (Math.floor(at / cols) + 0.5) * side];
	const leaves = Float32Array.from({ length: cols * rows }, (_, at) => edge(...centre(at)));
	// Every case a text's cell touches leaves with the text.
	for (const { cells, size } of cut)
		for (const { x, y } of cells.filter((cell) => cell.text)) {
			const [left, right] = [Math.floor((x - size / 2 - from.left) / side), Math.floor((x + size / 2 - from.left - 0.01) / side)];
			const [top, bottom] = [Math.floor((y - size / 2 - from.top) / side), Math.floor((y + size / 2 - from.top - 0.01) / side)];
			for (let j = Math.max(0, top); j <= Math.min(rows - 1, bottom); j++)
				for (let i = Math.max(0, left); i <= Math.min(cols - 1, right); i++) leaves[j * cols + i] = edge(...centre(j * cols + i)) + TEXT;
		}
	const order = Uint32Array.from({ length: cols * rows }, (_, at) => at).toSorted((a, b) => leaves[a]! - leaves[b]!);
	const times = Float32Array.from(order, (at) => leaves[at]!);
	const canvas = Object.assign(document.createElement("canvas"), { className: "town-cover", width: cols, height: rows });
	Object.assign(canvas.style, { left: `${from.left}px`, top: `${from.top}px`, width: `${cols * side}px`, height: `${rows * side}px` });
	const pen = canvas.getContext("2d")!;
	pen.fillStyle = `rgb(${colourOf(getComputedStyle(document.body).backgroundColor).join(" ")})`;
	// Under the edge's canvas, which was put first: the edge's sparks show over the cover.
	host.prepend(canvas);
	let gone = 0;
	canvas.dataset["page"] = "whole";
	return {
		// Each frame paints only the cases the edge reached since the last one, or clears those it gave back.
		draw(built) {
			const count = passed(times, built);
			if (count === gone) return;
			for (let rank = Math.min(gone, count); rank < Math.max(gone, count); rank++) {
				const at = order[rank]!;
				if (count > gone) pen.fillRect(at % cols, Math.floor(at / cols), 1, 1);
				else pen.clearRect(at % cols, Math.floor(at / cols), 1, 1);
			}
			gone = count;
			// What the page shows of itself (the page tests read it).
			canvas.dataset["page"] = gone === 0 ? "whole" : gone < order.length ? "broken" : "gone";
		},
		clear: () => canvas.remove(),
	};
}
