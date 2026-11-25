// A row of houses along a block's street, as the town's decor builds it (../plan/city.ts).
import { merge } from "../render/nodes";
import { T, type G } from "../render/shapes";
import type { Face } from "../plan/alleys";
import { building, overhang } from "./facades";
import type { Spec } from "./facades-kit";
import type { Style } from "../../shared/styles";

// --- Buildings ---------------------------------------------------------------------------------------------------

const at = (parts: G[], x: number, z: number): G => merge(parts).translate(x, 0, z);

// What a row's houses share: the row's style, its random source, its street side, its kind and its heights, its depth,
// its end, its gate and its towers' walls.
type Row = {
	style: Style;
	r: () => number;
	z: number;
	low: number;
	high: number;
	kind: Spec["kind"];
	depth: [number, number];
	end: number;
	gate: [number, number] | undefined;
	tower: ((walls: string[], drawn: string, before?: string) => string) | undefined;
};
type Placed = { spec: Spec; x: number; w: number; gap: number };

// Between two houses: what their roofs, trims and side windows reach beyond the walls, and 0.04 of air. A house
// and its roof stay in the block: its depth is bound by the block's back edge (z = -5.4). The kinds of one row mix:
// its ends are taller and wider ("mid" in a row of houses), and a house of a row of "mid" is sometimes a small one.
const gapOf = (style: Style, own: Spec["kind"]): number => 2 * overhang(style, own).side + 0.04;
const widthOf = (r: () => number, own: Spec["kind"]): number => (own === "tower" ? 3.4 + r() * 1.6 : own === "mid" ? 3.2 + r() * 2.2 : 1.9 + r() * 1);
// A kind other than the row's has its own heights: one more storey above a row's, two fewer under a tower's.
const floorsOf = ({ low, high, kind }: Row, own: Spec["kind"]): [number, number] =>
	own === kind ? [low, high] : own === "mid" && kind === "row" ? [low + 1, high + 1] : [Math.max(1, low - 2), Math.max(1, high - 2)];

// Few and wide, as the references draw a town: a building reads from afar, its details show near. The house's kind and
// width at `x`.
function kindAt(houses: Row, x: number, first: boolean): [Spec["kind"], number] {
	const { r, kind, end, gate } = houses;
	let own = kind;
	let w = Math.min(end - 0.2 - x, widthOf(r, own));
	const reachesEnd = x + w >= end - 1.2;
	if (kind === "row" && (first || reachesEnd) && r() < 0.65) [own, w] = ["mid", Math.min(end - 0.2 - x, widthOf(r, "mid"))];
	else if (kind !== "row" && !first && !reachesEnd && r() < 0.25)
		[own, w] = [kind === "tower" ? "mid" : "row", Math.min(end - 0.2 - x, widthOf(r, kind === "tower" ? "mid" : "row"))];
	if (gate && x < gate[0]) w = Math.min(w, gate[0] - x);
	return [own, w];
}

// The house's look: its depth, its storeys (`floors` its neighbour's), its wall, trim and roof.
function specOf(houses: Row, own: Spec["kind"], w: number, gap: number, floors: number, before: Placed | undefined): Spec {
	const { style, r, z, depth, tower } = houses;
	// 0.12 more than the roof's reach: the back's windows and trims stand out of the wall.
	const deepest = z + 5.4 - overhang(style, own).depth - 0.12;
	const d = Math.min(depth[0], deepest) + r() * (Math.min(depth[1], deepest) - Math.min(depth[0], deepest));
	// A neighbour is at most one storey away, so that a row has no five storeys next to one.
	const [lowest, highest] = floorsOf(houses, own);
	const storeys = Math.min(highest, Math.max(lowest, floors + [-1, 0, 0, 1][Math.floor(r() * 4)]!));
	const drawn = style.walls[Math.floor(r() * style.walls.length)]!;
	return {
		w: w - gap,
		d,
		floors: storeys,
		wall: own === "tower" && tower ? tower(style.walls, drawn, before?.spec.wall) : drawn,
		trim: style.trims[Math.floor(r() * style.trims.length)]!,
		roof: style.roofs[Math.floor(r() * style.roofs.length)]!,
		kind: own,
		r,
	};
}

// The houses of the row, from x = -T/2 to `end`, while the town's `left` houses last.
function placeAll(houses: Row, left: { n: number }): Placed[] {
	const { r, end, gate, low, high } = houses;
	let x = -T / 2 + 0.2;
	const placed: Placed[] = [];
	let floors = low + Math.floor(r() * (high - low + 1));
	while (x < end - 1.2 && left.n > 0) {
		// No house on the gate, nor one too narrow to stand short of it.
		if (gate && x + 2.1 > gate[0] && x < gate[1]) {
			x = gate[1];
			continue;
		}
		const [own, w] = kindAt(houses, x, placed.length === 0);
		const gap = gapOf(houses.style, own);
		// Narrower, a shop's window and door no longer fit the wall.
		if (w < 1.76 || w - gap < 1.6) break;
		left.n--;
		const spec = specOf(houses, own, w, gap, floors, placed.at(-1));
		floors = spec.floors;
		placed.push({ spec, x, w, gap });
		x += w + (r() < 0.3 ? 0.4 + r() * 0.6 : 0);
	}
	return placed;
}

// The air between the house `n` and its neighbours (the row's ends are open), then the house built, its face on the
// lane and its door noted.
function built(houses: Row, placed: Placed[], n: number, doors: number[] | undefined, faces: Face[] | undefined): G {
	const { style, z } = houses;
	const { spec, x: from, w, gap } = placed[n]!;
	const [before, after] = [placed[n - 1], placed[n + 1]];
	spec.gaps = [before ? from + gap / 2 - (before.x + before.w - before.gap / 2) : Infinity, after ? after.x + after.gap / 2 - (from + w - gap / 2) : Infinity];
	const made = at(building(style, spec), from + w / 2, z - spec.d / 2);
	// A corner house's door is on its cut corner, at the end of the walk; the others' is on the front.
	const look = spec.look!;
	// What reaches into the lane: a back row's front (an awning, a neon blade or a balcony stands out of it), a front
	// row's back (its trims and its roof's eave, 0.12 out of the wall).
	if (faces)
		faces.push([
			from + gap / 2,
			from + w - gap / 2,
			z < 0 ? z + (look.ground === "shop" && look.awning ? 0.58 : style.name === "neon" ? 0.46 : 0.3) : z - spec.d - 0.12,
		]);
	if (!spec.corner) doors?.push(from + w / 2 + look.door * (look.ground === "arch" ? Math.min(0.3, spec.w * 0.12) : spec.w / 2 - 0.42));
	return made;
}

// A row of narrow houses along the street, of different widths, heights and colours, from x = -T/2 to `end`, while the
// town's `left` houses last.
// `gate` is a passage left free of houses (the lane's path crosses the front row there); `doors` receives the x of each
// front door, for the walk to reach it. `tower` gives a tower its wall among the town's (./palette.ts#towerWalls).
export function row(
	style: Style,
	r: () => number,
	z: number,
	[low, high]: [number, number],
	kind: Spec["kind"],
	depth: [number, number],
	end: number,
	left: { n: number },
	gate?: [number, number],
	doors?: number[],
	faces?: Face[],
	tower?: (walls: string[], drawn: string, before?: string) => string,
): G[] {
	const shared: Row = { style, r, z, low, high, kind, depth, end, gate, tower };
	const placed = placeAll(shared, left);
	// The last house of a front row on a corner: it cuts its corner and puts its shop's door there.
	const last = placed.at(-1);
	if (last && z > 0 && last.spec.w >= 2.6 && last.spec.floors >= 2 && last.x + last.w >= end - 1.5 && r() < 0.75) last.spec.corner = true;
	return placed.map((_, n) => built(shared, placed, n, doors, faces));
}
