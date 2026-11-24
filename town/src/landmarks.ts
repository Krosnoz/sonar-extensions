// The monument of a project's town, on the block at the back. One per family of town.
import type { Style } from "./styles";
import { glassOf, shade, windowPhase } from "./facades-kit";
import { THREE } from "./nodes";
import { b, cyl, piece, rnd, type G } from "./shapes";

const DOOR = "#6e4a32";
// What `build` draws on a +z face, put on the four faces (+z, +x, -z, -x) round the vertical axis through z = `at`: the
// camera turns round the town, and every face of a monument is finished. `build` gets the face's number (0 front, 2 back).
const around = (build: (face: number) => G[], at = 0): G[] =>
	[0, Math.PI / 2, Math.PI, -Math.PI / 2].flatMap((turn, face) => build(face).map((part) => part.translate(0, 0, -at).rotateY(turn).translate(0, 0, at)));

// The lattice tower's half width at the height y.
const half = (y: number): number => 0.35 + 2.6 * Math.pow(1 - y / 17, 2.2);
function lattice(c: string): G[] {
	// Four legs that curve in as they rise, braced on every face, two platforms, then the needle.
	const out: G[] = [];
	const levels = 14;
	for (let level = 0; level < levels; level++) {
		const [y0, y1] = [level * 1.2, (level + 1) * 1.2];
		const [h0, h1] = [half(y0), half(y1)];
		const thick = 0.55 - level * 0.028;
		for (const [sx, sz] of [
			[-1, -1],
			[1, -1],
			[-1, 1],
			[1, 1],
		] as const) {
			const lean = Math.atan2(h0 - h1, 1.2);
			out.push(b(c, thick, 1.28, thick, (sx * (h0 + h1)) / 2, y0, (sz * (h0 + h1)) / 2, 0, [-sz * lean, 0, sx * lean]));
		}
		// The bracing of the four faces.
		if (level > 0 && level < levels - 2) {
			const span = h0 + h1;
			const angle = Math.atan2(1.2, span);
			for (const side of [1, -1]) {
				out.push(b(shade(c, 0.85), 0.1, 0.1, span * 1.15, (side * (h0 + h1)) / 2, y0 + 0.55, 0, 0, [angle, 0, 0]));
				out.push(b(shade(c, 0.85), span * 1.15, 0.1, 0.1, 0, y0 + 0.55, (side * (h0 + h1)) / 2, 0, [0, 0, angle]));
			}
		}
	}
	for (const y of [3.6, 9.6])
		out.push(b(shade(c, 0.8), half(y) * 2 + 0.8, 0.35, half(y) * 2 + 0.8, 0, y, 0), b("#f4f2ee", half(y) * 2 + 0.9, 0.06, half(y) * 2 + 0.9, 0, y + 0.35, 0));
	// The arch between the legs, on the four faces.
	for (const side of [1, -1])
		out.push(b(shade(c, 0.85), 4.4, 0.3, 0.3, 0, 3.1, side * (half(3) + 0.1)), b(shade(c, 0.85), 0.3, 0.3, 4.4, side * (half(3) + 0.1), 3.1, 0));
	out.push(b(c, 0.5, 1.6, 0.5, 0, levels * 1.2, 0), b("#f4f2ee", 0.14, 2.2, 0.14, 0, levels * 1.2 + 1.6, 0));
	return out;
}

// A clock tower: the dial and its hand on the four faces, the windows on the four faces, a door at the front and at the back.
function clock(c: string, glass: string, r: () => number): G[] {
	return [
		b(c, 3, 9, 3, 0, 0, 0),
		b(shade(c), 3.3, 0.3, 3.3, 0, 9, 0),
		b(c, 2.4, 2.4, 2.4, 0, 9.3, 0),
		piece(new THREE.ConeGeometry(2, 3.2, 4).rotateY(Math.PI / 4), "#c8613f", 0, 0, 13.3, 0),
		...around((face) => [
			b("#fbf6ec", 1.4, 1.4, 0.06, 0, 9.8, 1.23),
			b("#2c303b", 0.08, 0.5, 0.04, 0, 10.4, 1.28),
			...[0, 1, 2, 3, 4, 5].map((n) => b(glass, 0.4, 0.9, 0.04, -0.6 + (n % 2) * 1.2, 1.5 + Math.floor(n / 2) * 2.4, 1.52, windowPhase(r))),
			...(face % 2 === 0 ? [b(DOOR, 0.8, 1.3, 0.05, 0, 0, 1.52), b("#cfc4b6", 1.1, 0.06, 0.3, 0, 0, 1.65)] : []),
		]),
	];
}

function deco(c: string, glass: string, r: () => number): G[] {
	const out: G[] = [];
	const steps: [number, number][] = [
		[5, 7],
		[4, 6],
		[3, 5],
		[2, 3],
		[1.2, 2],
	];
	let y = 0;
	for (const [w, h] of steps) {
		out.push(b(c, w, h - 0.14, w, 0, y, 0), b(shade(c), w + 0.12, 0.14, w + 0.12, 0, y + h - 0.14, 0));
		const base = y === 0;
		// The windows climb every face in strips; the base's front and back leave room for the door.
		out.push(
			...around((face) => [
				...Array.from({ length: Math.round(w / 0.5) }, (_, n) => -w / 2 + 0.25 + n * 0.5)
					.filter((u) => !(base && face % 2 === 0 && Math.abs(u) < 0.45))
					.map((u) => b(glass, 0.12, h - 0.4, 0.04, u, y + 0.2, w / 2, windowPhase(r))),
				...(base && face % 2 === 0 ? [b(DOOR, 0.8, 1.7, 0.05, 0, 0, w / 2 + 0.005), b("#e9e4d8", 1.0, 0.1, 0.1, 0, 1.7, w / 2 + 0.02)] : []),
			]),
		);
		y += h;
	}
	out.push(b("#e9e4d8", 0.18, 3.5, 0.18, 0, y, 0));
	return out;
}

// A pagoda: storeys smaller and smaller, each with its wide roof, its windows on the four faces and a door at the foot.
function pagoda(c: string, glass: string, r: () => number): G[] {
	const out: G[] = [];
	let y = 0;
	for (let level = 0; level < 5; level++) {
		const w = 3.6 - level * 0.5;
		out.push(b(c, w, 1.5, w, 0, y, 0), b("#3f4752", w + 1.6, 0.25, w + 1.6, 0, y + 1.5, 0), b("#59606b", w + 1, 0.2, w + 1, 0, y + 1.75, 0));
		const door = level === 0;
		out.push(
			...around((face) => [
				...(w >= 2.2 ? [-w * 0.3, w * 0.3] : [0]).map((u) => b(glass, 0.42, 0.8, 0.04, u, y + 0.4, w / 2, windowPhase(r))),
				...(door && face % 2 === 0 ? [b(DOOR, 0.6, 1.1, 0.05, 0, y, w / 2 + 0.005), b("#c9a24a", 0.74, 0.08, 0.08, 0, y + 1.1, w / 2 + 0.02)] : []),
			]),
		);
		y += 1.95;
	}
	out.push(b("#c9a24a", 0.14, 2.6, 0.14, 0, y, 0));
	return out;
}

// A square spire of `courses` rows of slates, its base at y = 0: each row flares out a little at its foot, so the light
// catches a step at every row instead of one smooth cone. One piece, its corners on the diagonals like a cone of four sides.
function slates(radius: number, height: number, courses: number): G {
	const [row, flare] = [height / courses, 0.12];
	const profile: THREE.Vector2[] = [];
	for (let n = 0; n < courses; n++) {
		const [foot, next] = [radius * (1 - n / courses), radius * (1 - (n + 1) / courses)];
		profile.push(new THREE.Vector2(foot + flare, n * row), new THREE.Vector2(foot, n * row + 0.1), new THREE.Vector2(next + flare, (n + 1) * row));
	}
	profile.push(new THREE.Vector2(0, height));
	return new THREE.LatheGeometry(profile, 4).rotateY(Math.PI / 4);
}

// The church's roofs: a light grey-green (aged copper), near the stone of the tower: the dark cone clashed with it.
const SLATE = "#93a79b";

// A church: a nave under its steep roof, and a square tower with its tall spire at the street's end. The nave is narrower
// than the tower and ends on its back face: nothing goes through the tower, and the whole fits the square (6.4 deep, its cap included).
function spire(c: string, glass: string, r: () => number): G[] {
	const [front, back, tower] = [-3.2, 0.45, 1.75];
	const nave = new THREE.Shape([new THREE.Vector2(-1.3, 0), new THREE.Vector2(1.3, 0), new THREE.Vector2(0, 2.4)]);
	const roof = new THREE.ExtrudeGeometry(nave, { depth: back - front, bevelEnabled: false }).translate(0, 0, front);
	const out: G[] = [b("#efe6d4", 2.4, 4, back - front, 0, 0, (front + back) / 2), piece(roof, SLATE, 0, 0, 4, 0)];
	// The nave's two sides, and its end: a door under a window, and one in its gable.
	for (const side of [1, -1]) for (let n = 0; n < 3; n++) out.push(b(glass, 0.04, 1.8, 0.6, side * 1.22, 1.2, front + 0.9 + n * 1.1, windowPhase(r)));
	out.push(
		b(DOOR, 1, 1.8, 0.05, 0, 0, front - 0.005),
		b(glass, 0.5, 0.5, 0.04, 0, 2.5, front - 0.005, windowPhase(r)),
		b(glass, 0.3, 0.7, 0.04, 0, 4.25, front - 0.005, windowPhase(r)),
	);
	out.push(b(c, 2.6, 9, 2.6, 0, 0, tower), b(shade(c, 0.85), 2.9, 0.3, 2.9, 0, 9, tower));
	// The tower: the belfry's window on its four faces, a lower pair on the front and on the sides, the door in front.
	out.push(
		b(glass, 0.6, 1.6, 0.04, 0, 6.6, tower + 1.32, windowPhase(r)),
		b(glass, 0.6, 1.6, 0.04, 0, 6.6, tower - 1.32, windowPhase(r)),
		b(DOOR, 0.9, 1.6, 0.05, 0, 0, tower + 1.32),
	);
	for (const side of [1, -1]) out.push(b(glass, 0.04, 1.6, 0.6, side * 1.32, 6.6, tower, windowPhase(r)));
	for (const u of [-0.55, 0.55])
		out.push(
			b(glass, 0.4, 0.9, 0.04, u, 3.2, tower + 1.32, windowPhase(r)),
			b(glass, 0.04, 0.9, 0.4, 1.32, 3.2, tower + u, windowPhase(r)),
			b(glass, 0.04, 0.9, 0.4, -1.32, 3.2, tower + u, windowPhase(r)),
		);
	out.push(piece(slates(1.75, 5.2, 6), SLATE, 0, 0, 9.3, tower));
	// A dormer on each face, a third of the way up (the face is 0.88 from the axis there): stone, a glass pane, a slate cap.
	out.push(
		...around(
			() => [
				b(shade(c, 1.05), 0.44, 0.5, 0.34, 0, 10.9, tower + 0.78),
				b(glass, 0.2, 0.3, 0.04, 0, 11, tower + 0.96, windowPhase(r)),
				b(shade(SLATE, 0.85), 0.56, 0.08, 0.46, 0, 11.4, tower + 0.78),
			],
			tower,
		),
	);
	// A gilded cross on the apex (it ends the lathe at 14.5): an upright 1.6 high, its arms 0.9 across, 0.2 thick: at 0.12
	// it was a pixel wide from the near views. The arms stand 0.02 proud of the upright, no face in its planes.
	out.push(b("#c9a24a", 0.2, 1.6, 0.2, 0, 14.5, tower), b("#c9a24a", 0.9, 0.2, 0.24, 0, 15.4, tower));
	return out;
}

// A dome on its drum, behind a porch of columns, with its lantern. The cornice stops at the building's front, where the
// porch's beam leans on it; columns stand on the ground; the whole is 6.4 deep, inside the monument's square.
function dome(c: string, glass: string, r: () => number): G[] {
	const [zc, front] = [-0.3, 2.3];
	const out: G[] = [b("#f2ece0", 7, 4.2, 5.2, 0, 0, zc), b(shade(c, 1.1), 7.3, 0.35, 5.5, 0, 4.2, front - 2.75)];
	// Windows on the sides and the back, a door at the back; at the front a door and the windows between the columns.
	for (const side of [1, -1]) for (const dz of [-1.6, 0, 1.6]) out.push(b(glass, 0.04, 1.5, 0.5, side * 3.5, 1.2, zc + dz, windowPhase(r)));
	for (const x of [-2.4, -0.8, 0.8, 2.4]) out.push(b(glass, 0.5, 1.5, 0.04, x, 1.2, zc - 2.6, windowPhase(r)));
	for (const x of [-2, -1, 1, 2]) out.push(b(glass, 0.4, 1.5, 0.04, x, 1.2, front, windowPhase(r)));
	out.push(
		b(DOOR, 0.9, 1.9, 0.05, 0, 0, zc - 2.6),
		b(DOOR, 0.8, 2, 0.05, 0, 0, front),
		...around(() => [b(glass, 0.4, 0.9, 0.12, 0, 5.3, zc + 2.36, windowPhase(r))], zc),
	);
	for (let n = 0; n < 6; n++) out.push(cyl("#fbf6ec", 0.24, 0.24, 3.84, -2.5 + n, 0.06, 2.75, 10));
	out.push(
		b("#fbf6ec", 6.4, 0.5, 0.9, 0, 3.9, 2.75),
		piece(new THREE.ConeGeometry(3.3, 1.2, 4).rotateY(Math.PI / 4).scale(1, 1, 0.2), "#fbf6ec", 0, 0, 5, 2.75),
	);
	out.push(cyl("#f2ece0", 2.4, 2.4, 2.4, 0, 4.55, zc, 20));
	out.push(piece(new THREE.SphereGeometry(2.5, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), c, 0, 0, 6.95, zc));
	out.push(cyl("#fbf6ec", 0.5, 0.5, 1.2, 0, 9.35, zc, 10), piece(new THREE.ConeGeometry(0.6, 0.8, 10), c, 0, 0, 10.95, zc));
	return out;
}

// The monuments are drawn around z = 0; the square they stand on is centred 0.2 further, where the town puts them.
export function landmark(style: Style): G[] {
	const c = style.accent;
	const [glass, r] = [glassOf(style), rnd(7)];
	const parts =
		style.landmark === "lattice"
			? lattice(c)
			: style.landmark === "clock"
				? clock(c, glass, r)
				: style.landmark === "deco"
					? deco(c, glass, r)
					: style.landmark === "spire"
						? spire(c, glass, r)
						: style.landmark === "dome"
							? dome(c, glass, r)
							: pagoda(c, glass, r);
	return parts.map((part) => part.translate(0, 0, 0.2));
}
