// What a subject's quarter is built of, where its crowd spills (./quarters.ts): venues, each a whole block paved for its
// crowd, side by side along their street (./layout.ts#spilledOn), joined into long esplanades with a darker stone edge,
// few and dense. Squares as the subject's own, about ten agents each, took half of a town of 1 000 agents and made a
// plain of 1 224 squares of a town of 10 000; venues of a block among the town's houses left a chequer of empty lawns
// (both tried and shown side by side, 14/11). A small crowd has a court: a paving of its size on the block's lawn
// (../people/grounds.ts#COURTS).
// City builders lay their crowds the same way: on ground laid for them inside the town (Cities: Skylines' pedestrian
// areas, colossalorder.fi "Plazas & Promenades dev diary 1"), dense only where paths are (Planet Coaster, gamedeveloper.com
// "Creating believable crowds in Planet Coaster").
import { PAVED_TO, SLAB, VENUE } from "../people/grounds";
import type { Block, Grid } from "./grid";
import type { HeightMap } from "./heights";
import type { Agent, Kit } from "../render/kit";
import { merge } from "../render/nodes";
import { blocksOf, venueOf } from "./quarters";
import { b, rnd, type G } from "../render/shapes";
import { drainOf, land, lawnOf } from "./street";
import { bench, lamp, planter } from "./street-furniture";

// The back lamps of a venue, behind its last row: they hide no one, and light its back by night.
const BACK: [number, number][] = [
	[-5, -5.15],
	[5, -5.15],
];
// A venue's paving: from the block's back to its kerb, and to the block's sides, where it meets the venue beside it.
const [WIDE, FROM, TO] = [11, -5.5, 2.56];
// Its slabs, large as an esplanade's: how many across.
const COLS = 11;

// A venue: the block's lawn and street, its paving within a darker edge, its lamps. A court (`paved`: its slabs across
// and deep) is paved at the block's front only; behind it on the lawn, a bench and two planters, too low to hide anyone
// of the block behind.
function venue(n: number, paved?: [number, number]): G {
	const r = rnd(n + 71);
	const out = land(r, false, false, {}, undefined, n % 2 === 0, lawnOf(n * 5 + 2), drainOf(n, false));
	const [cols, rows] = paved ?? [COLS, Math.floor((TO - FROM - 0.3) / SLAB)];
	const [wide, from] = paved ? [cols * SLAB + 0.66, PAVED_TO - rows * SLAB - 0.15] : [WIDE, FROM];
	out.push(b("#a89780", wide, 0.05, TO - from, 0, 0, (TO + from) / 2));
	for (let ix = 0; ix < cols; ix++)
		for (let iz = 0; iz < rows; iz++) {
			const odd = (Math.floor(ix / 2) + iz) % 2;
			out.push(
				b(
					r() < 0.12 ? "#cdbda6" : odd ? "#e6dac8" : "#dccfbb",
					SLAB - 0.04,
					0.03,
					SLAB - 0.04,
					(ix - (cols - 1) / 2) * SLAB,
					0.05,
					from + 0.15 + (iz + 0.5) * SLAB,
				),
			);
		}
	for (const x of VENUE.lamps!) out.push(...lamp(x, 2.1));
	if (paved) out.push(...bench(0, from - 0.5), ...planter(-wide / 2 + 0.4, from - 0.55, r), ...planter(wide / 2 - 0.4, from - 0.55, r));
	else for (const [x, z] of BACK) out.push(...lamp(x, z));
	return merge(out);
}

// Builds the blocks of the subjects' quarters, each paved for the crowd that stands on it (`quarters`, ./quarters.ts),
// and records their lamps' heads, which a sign keeps clear of.
export function quartersBuilt(kit: Kit, grid: Grid, quarters: Agent[][][], heights: HeightMap): void {
	const kinds = new Map<string, { paved?: [number, number]; blocks: Block[] }>();
	quarters.forEach((squares, index) =>
		blocksOf(grid, index)
			.slice(1)
			.forEach((block, at) => {
				const { paved } = venueOf(squares[at + 1]!);
				const kind = kinds.get(String(paved)) ?? { ...(paved ? { paved } : {}), blocks: [] };
				kinds.set(String(paved), kind);
				kind.blocks.push(block);
			}),
	);
	for (const { paved, blocks } of kinds.values()) {
		// Two models, so that the lawn and the drains change from block to block.
		const models = [0, 1].map((n) => kit.part(venue(n, paved), blocks.length, { still: true }));
		blocks.forEach(({ x, z }, at) => {
			models[at % 2]!.put({ x, y: 0, z });
			const heads = [...VENUE.lamps!.map((lx): [number, number] => [lx, 2.1]), ...(paved ? [] : BACK)];
			for (const [lx, lz] of heads) heights.lamps.push([x + lx, 1.76, z + lz]);
		});
	}
}
