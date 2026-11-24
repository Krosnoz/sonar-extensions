// The ground floor of the subjects' buildings in modules: a shop, a cafe or a lobby in front, doors and windows round it.
import { NIGHT_ONLY, windowPhase } from "./facades-kit";
import { merge } from "./nodes";
import { BD, BW, GH, b, cyl, detail, pick, rnd, turned, type G } from "./shapes";
import { turnedBy, win } from "./storeys";

// The ground floor's front, on the +z face.
const OFF = BD / 2;
function door(u: number, glass: boolean): G[] {
	return [
		b(glass ? "#39485f" : "#7a4a2a", 0.52, 1, 0.05, u, 0.06, OFF + 0.005, glass ? NIGHT_ONLY : 0),
		b("#f3ead9", 0.66, 0.07, 0.09, u, 1.06, OFF + 0.02),
		b("#f3ead9", 0.07, 1.06, 0.08, u - 0.3, 0.06, OFF + 0.01),
		b("#f3ead9", 0.07, 1.06, 0.08, u + 0.3, 0.06, OFF + 0.01),
		b("#ffd166", 0.05, 0.05, 0.04, u + 0.16, 0.52, OFF + 0.04),
		b("#cfc4b6", 0.9, 0.06, 0.3, u, 0, OFF + 0.15),
	];
}
function shop(u: number, w: number, r: () => number): G[] {
	return [
		b("#39485f", w, 0.78, 0.05, u, 0.34, OFF, windowPhase(r)),
		b("#2c303b", w + 0.12, 0.06, 0.09, u, 1.12, OFF + 0.02),
		b("#2c303b", w + 0.12, 0.08, 0.12, u, 0.27, OFF + 0.03),
		b("#2c303b", 0.05, 0.8, 0.08, u - w / 2 - 0.03, 0.34, OFF + 0.01),
		b("#2c303b", 0.05, 0.8, 0.08, u + w / 2 + 0.03, 0.34, OFF + 0.01),
		...Array.from({ length: 4 }, (_, at) =>
			b(
				pick(["#ff6f91", "#ffd166", "#7fb8ff", "#f3ead9", "#8fdc8a"], r),
				0.14,
				0.12 + r() * 0.14,
				0.03,
				u - w / 2 + 0.16 + (at * (w - 0.3)) / 3,
				0.36,
				OFF + 0.035,
			),
		),
	];
}
function awning(u: number, w: number, colour: string): G[] {
	const count = Math.round(w / 0.22);
	return [
		// The canvas in its colour, a little thinner than the stripes, and its pale stripes over it: from afar the stripes
		// are left out (./shapes.ts#detail) and the awning is one colour. Two stripes of 2 pixels blinked as the town turned.
		b(colour, count * 0.22 - 0.01, 0.03, 0.7, u - w / 2 + count * 0.11, 1.025, OFF + 0.33, 0, [0.42, 0, 0]),
		...Array.from({ length: Math.floor(count / 2) }, (_, at) =>
			b("#f6efe2", 0.22, 0.04, 0.72, u - w / 2 + 0.11 + (2 * at + 1) * 0.22, 1.02, OFF + 0.33, detail(0.22, 3), [0.42, 0, 0]),
		),
	];
}
// A shop with its awning, a cafe with its terrace lights, a lobby with columns.
function front(style: number, r: () => number): G[] {
	if (style === 0)
		return [
			...door(0, false),
			...shop(-1.75, 1.7, r),
			...shop(1.75, 1.7, r),
			...awning(-1.75, 1.98, "#d8453a"),
			...awning(1.75, 1.98, "#d8453a"),
			b("#2c303b", 1.3, 0.22, 0.06, 0, 1.2, OFF + 0.03),
			...[-0.4, -0.2, 0, 0.2, 0.4].map((dx, at) => b(["#ffd166", "#f3ead9", "#ff9838"][at % 3]!, 0.1, 0.1, 0.02, dx, 1.26, OFF + 0.07)),
		];
	if (style === 1)
		return [
			...door(-2.2, true),
			...shop(-0.5, 1.5, r),
			...shop(1.6, 1.5, r),
			...awning(0.55, 4.2, "#2f8f6a"),
			b("#ffe7a0", 0.1, 0.14, 0.1, -2.75, 1, OFF + 0.05, 4),
			b("#ffe7a0", 0.1, 0.14, 0.1, -1.65, 1, OFF + 0.05, 4),
			// The board stands on the paving (its top is at 0.08, the ground floor starts at 0.1), by the shop's right end:
			// on a subject's square, where nobody stands, behind the middle (./inhabitants.ts). At x -1.5 and 0.7 out, it
			// stood in the row of those who stand there, and hid their robots.
			b("#2c303b", 0.4, 0.6, 0.04, 0.4, -0.02, OFF + 0.55, 0, [-0.2, 0, 0]),
			b("#f3ead9", 0.3, 0.3, 0.02, 0.4, 0.18, OFF + 0.55, 0, [-0.2, 0, 0]),
		];
	return [
		...door(-0.28, true),
		...door(0.28, true),
		...[-1, 1].flatMap((side) => [
			cyl("#eee6d8", 0.11, 0.13, 1.25, side * 0.85, 0.12, OFF + 0.34, 8),
			b("#eee6d8", 0.34, 0.08, 0.34, side * 0.85, 1.36, OFF + 0.34),
		]),
		...shop(-2.1, 1.3, r),
		...shop(2.1, 1.3, r),
		// Its top stands 0.03 above the ground floor's cornice (0.1 thick, ending at GH), not in the same plane.
		b("#eee6d8", 2.3, 0.15, 0.7, 0, 1.43, OFF + 0.3),
		b("#cfc4b6", 2.2, 0.06, 0.6, 0, 0.06, OFF + 0.34),
		b("#cfc4b6", 2.5, 0.06, 0.8, 0, 0, OFF + 0.42),
		b("#c9a24a", 0.3, 0.2, 0.02, -1.25, 0.7, OFF + 0.03),
	];
}
// The ground floor: its front, its right side (two windows and a service door), its back (a door and four windows) and its
// left side (two windows and a grate).
export function ground(style: number): G {
	const r = rnd(style + 31);
	return merge([
		b("#ffffff", BW, GH, BD, 0, 0, 0, 1),
		b("#9a938a", BW + 0.08, 0.22, BD + 0.08, 0, 0, 0),
		b("#f3ead9", BW + 0.16, 0.1, BD + 0.16, 0, GH - 0.1, 0),
		...front(style, r),
		turnedBy([...door(0, false), ...[-2.4, -1.5, 1.5, 2.4].flatMap((u) => win(u, 0.5, OFF, 0.5, 0.6, r))], 2),
		turnedBy([...win(-1.0, 0.5, BW / 2, 0.5, 0.6, r), ...win(1.0, 0.5, BW / 2, 0.5, 0.6, r), b("#4d5563", 0.5, 0.2, 0.04, 0, 0.16, BW / 2 + 0.005)], 3),
		turned([
			...win(-0.9, 0.5, BW / 2, 0.5, 0.6, r),
			...win(0.9, 0.5, BW / 2, 0.5, 0.6, r),
			b("#6b7079", 0.42, 0.9, 0.04, 0, 0.06, BW / 2 + 0.005),
			b("#c9ccd4", 0.3, 0.24, 0.2, 1.5, 0.22, BW / 2 + 0.1),
			// The pipe ends under the cornice (0.1 thick), so that its top is not in the cornice's top plane.
			b("#4d5563", 0.07, GH - 0.1, 0.07, -1.55, 0, BW / 2 + 0.04),
		]),
	]);
}
