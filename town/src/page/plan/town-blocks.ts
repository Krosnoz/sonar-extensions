// What the town's blocks carry (./town.ts): the parts they are built of, a subject's building with its trees and its
// terrace.
import { terrace, tree } from "../people/figures";
import type { Block } from "./grid";
import { ground } from "../buildings/ground-floor";
import type { Kit, Topic, World } from "../render/kit";
import { designsOf, styleOf } from "../buildings/designs";
import { PARASOLS, looksOf, type Look } from "../buildings/looks";
import { floorsBy, raisedBy } from "../sites/merge-floors";
import type { House } from "../sites/rising";
import { FLATS, MANSARDS, crownOf, roof } from "../buildings/roofs";
import { GH, SH } from "../render/shapes";
import { PLACES, base } from "./squares";
import type { Steps } from "../render/steps";
import { MODERNS, STOREYS, storey } from "../buildings/storeys";

export type Anchor = World["anchors"][number];

// Where a subject's building stands in its block.
export const [BX, BZ] = [-2.1, -3.3];
// The most storeys a subject's building has: nine by its merges, or seven and two more in a city (../buildings/designs.ts).
const MOST = 9;

// `places`: the places to build, those the town's subjects drew (all of them when omitted). `squares`: the squares of
// the subjects' quarters (./quarters.ts). None of them moves (../render/still-parts.ts).
// A step a kind of part (../render/steps.ts), in the same order: each builds its models and their materials.
const step = function* <T>(make: () => T): Steps<T> {
	const made = make();
	yield;
	return made;
};
// `live`: the storeys a subject's merges may lay on its building while the town is open (../sites/rising.ts); none in a city.
export function* partsOf(kit: Kit, topics: number, places = PLACES.map((_, variant) => variant), live = MOST) {
	// What stands on the block's ground waits for its points (../arrival/delays.ts).
	const still = { still: true, waits: "ground" } as const;
	// The building itself, from its ground floor up, which its bricks build: not its base nor its trees.
	const house = { still: true, waits: "building" } as const;
	// The building's roof, which a storey laid under it lifts (../sites/rising.ts#lay): it moves, so it is not merged.
	const lifted = { waits: "building" } as const;
	// The ground itself: its lawn and its street reach past the block's edge.
	const land = { still: true, waits: "land" } as const;
	return {
		bases: yield* step(() => new Map(places.map((variant) => [variant, kit.part(base(variant), topics, land)] as const))),
		grounds: yield* step(() => [0, 1, 2].map((style) => kit.part(ground(style), topics, house))),
		storeys: yield* step(() => Array.from({ length: STOREYS }, (_, style) => kit.part(storey(style), topics * MOST, house))),
		// The storey to come of each building, of which its merges have laid a share (../sites/merge-floors.ts), and those laid
		// since the town opened.
		rising: yield* step(() => Array.from({ length: STOREYS }, (_, style) => kit.part(storey(style), topics * live, { ...lifted, rises: true }))),
		roofs: yield* step(() => [0, 1, 2].map((style) => kit.part(roof(style), topics, lifted))),
		trees: yield* step(() => [0, 1, 2].map((kind) => kit.part(tree(kind), topics * 3, still))),
		terraces: yield* step(() => kit.part(terrace(), topics * 2, still)),
		// The flat roofs after the first one, which is `roofs[1]`.
		flats: yield* step(() => Array.from({ length: FLATS - 1 }, (_, at) => kit.part(roof(1, at + 1), topics, lifted))),
		// The mansards after the first tone, which is `roofs[0]`.
		mansards: yield* step(() => Array.from({ length: MANSARDS.length - 1 }, (_, at) => kit.part(roof(0, at + 1), topics, lifted))),
	};
}
export type Parts = ReturnType<typeof partsOf> extends Steps<infer Made> ? Made : never;

// A subject's block: its square, its building, its trees and its terrace. Returns where its sign stands.
// `least`: the fewest storeys a subject's building has. In a city its neighbours rise to four, and its quarter reads from
// afar only if the subjects' buildings stand above them: each has seven, and its design's storeys tell it from the
// others. Elsewhere its merges give its storeys (../sites/merge-floors.ts).
// `design`: its traits among the town's subjects (../buildings/designs.ts); alone, those the first subjects of its style take.
export const floorsOf = (topic: Topic, least: number): number => floorsBy(topic.merges ?? 0, least, least > 6 ? least : MOST);

// The building's roof: a flat one or a mansard of its own tone after the first, or the style's.
function roofOf(parts: Parts, look: Look, kind: number): ReturnType<Kit["part"]> {
	const shaped = kind === 1 && look.flat > 0 ? parts.flats[look.flat - 1] : kind === 0 && look.tone > 0 ? parts.mansards[look.tone - 1] : undefined;
	return shaped ?? parts.roofs[kind]!;
}

// The block has room only for small trees: in the strip between the building and the garden, and in the garden's back
// corner. A crown of 1.5 would enter the building, the pond or the beds, or leave the block.
function plant(kit: Kit, parts: Parts, place: (typeof PLACES)[number], index: number, x: number, z: number): void {
	const spots: [number, number, number, number, number][] =
		place.garden === 0
			? [
					[1.65, -4.85, 0, 0.52, 0.06],
					[5, -4.9, index % 2 ? 2 : 1, 0.48, 0.05],
				]
			: place.garden === 1
				? [[1.4, -4.95, 1, 0.55, 0.06]]
				: [[1.25, -4.95, 1, 0.34, 0.03]];
	for (const [dx, dz, kind, size, spread] of spots)
		parts.trees[kind]!.put({ x: x + dx, y: 0, z: z + dz, ry: kit.random() * 6, s: size + kit.random() * spread });
	if (place.furniture === 2) parts.trees[index % 2 ? 0 : 2]!.put({ x, y: 0.33, z: z + 0.6, ry: kit.random() * 6, s: 0.8 });
}

// How far over its roof's foot a building's sign stands.
export const OVER = 1.6;

// Where the sign stands: over the building's middle, and the points of its roof a sign keeps clear of.
function anchorOf(topic: Topic, index: number, look: Look, kind: number, top: number, x: number, z: number): Anchor {
	const { surface, tops, bare } = crownOf(kind, kind === 1 ? look.flat : kind === 0 ? look.tone : 0);
	const [cx, cz] = [x + BX, z + BZ];
	const crown = tops.map(([dx, dy, dz]): [number, number, number] => [cx + dx, top + dy, cz + dz]);
	const roofs = (bare.length ? bare : [[0, 0] as [number, number]]).map(([dx, dz]): [number, number, number] => [cx + dx, top + surface, cz + dz]);
	return { at: [cx, top + OVER, cz], roof: roofs, crown, topic, index };
}

export function raise(
	kit: Kit,
	parts: Parts,
	topic: Topic,
	index: number,
	{ x, z }: Block,
	look: Look = looksOf([topic])[0]!,
	least = 1,
	design = designsOf(
		Array.from({ length: index + 1 }, () => look),
		Array.from({ length: index + 1 }, () => floorsOf(topic, least)),
		false,
	)[index]!,
): { anchor: Anchor; house: House } {
	const place = PLACES[look.place]!;
	const style = styleOf(index);
	parts.bases.get(look.place)!.put({ x, y: 0, z });
	const count = topic.agents.length;
	const most = least > 6 ? least : MOST;
	const raised = raisedBy(topic.merges ?? 0, least, most);
	const floors = raised.floors + design.extra;
	const busy = topic.agents.filter((agent) => agent.state === 1).length / Math.max(1, count);
	const wall = { x: x + BX, z: z + BZ, color: design.tint, w: busy, seed: kit.random() };
	const model = style === 2 ? MODERNS[look.modern]! : style;
	parts.grounds[design.ground]!.put({ ...wall, y: 0.1 });
	for (let floor = 0; floor < floors; floor++) parts.storeys[model]!.put({ ...wall, y: 0.1 + GH + floor * SH });
	// The storey to come stands under the roof from its first merge: the roof is over what is laid of it.
	const storeys = parts.rising[model]!;
	const rising = raised.share > 0 ? storeys.put({ ...wall, y: 0.1 + GH + floors * SH, state: raised.share }) : -1;
	const top = 0.1 + GH + (floors + (raised.share > 0 ? 1 : 0)) * SH;
	const kind = design.roof;
	const roofs = roofOf(parts, look, kind);
	const house: House = {
		wall,
		storeys,
		rising,
		roof: roofs,
		roofAt: roofs.put({ ...wall, y: top }),
		extra: design.extra,
		least,
		most,
		level: raised.floors + raised.share,
		top,
	};
	plant(kit, parts, place, index, x, z);
	// One table with its parasol (its chairs reach 0.62), always on the right, inside the walkers' round (../people/inhabitants.ts):
	// between the right run of those who stand (it ends at x 2.3) and the side lane (x 4), behind the front lane and the
	// lamps (z 1.7 and 2.1), in front of the back lane (z -0.5); back to z 0.4 when a stall stands on the right (its posts
	// at z 1.06). On the left, or at x 2.7, a lamp stood among its chairs and the rows of those who stand reached under its
	// parasol; this far forward its parasol hides fewer of them from the camera.
	const stall = place.furniture === 2 && !place.mirror;
	parts.terraces.put({ x: x + 3.2, y: 0.08, z: z + (stall ? 0.4 : 0.9), ry: kit.random() * 3, color: PARASOLS[index % PARASOLS.length]! });
	return { anchor: anchorOf(topic, index, look, kind, top, x, z), house };
}
