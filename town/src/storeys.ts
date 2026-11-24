// The storeys of the subjects' buildings in modules, in `STOREYS` styles, and the windows and balconies on their faces.
import { windowPhase } from "./facades-kit";
import { merge } from "./nodes";
import { BD, BW, SH, b, detail, flat, pick, rnd, turned, type G } from "./shapes";

// A window on a +z face: glass (it may be lit), frame, sill, cross bars. The frame and the bars are fine details, left
// out from afar (./shapes.ts#detail): their grid blinked in a moire pattern as the town turned.
export function win(u: number, y: number, z: number, w: number, h: number, r: () => number, frame = "#f3ead9"): G[] {
	return [
		flat(b("#39485f", w, h, 0.05, u, y, z, windowPhase(r))),
		b(frame, w + 0.14, 0.07, 0.09, u, y + h, z + 0.02, detail(0.07)),
		b(frame, w + 0.2, 0.05, 0.13, u, y - 0.05, z + 0.03, detail(0.05)),
		b(frame, 0.06, h, 0.08, u - w / 2 - 0.02, y, z + 0.01, detail(0.06)),
		b(frame, 0.06, h, 0.08, u + w / 2 + 0.02, y, z + 0.01, detail(0.06)),
		b(frame, 0.03, h, 0.07, u, y, z, detail(0.03)),
		b(frame, w, 0.03, 0.07, u, y + h * 0.58, z, detail(0.03)),
	];
}
function balcony(u: number, y: number, z: number, w: number): G[] {
	const iron = "#2c303b";
	return [
		b("#cfc7ba", w, 0.05, 0.24, u, y, z + 0.1),
		b(iron, w, 0.025, 0.025, u, y + 0.27, z + 0.2, detail(0.025)),
		b(iron, w, 0.02, 0.02, u, y + 0.14, z + 0.2, detail(0.02)),
		...Array.from({ length: Math.round(w / 0.14) + 1 }, (_, at) =>
			b(iron, 0.02, 0.27, 0.02, u - w / 2 + (at * w) / Math.round(w / 0.14), y + 0.02, z + 0.2, detail(0.02)),
		),
	];
}
// What is built on the +z face of a volume, turned to another face by quarter turns (1 the +x face, 2 the back, 3 the -x face).
export const turnedBy = (parts: G[], quarters: number): G => (quarters > 1 ? turnedBy([turned(parts)], quarters - 1) : turned(parts));

// The storeys' styles: stone with shutters and balconies, brick with flower boxes, modern with glass bands, and two more
// modern ones, so that the office blocks of a town do not all repeat the glass bands: a pale wall with framed windows
// and balconies, and tall slim windows between pale fins.
export const STOREYS = 5;
// The styles a modern building (the third's tints) draws from; a subject takes the next one while another is free.
export const MODERNS = [2, 3, 4];

// The window of bay `bay` (of `bays`) at `u`, on a face `width` wide whose plane is at z = off, in the storey's style.
function storeyBay(out: G[], style: number, r: () => number, u: number, off: number, bay: number, bays: number, width: number): void {
	if (style === 0) {
		// The shutters touch the glass (0.235 to 0.405 from the window's middle), under its frame: a strip of wall a pixel
		// wide between the dark glass and the shutter blinked down every window of a tower as the town turned.
		out.push(
			...win(u, 0.32, off, 0.46, 0.76, r),
			b("#5f7f8f", 0.17, 0.76, 0.04, u - 0.32, 0.32, off + 0.01, detail(0.17)),
			b("#5f7f8f", 0.17, 0.76, 0.04, u + 0.32, 0.32, off + 0.01, detail(0.17)),
		);
		if (bay % 2 === 0) out.push(...balcony(u, 0.24, off, 0.9));
	} else if (style === 1) {
		out.push(...win(u, 0.36, off, 0.5, 0.66, r), b("#f1e6d4", 0.7, 0.08, 0.07, u, 1.06, off + 0.01, detail(0.08)));
		if (r() < 0.5)
			out.push(
				// The box's top (0.38) is above the sill's (0.36): two tops in one plane would flicker.
				b("#8a5f3a", 0.62, 0.1, 0.14, u, 0.28, off + 0.1),
				...Array.from({ length: 5 }, (_, at) =>
					b(pick(["#ff6f91", "#ffd166", "#4aaa55", "#ffffff"], r), 0.07, 0.08, 0.07, u - 0.22 + at * 0.11, 0.38, off + 0.1),
				),
			);
		else if (r() < 0.4) out.push(b("#c9ccd4", 0.34, 0.2, 0.16, u, 0.12, off + 0.08), b("#6b7079", 0.22, 0.12, 0.02, u, 0.16, off + 0.17));
	} else if (style === 3) {
		// A pale wall pierced by framed windows, a balcony under every other one.
		out.push(...win(u, 0.34, off, 0.62, 0.74, r, "#fbf7ee"));
		if (bay % 2 === 1) out.push(...balcony(u, 0.26, off, 1.0));
	} else if (style === 4) {
		// Tall slim windows between pale fins that run the storey's whole height.
		const half = (width - 0.5) / bays / 2;
		out.push(
			flat(b("#39485f", 0.42, 0.86, 0.05, u, 0.2, off, windowPhase(r))),
			b("#f6f1e8", 0.5, 0.05, 0.08, u, 0.15, off + 0.02, detail(0.05)),
			b("#f6f1e8", 0.08, SH, 0.1, u + half, 0, off + 0.03, detail(0.08)),
		);
		if (bay === 0) out.push(b("#f6f1e8", 0.08, SH, 0.1, u - half, 0, off + 0.03, detail(0.08)));
	} else {
		out.push(
			flat(b("#39485f", 0.94, 0.72, 0.05, u, 0.3, off, windowPhase(r))),
			b("#2c303b", 0.04, 0.72, 0.07, u - 0.49, 0.3, off + 0.01, detail(0.04)),
			b("#2c303b", 0.03, 0.72, 0.06, u, 0.3, off + 0.01, detail(0.03)),
		);
	}
}

// The windows of a face `width` wide whose plane is at z = off, `bays` of them, and its bands.
function storeyFace(style: number, r: () => number, width: number, off: number, bays: number): G[] {
	const out: G[] = [];
	for (let bay = 0; bay < bays; bay++) storeyBay(out, style, r, ((bay + 0.5) / bays - 0.5) * (width - 0.5), off, bay, bays, width);
	// The storeys' bands and fins are fine details too (./shapes.ts#detail): a line a pixel wide down or across a
	// tower blinked as the town turned.
	if (style === 1)
		out.push(
			b("#f1e6d4", width + 0.04, 0.05, 0.05, 0, 0.22, off, detail(0.05)),
			b("#8f3f30", width + 0.02, 0.03, 0.04, 0, 0.62, off, detail(0.03)),
			b("#8f3f30", width + 0.02, 0.03, 0.04, 0, 0.9, off, detail(0.03)),
		);
	if (style === 2)
		out.push(
			b("#2c303b", width - 0.3, 0.05, 0.08, 0, 1.02, off + 0.01, detail(0.05)),
			b("#2c303b", width - 0.3, 0.05, 0.08, 0, 0.26, off + 0.01, detail(0.05)),
			...[0, 1, 2].map((at) => b("#aeb6bf", width - 0.4, 0.02, 0.2, 0, 1.08 + at * 0.05, off + 0.1, detail(0.02))),
		);
	return out;
}

// One storey, in `STOREYS` styles (see above).
export function storey(style: number): G {
	const r = rnd(style + 3);
	// The bays of the front and back (`wide`) and of the sides (`deep`).
	const [wide, deep] = style === 4 ? [7, 4] : [5, 3];
	const face = (width: number, off: number, bays: number): G[] => storeyFace(style, r, width, off, bays);
	const corners =
		style === 0
			? [-1, 1].flatMap((sx) =>
					[-1, 1].flatMap((sz) => [0.05, 0.45, 0.85].map((y) => b("#f6efe2", 0.22, 0.3, 0.22, (sx * (BW - 0.16)) / 2, y, (sz * (BD - 0.16)) / 2))),
				)
			: [];
	return merge([
		b("#ffffff", BW, SH, BD, 0, 0, 0, 1),
		b(style === 2 || style === 4 ? "#c6ccd3" : "#f3ead9", BW + 0.14, 0.09, BD + 0.14, 0, SH - 0.09, 0),
		...corners,
		b("#4d5563", 0.07, SH, 0.07, BW / 2 - 0.3, 0, BD / 2 + 0.04, detail(0.07)),
		...face(BW, BD / 2, wide),
		// The camera turns round the town: the right side, the back and the left side carry windows like the front.
		turned(face(BD, BW / 2, deep)),
		turnedBy(face(BW, BD / 2, wide), 2),
		turnedBy(face(BD, BW / 2, deep), 3),
	]);
}
