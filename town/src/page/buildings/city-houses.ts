// A block of houses of a project's town (../plan/city.ts): its two rows, its
// walk along the street, the lane's path between its rows, and the lane's trees.
import type { Plan } from "../plan/city";
import type { Block } from "../plan/grid";
import { H, type G } from "../render/shapes";
import { EDGE, alongX, alongZ, crossing, sideFoot, type Rim } from "../plan/street";
import { shopPools } from "./shopfronts";
import { alleyTrees, type Face } from "../plan/alleys";
import { varied } from "./palette";
import { PER_BLOCK, zoneOf, type Zone } from "../plan/growth";
import { row } from "./house-rows";

// The gap in a block's front row where the lane's path comes down to the walk and the zebra crossing (x -0,65 to 0,65).
const GATE: [number, number] = [-0.55, 0.55];

// Whether a block lies within `reach` blocks of one of the others.
export const closeTo = (block: Block, others: Block[], reach = 1): boolean =>
	others.some((each) => Math.max(Math.abs(each.i - block.i), Math.abs(each.j - block.j)) <= reach);

// The block's two rows of houses; returns the front row's.
function rowsOf(p: Plan, block: Block, r: () => number, parts: G[], zone: Zone, end: number, doors: number[], backs: Face[], fronts: Face[]): G[] {
	const { style, left } = p;
	const deep: [number, number] = zone.kind === "tower" ? [3, 4.2] : [2.4, 3.4];
	// The blocks beside the monument keep their front row only, low: nothing hides it.
	const forecourt = block.i + block.j === 1;
	// In a city a block holds what its distance from the middle allows: the back row takes half, the front row the rest.
	const have = Math.min(left.n, p.quota.get(block) ?? 0);
	const rows = p.spreading && have < PER_BLOCK + 1 ? [{ n: Math.floor(have / 2) }, { n: have - Math.floor(have / 2) }] : [left, left];
	// The back row's doors open on the lane; the front row leaves a gate, where the lane's path goes down to the walk.
	if (!forecourt) parts.push(...row(varied(style), r, -2.2, zone.back, zone.kind, deep, end, rows[0]!, undefined, doors, backs, p.tower));
	const front = row(
		varied(style),
		r,
		2.4,
		forecourt ? [1, 2] : zone.front,
		forecourt ? "row" : zone.kind === "tower" ? "mid" : zone.kind,
		[2.2, 3.2],
		end,
		rows[1]!,
		forecourt ? undefined : GATE,
		undefined,
		fronts,
	);
	parts.push(...front);
	if (rows[0] !== left) left.n -= have - rows[0]!.n - rows[1]!.n;
	return front;
}

// Every house has a street side: the walk runs along the front, from edge to edge (to the avenue's pavement when
// there is one), and the zebra crossing leaves from it.
function walks(parts: G[], crossed: boolean, rim: Rim, doors: number[], end: number): void {
	parts.push(alongX("#ddd0c8", [-EDGE, crossed ? 2.3 : EDGE], 0.04, 0.5, 2.31));
	if (!rim.front) parts.push(...crossing());
	// The lane's path, from the back row's doors (z -2,2) to the front row's backs, and from it through the gate to the walk:
	// no door opens on the grass, and no slab lies apart.
	if (doors.length) {
		const [lo, hi] = [Math.max(-EDGE, Math.min(...doors, GATE[0]) - 0.6), Math.min(end - 0.3, Math.max(...doors, GATE[1]) + 0.6)];
		parts.push(alongX("#e4d9c6", [lo, hi], 0.03, 1.1, -1.65), alongZ("#e4d9c6", 0.8, 0.03, [-1.1, 2.06], 0));
	}
}

// The subjects stand in an old town: the blocks around them stay low, so that at every size of the town their
// buildings, signs and people show above the roofs.
export function houses(p: Plan, block: Block, r: () => number, parts: G[], crossed: boolean, rim: Rim, end: number, rank: number): void {
	const old = closeTo(block, p.subjects, p.spreading ? 2 : 1);
	const zone = zoneOf(p.growth, old || rank < 0 ? 1 : Math.min(1, rank / Math.max(1, p.built)), !!p.style.low, r);
	const doors: number[] = [];
	const [backs, fronts]: [Face[], Face[]] = [[], []];
	const front = rowsOf(p, block, r, parts, zone, end, doors, backs, fronts);
	// The last house's side wall looks out on the lawn: its foot gets a slab, joined to the walk (the avenue's pavement
	// does it where the avenue runs).
	if (front.length && !crossed) parts.push(...sideFoot(front.at(-1)!, 2.56));
	walks(parts, crossed, rim, doors, end);
	parts.push(...shopPools(front));
	// The trees stand in the lane, short of the avenue, where their crown clears both rows.
	if (zone.kind === "row")
		for (const planted of alleyTrees(r, p.style.trees.slice(0, 2), [-H + 1.2, end - 1.2], backs, fronts))
			p.trees(planted.kind).put({ x: block.x + planted.x, y: 0, z: block.z + planted.z, ry: r() * 6, s: planted.s });
}
