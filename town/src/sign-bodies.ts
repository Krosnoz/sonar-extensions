// The figures' bodies on the screen, which a sign or a name may not cover (./signs.ts), filed by cells of the screen: a
// box is checked against the bodies of the cells it covers only. Checked against every body, each name of a town of
// 10 000 agents made 10 000 comparisons, and a frame at the nearest level took a third of a second. Hash grids are how
// crowds are queried at any size (as RBush or a uniform grid in Mapbox's collision index, github.com/mapbox/mapbox-gl-js
// src/symbol/grid_index.ts).
import { bodyBox } from "./sign-geometry";

// A cell's side, in CSS pixels: about a name's height and a half, a near figure's width.
const CELL = 48;

// A cell's number, from its column and its row.
const keyOf = (column: number, row: number): number => column * 4096 + row;

// `figures`: where each figure stands; `project`: a point of the town on the screen; `width` × `height`: the screen.
// Only the bodies on the screen are filed: a sign and a name stand whole on it. `clear` answers as ./sign-geometry.ts#clear
// does over every body, `skip` being a figure's index.
export function bodyGrid(
	figures: { at: [number, number, number] }[],
	project: (at: [number, number, number]) => [number, number],
	width: number,
	height: number,
) {
	const boxes: [number, number, number, number][] = [];
	const owners: number[] = [];
	const cells = new Map<number, number[]>();
	figures.forEach(({ at }, index) => {
		const [x, head] = project(at);
		const box = bodyBox(x, project([at[0], 0, at[2]])[1], head);
		if (box[2] < 0 || box[0] > width || box[3] < 0 || box[1] > height) return;
		const filed = boxes.push(box) - 1;
		owners.push(index);
		for (let column = Math.floor(Math.max(0, box[0]) / CELL); column <= Math.floor(Math.min(width, box[2]) / CELL); column++)
			for (let row = Math.floor(Math.max(0, box[1]) / CELL); row <= Math.floor(Math.min(height, box[3]) / CELL); row++) {
				const key = keyOf(column, row);
				const list = cells.get(key);
				if (list) list.push(filed);
				else cells.set(key, [filed]);
			}
	});
	const clear = (x: number, y: number, w: number, h: number, slack: number, skip = -1): boolean => {
		const [left, top, right, bottom] = [x + slack, y + slack, x + w - slack, y + h - slack];
		// A slack wider than the box turns it inside out: the cells between its edges are read all the same.
		const [x0, x1, y0, y1] = [Math.min(left, right), Math.max(left, right), Math.min(top, bottom), Math.max(top, bottom)];
		for (let column = Math.floor(Math.max(0, x0) / CELL); column <= Math.floor(Math.min(width, x1) / CELL); column++)
			for (let row = Math.floor(Math.max(0, y0) / CELL); row <= Math.floor(Math.min(height, y1) / CELL); row++)
				for (const filed of cells.get(keyOf(column, row)) ?? []) {
					const [a, b, c, d] = boxes[filed]!;
					if (owners[filed] !== skip && left < c && right > a && top < d && bottom > b) return false;
				}
		return true;
	};
	return { count: boxes.length, clear };
}
