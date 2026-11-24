// A subject's building rises while the town is open: what its merges lay (./merge-floors.ts) is written on the
// building the town built, so that a town that followed a merge shows what a town opened after it shows. A storey
// laid whole keeps its instance; the roof and the sign stand over the storey being laid.
import type { World } from "./kit";
import { raisedBy } from "./merge-floors";
import type { Part } from "./parts";
import { GH, SH } from "./shapes";

type Anchor = World["anchors"][number];

// A storey laid whole: over the most a share laid is, so no net is over it (./site-net.ts#netOf).
const WHOLE = 2;
// Where an instance kept for later stands meanwhile: far under the town.
const AWAY = -4000;

// A subject's building, as the town built it (./town-blocks.ts#raise). `wall`: what each of its storeys is put with.
// `storeys`: the part of the storeys laid merge by merge; `rising`: the instance of the one being laid (-1: none).
// `roof`, `roofAt`: its roof's part and instance. `extra`: the storeys its design adds under those of its merges.
// `least`, `most`: the fewest and the most storeys its merges give it. `level`: the storeys it shows, and the share
// laid of the next. `top`: the height of its roof's foot.
export type House = {
	wall: { x: number; z: number; color: string; w: number; seed: number };
	storeys: Part;
	rising: number;
	roof: Part;
	roofAt: number;
	extra: number;
	least: number;
	most: number;
	level: number;
	top: number;
};

// The storeys `merges` give the building, and the share of the next.
export function levelOf(house: House, merges: number): number {
	const { floors, share } = raisedBy(merges, house.least, house.most);
	return floors + share;
}

// The height of the foot of its storey `storey`, the first one over its ground floor being 0.
export const footOf = (house: House, storey: number): number => 0.1 + GH + (storey + house.extra) * SH;

function write(house: House, storey: number, state: number): void {
	const given = { ...house.wall, y: footOf(house, storey), state };
	if (house.rising < 0) house.rising = house.storeys.put(given);
	// An instance put after the town's first image is sent to the graphics card once it is written again.
	house.storeys.set(house.rising, given);
}

// The building shows `level`, never less than it showed. `lifted`: the storeys under its roof, between two while the
// roof goes up. Its sign and what its sign keeps clear of follow the roof.
export function lay(house: House, anchor: Anchor, level: number, lifted = Math.ceil(level)): void {
	const whole = Math.floor(level);
	for (let storey = Math.floor(house.level); storey < whole; storey++) {
		write(house, storey, WHOLE);
		house.rising = -1;
	}
	if (level > whole) write(house, whole, level - whole);
	// The roof on its way up over a storey nothing is laid of yet: the storey's net goes up under it, as a state under 0.
	else if (lifted > whole) write(house, whole, whole - lifted);
	// The roof is back down before a brick was laid (fewer merges told, then laid at once): its net goes with it.
	else if (house.rising >= 0) house.storeys.set(house.rising, { ...house.wall, y: AWAY, state: 0 });
	house.level = level;
	const top = footOf(house, lifted);
	if (top === house.top) return;
	house.roof.set(house.roofAt, { ...house.wall, y: top });
	for (const point of [anchor.at, ...anchor.roof, ...anchor.crown]) point[1] += top - house.top;
	house.top = top;
}
