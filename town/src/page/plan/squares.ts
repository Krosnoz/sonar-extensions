// The block of one subject: its land, its paved square, the square's furniture and its garden, in the places `PLACES` lists.
import { merge } from "../render/nodes";
import { BD, BW, b, blob, cyl, pick, rnd, type G } from "../render/shapes";
import { seat } from "../people/figures";
import { beds, fountain, kiosk, playground, pond } from "./gardens";
import { drainOf, land, lawnOf, muted } from "./street";
import { bin, lamp, planter } from "./street-furniture";

// A small tree of the square: a trunk and two crowns.
const squareTree = (x: number, z: number): G[] => [
	b("#7a5234", 0.14, 0.75, 0.14, x, 0.06, z),
	blob("#4aaa55", 0.5, x, 1.15, z),
	blob("#5fb85f", 0.34, x + 0.2, 1.45, z),
];

// A market stall: a counter with its crates, four posts and a striped canopy; 1.1 wide, 0.8 deep. Its colours stay in a
// narrow, dull range: a loud canopy and bright crates make the square noisy.
const CRATES = ["#d9b48a", "#9fb48a", "#c98a6a"];
function stall(x: number, z: number, colour: string, r: () => number): G[] {
	return [
		b("#a8703f", 1.1, 0.5, 0.4, x, 0.06, z + 0.2),
		...Array.from({ length: 3 }, (_, at) => b(pick(CRATES, r), 0.28, 0.12, 0.26, x - 0.34 + at * 0.34, 0.56, z + 0.2)),
		...[-1, 1].flatMap((dx) => [-1, 1].map((dz) => b("#6b4a30", 0.05, 1.4, 0.05, x + dx * 0.52, 0.06, z + dz * 0.34))),
		...Array.from({ length: 5 }, (_, at) => b(at % 2 ? "#f6efe2" : colour, 0.22, 0.04, 0.8, x - 0.44 + at * 0.22, 1.46, z)),
	];
}

// The places a subject can get: its furniture (0 a fountain with two benches, 1 a kiosk with a bench and two
// trees, 2 a stall and a tree in the middle, 3 a square of three trees and two benches), its garden (0 a pond, 1 beds, 2 a
// playground), its paving (chequer, stripes, large slabs), and whether the furniture of the front strip is mirrored. Each
// furniture and each garden comes three or four times, never with the same partner twice in a row.
export const PLACES = [
	{ furniture: 0, garden: 0, paving: 0, mirror: false },
	{ furniture: 1, garden: 1, paving: 1, mirror: false },
	{ furniture: 2, garden: 2, paving: 2, mirror: false },
	{ furniture: 3, garden: 0, paving: 1, mirror: false },
	{ furniture: 0, garden: 1, paving: 2, mirror: true },
	{ furniture: 1, garden: 2, paving: 0, mirror: true },
	{ furniture: 2, garden: 0, paving: 1, mirror: true },
	{ furniture: 3, garden: 1, paving: 2, mirror: true },
	{ furniture: 0, garden: 2, paving: 1, mirror: false },
	{ furniture: 1, garden: 0, paving: 2, mirror: true },
	{ furniture: 2, garden: 1, paving: 0, mirror: true },
	{ furniture: 3, garden: 2, paving: 0, mirror: false },
];

// The x of each furniture's two lamps, before the mirror (see `furniture`).
const LAMPS = [
	[-2.4, 2.4],
	[-2.3, 1.0],
	[-2.2, 2.2],
	[-2.6, 2.6],
];
// What stands in the front strip stands behind the walkers of the round (../people/grounds.ts#SQUARE, its front at z 1.85; at
// a scale of 1 a walker reaches z 2.17) and short of the kerb (z 2.56): the lamps at z 2.3, the benches at 2.36 (they
// reach 2.22 to 2.48), the bins at 2.37. At z 2.1 to 2.35, the round went through a bench, a lamp and a bin (14/11).
const [LAMP_Z, SEAT_Z, BIN_Z] = [2.3, 2.36, 2.37];
// The heads of a place's lamps, in its block: a sign keeps clear of them, as it would hide their light (../signs/signs.ts). The
// glass stands 1.66 to 1.86 high (./street-furniture.ts#lamp).
export const lampsOf = (variant: number): [number, number, number][] => {
	const { furniture: kind, mirror } = PLACES[variant]!;
	return LAMPS[kind]!.map((x) => [mirror ? -x : x, 1.76, LAMP_Z]);
};
// The square's corner trees stand at x ±5.15: at ±4.9, a walker of the round's right side (x 4.3) had its head in the
// crown. At z 1, a lamp at ±2.6 keeps off the line of their trunks and of the middle tree's (see `furniture`).
const [TREE_X, TREE_Z] = [5.15, 1];

// What stands on the square. Inside the paved square's edge (x ±5.3), clear of the doors' steps (they reach z -1.15): only
// what stands in the front strip (z > 0) follows the mirror, the planter by the steps stays where it is.
// Few things, and a lamp, a bench and a tree to read the place; the town plants the middle tree of the stall's square.
export function furniture(kind: number, mirror: boolean, r: () => number): G[] {
	const s = mirror ? -1 : 1;
	const lamps = LAMPS[kind]!.flatMap((x) => lamp(x * s, LAMP_Z, LAMP_Z));
	// The fountain stands 0.1 back from the square's middle line, a little narrower: between the round's back (z -0.82)
	// and its front, a walker at a scale of 1 keeps z -0.5 to 1.51 clear, and the whole fountain reached 1.6.
	if (kind === 0)
		return [...lamps, ...seat(-3.5 * s, SEAT_Z), ...seat(3.5 * s, SEAT_Z), ...planter(4.9, -0.75, r), ...bin(1.5 * s, BIN_Z), ...fountain(0, 0.5, 0.97)];
	// A lamp never stands on the line of a tree's trunk, in plan or from any quarter turn of the camera (the lamp is at z
	// 2.3, the trees at z 1, the neighbour square's at ±5.85): 0.8 or more away from every trunk and pit, and 0.8 or more
	// sideways from a trunk seen within 3 (1.3 from a pit seen within 2.4). Hence the lamps at ±2.2 to ±2.6, between the trees.
	if (kind === 1)
		return [
			...lamps,
			...seat(2.2 * s, SEAT_Z),
			...squareTree(-TREE_X * s, TREE_Z),
			...squareTree(TREE_X * s, TREE_Z),
			...bin(-1.6 * s, BIN_Z),
			...kiosk(0.3 * s, 0.3, r),
		];
	// The stall stands out of the round (x -2 to 4.3). On the right, it stands at the square's side, turned to face the
	// round: across the side, at x 4.3, the round went through its counter. On the left, it stands at x -4.3: further
	// in, at -3.6, it hid the row of the back-left corner (../people/figures-visible.test.ts); at the side, at -5.05, it hid the
	// round of the square on its left.
	if (kind === 2)
		return [
			...lamps,
			...(mirror ? stall(-4.3, 1.4, "#c98a6a", r) : stall(0, 0, "#c98a6a", r).map((part) => part.rotateY(-Math.PI / 2).translate(5.05, 0, 1.4))),
			...squareTree(-TREE_X * s, TREE_Z),
			...bin(-3.0 * s, BIN_Z),
			...seat(0, SEAT_Z),
			cyl("#ded6c8", 0.75, 0.8, 0.24, 0, 0.06, 0.6, 10),
			cyl("#5b3d2b", 0.62, 0.62, 0.03, 0, 0.3, 0.6, 10),
		];
	return [
		...lamps,
		...seat(-3.5 * s, SEAT_Z),
		...seat(3.5 * s, SEAT_Z),
		...squareTree(-TREE_X * s, TREE_Z),
		...squareTree(TREE_X * s, TREE_Z),
		...squareTree(0, 0.9),
		...bin(0, BIN_Z),
	];
}

// The square's paving stones, row by row, in the pattern `paving` (0 chequer, 1 stripes, 2 large slabs).
function stonesOf(paving: number, r: () => number): G[] {
	const stones: G[] = [];
	for (let ix = 0; ix < 16; ix++)
		for (let iz = 0; iz < 6; iz++) {
			const odd = paving === 0 ? (ix + iz) % 2 : paving === 1 ? ix % 2 : (Math.floor(ix / 2) + Math.floor(iz / 2)) % 2;
			stones.push(b(r() < 0.12 ? "#cdbda6" : odd ? "#e6dac8" : "#dccfbb", 0.66, 0.03, 0.65, -4.95 + ix * 0.66, 0.05, -1.03 + iz * 0.65));
		}
	return stones;
}

// The block of one subject: the land, then its paved square, its furniture and its garden, as `PLACES` says.
export function base(variant: number): G {
	const { furniture: kind, garden: gardenKind, paving, mirror } = PLACES[variant]!;
	const r = rnd(variant + 11);
	// Half of the places have the street's manhole cover.
	const out = land(r, false, false, {}, undefined, variant % 2 === 0, lawnOf(variant * 3 + 1), drainOf(variant, false));
	// The square: a base and its paving stones, in a pattern of the place (chequer, stripes, large slabs). The base reaches
	// the kerb (z 2.56): short of it by 0.01, a thread of grass showed between the two.
	out.push(b("#b9a892", 10.6, 0.05, 3.91, 0, 0, 0.605));
	out.push(...stonesOf(paving, r));
	out.push(b("#cfc4b6", BW + 0.5, 0.1, BD + 0.4, -2.1, 0, -3.3));
	out.push(...furniture(kind, mirror, r));
	// The shed of the beds stays in the block (its roof reaches z -5.5).
	const garden = gardenKind === 0 ? pond(3.35, -3.4, r) : gardenKind === 1 ? beds(3.35, -2.9, r) : playground(3.35, -3.4, r);
	out.push(...garden);
	// Stepping stones from the square to the garden, tufts of grass and flowers on the lawn.
	const steps = Array.from({ length: 4 }, (_, at) => b("#d6cbbd", 0.3, 0.03, 0.26, 1.55 + (at % 2) * 0.12, 0, -1.55 - at * 0.42));
	out.push(...steps);
	// A tuft or a flower stays out of the garden's things and of the stones: none in the pond, none through a bed.
	const taken = [...garden, ...steps].map((part) => (part.computeBoundingBox(), part.boundingBox!));
	const tufts: [number, number][] = [];
	for (let at = 0; at < 26; at++) {
		const [x, z] = [1.9 + r() * 3.4, -5.2 + r() * 0.5 + (at % 3 === 0 ? 3.4 : 0)];
		const [green, high, flower] = [
			muted(r() < 0.5 ? "#6cb058" : "#9ad97b"),
			0.08 + r() * 0.08,
			at % 4 === 0 ? pick(["#ffffff", "#ffd166", "#ff9fce"], r) : null,
		];
		const free =
			z < -1.45 &&
			!taken.some((box) => x + 0.2 > box.min.x - 0.05 && x - 0.05 < box.max.x + 0.05 && z + 0.05 > box.min.z - 0.05 && z - 0.05 < box.max.z + 0.05);
		if (!free || tufts.some(([tx, tz]) => Math.hypot(tx - x, tz - z) < 0.3)) continue;
		tufts.push([x, z]);
		out.push(b(green, 0.05, high, 0.05, x, 0, z));
		if (flower) out.push(b(flower, 0.06, 0.05, 0.06, x + 0.1, 0, z));
	}
	return merge(out);
}
