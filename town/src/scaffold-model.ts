// A scaffold round the top of a subject's building (./scaffolds.ts), made of the town's small plain volumes. Its planks
// take the instance's colour: wood, or red while a check fails.
import { merge } from "./nodes";
import { BD, BW, SH, b, type G } from "./shapes";

const POST = "#8a6a3a";

export function scaffold(): G {
	const [w, d, h] = [BW + 0.36, BD + 0.36, SH + 0.3];
	const posts = [
		[-1, 1],
		[0, 1],
		[1, 1],
		[1, 0],
		[1, -1],
		[-1, -1],
		[-1, 0],
		[0, -1],
	].map(([sx = 0, sz = 0]) => b(POST, 0.08, h, 0.08, (sx * w) / 2, 0, (sz * d) / 2));
	const planks = [0.02, h * 0.5, h - 0.06].flatMap((y) => [
		b("#ffffff", w, 0.06, 0.1, 0, y, d / 2, 1),
		b("#ffffff", 0.1, 0.06, d, w / 2, y, 0, 1),
		b("#ffffff", w, 0.06, 0.1, 0, y, -d / 2, 1),
		b("#ffffff", 0.1, 0.06, d, -w / 2, y, 0, 1),
	]);
	// A brace across each bay of the two sides the camera sees.
	const braces = [-1, 1].flatMap((side) => [
		b(POST, 0.04, Math.hypot(w / 2, h) - 0.1, 0.04, (side * w) / 4, 0.03, d / 2, 0, [0, 0, side * Math.atan2(w / 2, h)]),
		b(POST, 0.04, Math.hypot(d / 2, h) - 0.1, 0.04, w / 2, 0.03, (side * d) / 4, 0, [-side * Math.atan2(d / 2, h), 0, 0]),
	]);
	return merge([...posts, ...planks, ...braces]);
}
