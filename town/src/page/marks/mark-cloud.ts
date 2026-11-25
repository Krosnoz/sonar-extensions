// A group is a ring of round points, as the points of Ping's orb and of the map's grid (radial dots on a
// 3.5 px pitch). Each point carries a state's colour, and the number of points of a state says its share. An agent
// alone is a small flower of seven points in its state's colour. The count stands in the middle.
import { colourOf, count, dot, fontAt, label, single, type Look } from "./mark-paint";
import { pointsOf } from "./mark-share";

const radiusOf = (total: number): number => (total < 10 ? 12 : total < 100 ? 14 : total < 1000 ? 16 : 18);
// The points' pitch along the ring, and their radius, in CSS pixels: the page's grid, a little larger to read on a roof.
const [PITCH, POINT] = [3.9, 1.55];

const point = (pen: CanvasRenderingContext2D, x: number, y: number, colour: string): void => {
	pen.beginPath();
	pen.arc(x, y, POINT, 0, 2 * Math.PI);
	pen.fillStyle = colour;
	pen.fill();
};

export const cloud: Look = {
	room: 36,
	box: (p) => {
		const r = p.total === 1 ? 8.5 : radiusOf(p.total) + 2;
		return [p.x - r, p.y - 1.5 - 2 * r, p.x + r, p.y - 1.5];
	},
	draw: (pen, p, palette) => {
		if (p.total === 1) {
			const [cx, cy, colour] = [p.x, p.y - 10, colourOf(single(p))];
			dot(pen, cx, cy, 7, 0, palette.surface, palette, palette.surface);
			point(pen, cx, cy, colour);
			for (let k = 0; k < 6; k++) point(pen, cx + 3.4 * Math.cos((k * Math.PI) / 3), cy + 3.4 * Math.sin((k * Math.PI) / 3), colour);
			return;
		}
		const r = radiusOf(p.total);
		const [cx, cy] = [p.x, p.y - 3 - r];
		dot(pen, cx, cy, 0, r + 1, palette.surface, palette, palette.surface);
		const ring = r - 2.5;
		const n = Math.round((2 * Math.PI * ring) / PITCH);
		let at = 0;
		for (const { state, points } of pointsOf(p.counts, p.total, n)) {
			for (let k = 0; k < points; k++, at++) {
				const angle = -Math.PI / 2 + (2 * Math.PI * at) / n;
				point(pen, cx + ring * Math.cos(angle), cy + ring * Math.sin(angle), colourOf(state));
			}
		}
		fontAt(pen, r < 16 ? 10 : 11, palette);
		count(pen, label(p.total), cx, cy, palette.ink);
	},
};
