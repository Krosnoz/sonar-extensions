// A figure is born and goes in layers, plate by plate of its own model: the seams between its plates light up, a
// plate's fill goes, the lattice under it stays lit and burns away, then nothing is left. It goes from its top down:
// a lit band comes down the figure. What gives its light (a robot's eyes and antenna) shines, then goes with the last
// plates. A birth is the same going, run backwards. Nothing shows or goes at once.
// An instance's mark says when (./parts.ts#Part): 0, it is there; over 0, it is born at that second of the town; under
// 0, it goes from that second.
import {
	abs,
	clamp,
	distance,
	float,
	floor,
	Fn,
	fract,
	fwidth,
	If,
	max,
	min,
	mix,
	normalGeometry,
	positionGeometry,
	smoothstep,
	step,
	vec3,
	vec4,
} from "three/tsl";
import type { Node, Vec3, Vec4 } from "./nodes";

// The plates of a model's unit, of uneven shapes: a person, 0.66 high, is six plates high, a robot four.
const PLATES = 9;
// The lattice's cells across a plate, and so in a model's unit.
const LINES = 3;
export const CELLS = PLATES * LINES;
// The seconds a plate's seams light up before its fill goes, from the first fill gone to the last, and its lattice
// burns after it.
export const [SEAM, LAST, GRID] = [0.3, 1.3, 0.5];
// The seconds a figure takes to go, or to be born.
export const END = SEAM + LAST + GRID;
// The share of a plate's turn that is its own, not its height's: plates of one height do not all go at once.
const OWN = 0.16;
// When what gives the figure's light goes, in the order of its plates (0 the first, 1 the last), and the seconds it
// shines before.
const [HEART, SHINE] = [0.82, 0.28];
// A seam between two plates and a lattice's line seen near, each side: in plates, and in the lattice's cells.
const [CRACK, LINE] = [0.045, 0.1];

// The model's bottom and top.
export type Span = [number, number];

// A number from 0 to 1 for a plate's cell and a rank, the same in the shader and here: products of small whole
// numbers, which both count exactly. A sine's hash differs between a graphics card and the processor.
const drawn = (x: number, y: number, z: number, rank: number): number => {
	const value = ((x * 7 + y * 13 + z * 5 + rank * 31 + 400) * (x * 11 + y * 3 + z * 17 + rank * 7 + 500) + 0.5) / 61;
	return value - Math.floor(value);
};
const drawnNode = (cell: Vec3, rank: number): Node =>
	fract(
		cell
			.dot(vec3(7, 13, 5))
			.add(rank * 31 + 400)
			.mul(cell.dot(vec3(11, 3, 17)).add(rank * 7 + 500))
			.add(0.5)
			.div(61),
	);
const AROUND = [-1, 0, 1].flatMap((x) => [-1, 0, 1].flatMap((y) => [-1, 0, 1].map((z): [number, number, number] => [x, y, z])));

// The plate of a model's point: the height of its middle, in plates, and its own number (0 to 1).
function plateOf(x: number, y: number, z: number): [number, number] {
	const [px, py, pz] = [x * PLATES, y * PLATES, z * PLATES];
	const [bx, by, bz] = [Math.floor(px), Math.floor(py), Math.floor(pz)];
	// Plain numbers, and the distance's square: a scaffold's 1 300 grains read 27 cells each when it is born, and a
	// list made for each cell, with a root, held that frame 34 ms (22/11).
	let nearest = Infinity;
	let height = 0;
	let cell = 0;
	for (let at = 0; at < 27; at++) {
		const cx = bx + ((at / 9) | 0) - 1;
		const cy = by + (((at / 3) | 0) % 3) - 1;
		const cz = bz + (at % 3) - 1;
		const fy = cy + 0.25 + drawn(cx, cy, cz, 2) * 0.5;
		const dx = px - (cx + 0.25 + drawn(cx, cy, cz, 1) * 0.5);
		const dy = py - fy;
		const dz = pz - (cz + 0.25 + drawn(cx, cy, cz, 3) * 0.5);
		const far = dx * dx + dy * dy + dz * dz;
		if (far >= nearest) continue;
		nearest = far;
		height = fy;
		cell = at;
	}
	return [height, drawn(bx + ((cell / 9) | 0) - 1, by + (((cell / 3) | 0) % 3) - 1, bz + (cell % 3) - 1, 4)];
}

// When the plate of a model's point goes, from 0 (the first) to 1 (the last): from the top down.
export function orderOf(x: number, y: number, z: number, span: Span, heart = false): number {
	if (heart) return HEART;
	const [height, own] = plateOf(x, y, z);
	const down = Math.min(1, Math.max(0, (span[1] * PLATES - height) / Math.max(1, (span[1] - span[0]) * PLATES)));
	return down * (1 - OWN) + own * OWN;
}

// The seconds, after a figure starts to go, at which the fill of a plate of that order goes; a figure born at 0 has it
// back at `END - fillAt(order)`.
export const fillAt = (order: number): number => SEAM + order * LAST;

// The plate of the pixel, as `plateOf`: how far its middle and the next plate's are (x, y), its middle's height, its
// own number.
const plate = Fn(([point]: [Vec3]): Vec4 => {
	const [first, second, height, own] = [float(9).toVar(), float(9).toVar(), float(0).toVar(), float(0).toVar()];
	const base = floor(point);
	for (const [dx, dy, dz] of AROUND) {
		const cell = base.add(vec3(dx, dy, dz));
		const middle = cell.add(0.25).add(vec3(drawnNode(cell, 1), drawnNode(cell, 2), drawnNode(cell, 3)).mul(0.5));
		const far = distance(point, middle);
		If(far.lessThan(first), () => {
			second.assign(first);
			first.assign(far);
			height.assign(middle.y);
			own.assign(drawnNode(cell, 4));
		}).ElseIf(far.lessThan(second), () => {
			second.assign(far);
		});
	}
	return vec4(first, second, height, own);
});

// A line is never thinner than a pixel of the drawing: from afar a thinner one blinked.
const wideOf = (scale: number, line: number): Node => {
	const pixel = fwidth(positionGeometry.mul(scale));
	return max(float(line), max(pixel.x, max(pixel.y, pixel.z)).mul(0.5));
};

// What the drawing keeps of a part's pixel, and the light it gives (0 to about 1). `time`: the town's seconds; `mark`:
// the instance's; `heart`: 1 where the pixel gives the figure's light.
export function layered(time: Node, mark: Node, span: Span, heart: Node): { kept: Node<"bool">; glow: Node } {
	const found = plate(positionGeometry.mul(PLATES));
	const down = clamp(
		float(span[1] * PLATES)
			.sub(found.z)
			.div(Math.max(1, (span[1] - span[0]) * PLATES)),
		0,
		1,
	);
	const order = mix(down.mul(1 - OWN).add(found.w.mul(OWN)), float(HEART), heart);
	const since = time.sub(abs(mark));
	const going = mix(float(END).sub(since), since, step(mark, 0));
	// The seconds since the plate's fill went: under 0 it is whole, from GRID nothing is left.
	const gone = going.sub(order.mul(LAST)).sub(SEAM);
	const burnt = clamp(gone.div(GRID), 0, 1);
	// The seam between two plates: where the pixel is as far from its plate's middle as from the next one's.
	const crack = step(found.y.sub(found.x), wideOf(PLATES, CRACK).mul(2));
	// The lattice's lines; the axis the pixel's face looks along has none on that face.
	const within = fract(positionGeometry.mul(CELLS));
	const near = min(within, vec3(1).sub(within)).add(step(vec3(0.6), abs(normalGeometry)));
	const line = step(min(near.x, min(near.y, near.z)), wideOf(CELLS, LINE).mul(float(1).sub(burnt)));
	const whole = step(gone, 0);
	// Before its fill goes, a plate's seams light up, then the plate itself brightens; after, its lattice burns away.
	const before = crack.mul(smoothstep(-SEAM, -SEAM * 0.4, gone)).add(smoothstep(-0.1, 0, gone).mul(0.45));
	const lattice = max(line, crack.mul(float(1).sub(burnt)))
		.mul(step(gone, GRID))
		.mul(float(1).sub(whole));
	const shine = heart.mul(smoothstep(-SHINE, 0, gone));
	const marked = step(0.0001, abs(mark));
	return {
		kept: marked.lessThan(0.5).or(whole.add(lattice).greaterThan(0.5)),
		glow: marked.mul(mix(lattice, max(before, shine), whole)),
	};
}
