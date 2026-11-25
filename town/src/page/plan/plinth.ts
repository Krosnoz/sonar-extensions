// The island's plinth: the earth and the rock under every block's lawn, in strata of their own hue, their seams uneven,
// and by night a line of light along the island's top edge. The plinth was 2.7 deep in four close browns: from afar it
// shrank to a hair under the town, and by night it melted into the page (its side 1.17:1 against the background).
import type { Block } from "./grid";
import type { Kit } from "../render/kit";
import { H, T, b, rnd, type G } from "../render/shapes";

// One stratum: its colour, its top and bottom, and how far its sides stand in from the block's edge. Each one deeper
// stands further in, so that the plinth narrows towards its foot like a lump of land cut out of the ground; by 0.06 each,
// so that a seam's tongues keep 0.03 off both faces. Two blocks side by side leave twice the inset between their strata:
// at 0.9 for the foot, the plinth read as separate slabs.
type Stratum = { hex: string; top: number; bottom: number; inset: number };
const STRATA: Stratum[] = [
	{ hex: "#7b5136", top: -0.2, bottom: -0.9, inset: 0 },
	{ hex: "#9a6a43", top: -0.9, bottom: -1.9, inset: 0.06 },
	{ hex: "#b58a62", top: -1.9, bottom: -2.7, inset: 0.12 },
	{ hex: "#8f8780", top: -2.7, bottom: -3.8, inset: 0.18 },
	{ hex: "#736b65", top: -3.8, bottom: -4.6, inset: 0.24 },
	{ hex: "#5b5450", top: -4.6, bottom: -5.2, inset: 0.3 },
];
// The plinth's foot: the camera keeps it on the screen (./town.ts#seenOf), and the town rises from it (../render/part-material.ts#built).
export const BOTTOM = STRATA.at(-1)!.bottom;

const STONES = ["#8b8580", "#a19a92", "#77706a", "#928a84"];

// A box on a face the camera sees (+z for side 0, +x for side 1): `u` runs along it, its outer face `out` from the
// block's middle.
const onFace = (side: number, hex: string, w: number, h: number, u: number, y: number, out: number): G =>
	side ? b(hex, 0.14, h, w, out - 0.07, y, u) : b(hex, w, h, 0.14, u, y, out - 0.07);

// The strata under the lawn. `first` lays the top one (a block the water crosses cuts its trench into it).
export function strata(first: (hex: string, y: number, h: number) => G[]): G[] {
	const [top, ...deeper] = STRATA;
	return [
		...first(top!.hex, top!.bottom, top!.top - top!.bottom),
		...deeper.map((s) => b(s.hex, T - 2 * s.inset, s.top - s.bottom, T - 2 * s.inset, 0, s.bottom, 0)),
	];
}

// What a face the camera sees shows of the strata: their uneven seams and their stones. `inNotch` says whether a
// stretch of the face lies where a trench opens, where nothing may hang in the air. It takes from the block's draws
// `r` the 50 the earth's stones took before the strata, no more: the houses and the trees drawn after them stay where
// they stood. The seams draw from a sequence of their own, seeded by the first of those.
export function face(side: number, r: () => number, inNotch: (from: number, to: number) => boolean): G[] {
	const draws = Array.from({ length: 50 }, () => r());
	const own = rnd(Math.floor(draws[0]! * 1e6));
	const out: G[] = [];
	// The seams are uneven: the stratum above hangs over the one below in tongues of its own colour, halfway between
	// their two faces, so that no face lies in the plane of another (two faces at one depth blink as the town moves).
	for (let k = 1; k < STRATA.length - 1; k++) {
		const [above, below] = [STRATA[k]!, STRATA[k + 1]!];
		const edge = H - below.inset;
		for (let u = -edge + 0.2; u < edge - 0.5;) {
			const w = Math.min(0.5 + own() * 0.9, edge - 0.2 - u);
			const len = 0.1 + own() * own() * 0.45;
			if (own() < 0.6 && !inNotch(u, u + w))
				out.push(onFace(side, above.hex, w, len + 0.05, u + w / 2, above.bottom - len, H - (above.inset + below.inset) / 2));
			u += w;
		}
	}
	// Ten stones in the earth and the rock, big enough to stay whole from afar. Each stands 0.04 out of the furthest face
	// it crosses. A stone that would cover another is left out: two faces at one depth, of two colours.
	const laid: [number, number, number, number][] = [];
	for (let at = 0; at < 10; at++) {
		const drawn = (n: number): number => draws[at * 5 + n]!;
		const [dy, dk, dw, dh, dAlong] = [drawn(0), drawn(1), drawn(2), drawn(3), drawn(4)];
		const [y, hex, w, h, u] = [-4.5 + dy * 3.5, STONES[Math.floor(dk * STONES.length)]!, 0.45 + dw * 0.75, 0.24 + dh * 0.2, (dAlong - 0.5) * (T - 2.2)];
		if (laid.some(([lo, hi, bottom, up]) => u - w / 2 < hi && u + w / 2 > lo && y < up && y + h > bottom) || inNotch(u - w / 2, u + w / 2)) continue;
		laid.push([u - w / 2, u + w / 2, y, y + h]);
		const crossed = STRATA.filter((s) => y < s.top && y + h > s.bottom);
		out.push(onFace(side, hex, w, h, u, y, H + 0.04 - Math.min(...crossed.map((s) => s.inset))));
	}
	return out;
}

// By night the island's top edge carries a line of moonlight, along the face of the lawn's lip on every side where no
// block is beyond: unlit, the edge was 1.45:1 against the page's dark background, and the island's shape was lost.
// The line runs from just inside the block's edge to 0.01 out of the lip's face (0.09 past the edge where the island
// ends), never in the plane of a face: a subject's block has no lip, a street's block has one.
const MOON = "#c8dcb4";
const MID = H + 0.045;
// The line along an x side (`dx` set) or a z side.
const moonLine = (dx: number, dz: number): G =>
	dx ? b("#ffffff", 0.11, 0.17, T + 0.2, dx * MID, -0.185, 0, 1) : b("#ffffff", T + 0.2, 0.17, 0.11, 0, -0.185, dz * MID, 1);
// The four sides of a block, and a side's place among them.
const SIDES = [
	[1, 0],
	[-1, 0],
	[0, 1],
	[0, -1],
] as const;
const sideOf = (dx: number, dz: number): number => SIDES.findIndex(([x, z]) => x === dx && z === dz);
// A line waits with the land it runs along (../arrival/delays.ts). The block held for a subject to come keeps its lines while
// its ground changes hands (../sites/plot-mask.ts): the edge of the land is the same before and after.
const EDGE = { glow: 0.55, shadow: false, still: true, waits: "land", plot: "kept" } as const;
// A line is a model per side, put where its block stands: the front builds a part where it is put (../render/parts.ts). One
// model for two sides, put a block away for the left and the far ones, was drawn alone on the page a block before its
// land, or a block after.
export function edgeLight(kit: Kit, blocks: Block[]): void {
	if (!kit.night) return;
	const at = new Set(blocks.map(({ x, z }) => `${Math.round(x / T)},${Math.round(z / T)}`));
	const open = blocks.flatMap(({ x, z }) =>
		SIDES.filter(([dx, dz]) => !at.has(`${Math.round(x / T) + dx},${Math.round(z / T) + dz}`)).map(([dx, dz]) => ({ x, z, dx, dz })),
	);
	const lines = SIDES.map(([dx, dz]) => kit.part(moonLine(dx, dz), open.length, EDGE));
	for (const { x, z, dx, dz } of open) lines[sideOf(dx, dz)]!.put({ x, y: 0, z, color: MOON });
	footLight(kit, open);
}

// By night the foot's edge catches the moonlight too: the deeper strata are darker than the lawns, and the foot stood
// at 1.03:1 against the page; lighter strata to 3:1 would have outshone the lawns. The line runs along the foot's
// face, 0.045 out of it, a block's length long and 0.045 past the foot's corner; between two blocks whose side is
// open, a bridge spans the gap their insets leave. It is 0.4 high: at 0.3, 2 px from the whole town's view, a line
// that fell across two rows of pixels stood at 2.9:1.
const FOOT = STRATA.at(-1)!;
const FOOT_OUT = H - FOOT.inset + 0.045;
const FOOT_HIGH = 0.4;
const FOOT_LONG = T - 2 * FOOT.inset + 0.09;
// A block's side: its block and the way it faces.
const sideKey = (x: number, z: number, dx: number, dz: number): string => `${Math.round(x / T)},${Math.round(z / T)},${dx},${dz}`;
// The foot's line along an x side (`dx` set) or a z side, `long` long, its middle at `u` along it.
const footLine = (dx: number, dz: number, long: number, u: number): G =>
	dx ? b("#ffffff", 0.11, FOOT_HIGH, long, dx * FOOT_OUT, BOTTOM, u, 1) : b("#ffffff", long, FOOT_HIGH, 0.11, u, BOTTOM, dz * FOOT_OUT, 1);
function footLight(kit: Kit, open: { x: number; z: number; dx: number; dz: number }[]): void {
	const sides = new Set(open.map(({ x, z, dx, dz }) => sideKey(x, z, dx, dz)));
	// The next block along a side (+z along an x side, +x along a z side) with the same side open.
	const bridged = open.filter(({ x, z, dx, dz }) => sides.has(sideKey(x + (dx ? 0 : T), z + (dx ? T : 0), dx, dz)));
	for (const [long, u, where] of [
		[FOOT_LONG, 0, open],
		[2 * FOOT.inset - 0.09, H, bridged],
	] as const) {
		const lines = SIDES.map(([dx, dz]) => kit.part(footLine(dx, dz, long, u), where.length, EDGE));
		for (const { x, z, dx, dz } of where) lines[sideOf(dx, dz)]!.put({ x, y: 0, z, color: MOON });
	}
}
