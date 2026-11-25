// A tower crane by a subject's building, for the merges laid on it (./sites.ts). Its mast is born a length after the
// other from the ground, then its jib; it goes from its jib down. It is born and goes in layers, its matter from the
// building's door and back to it, as a scaffold (./scaffolds.ts).
import type { Kit } from "../render/kit";
import { playLayers } from "../people/layer-play";
import type { Stage } from "../people/live-steps";
import { SH } from "../render/shapes";
import { CRANE, cable, hook, jib, mast } from "./site-models";
import { STATE } from "../people/state-colours";

type Point = [number, number, number];

// Far under the town: what waits there shows nowhere.
const AWAY = { x: 0, y: -4000, z: 0 };
// The mast's foot, the most lengths it has, and how far over a roof's foot its jib turns.
const [GROUND, LENGTHS, CLEAR] = [0.08, 16, 3.4];
// The seconds between two lengths of a mast born or going.
const STAGGER = 0.12;
// The grains of a lattice's cell: a figure's count made a wall of sparks (../people/layer-grains.ts).
const DENSE = 0.07;
// How far under the jib's foot its cable starts.
const UNDER = 0.12;

// `state`: not there, being born until `until`, there, going until `until`. `segments`, `jib`, `cable`, `hook`: its
// instances (none before it first stands). `at`: its mast's foot. `lengths`: those of its mast now. `heading`, `reach`,
// `drop`: where its jib points (an angle on the ground), how far out its hook is, how far down. `waits`: the lengths
// of its mast still to be born or to go, each with the town's second of its turn.
export type Crane = {
	state: "none" | "coming" | "up" | "going";
	until: number;
	waits: [at: number, play: () => void][];
	segments: number[];
	jib: number;
	cable: number;
	hook: number;
	at: [number, number];
	lengths: number;
	heading: number;
	reach: number;
	drop: number;
};

export const craneAt = (x: number, z: number): Crane => ({
	state: "none",
	until: 0,
	waits: [],
	segments: [],
	jib: -1,
	cable: -1,
	hook: -1,
	at: [x, z],
	lengths: 0,
	heading: 0,
	reach: 0,
	drop: 0,
});
// The lengths of a mast whose jib turns over a roof's foot at `high`.
const lengthsFor = (high: number): number => Math.min(LENGTHS, Math.ceil((high + CLEAR - GROUND) / SH));
// Whether its jib turns over a roof's foot at `high`: a crane that does not stand yet will.
export const clears = (crane: Crane, high: number): boolean => crane.state === "none" || crane.lengths >= lengthsFor(high);
// The height of its jib's foot, and where its hook hangs.
const jibOf = (crane: Crane): number => GROUND + crane.lengths * SH;
export const hookOf = (crane: Crane): Point => [
	crane.at[0] + Math.cos(crane.heading) * crane.reach,
	jibOf(crane) + UNDER - crane.drop,
	crane.at[1] + Math.sin(crane.heading) * crane.reach,
];

// The parts that hold every subject's crane, and the models its layers are read from.
function partsOf(kit: Kit, count: number) {
	const layers = { layers: true } as const;
	const models = { mast: mast(), jib: jib() };
	return {
		models,
		masts: kit.part(models.mast, count * LENGTHS, layers),
		jibs: kit.part(models.jib, count, { ...layers, glow: 0.6 }),
		cables: kit.part(cable(), count, { ...layers, shadow: false }),
		hooks: kit.part(hook(), count, layers),
	};
}
type Parts = ReturnType<typeof partsOf>;

// Its jib, its cable and its hook, each in its part.
const upperOf = ({ jibs, cables, hooks }: Parts, crane: Crane) => [[jibs, crane.jib] as const, [cables, crane.cable] as const, [hooks, crane.hook] as const];

// Its instances, put the first time it stands: a part without an instance is not drawn (../render/parts.ts).
function made({ masts, jibs, cables, hooks }: Parts, crane: Crane): void {
	if (crane.jib >= 0) return;
	crane.segments = Array.from({ length: LENGTHS }, () => masts.put(AWAY));
	[crane.jib, crane.cable, crane.hook] = [jibs.put({ ...AWAY, color: STATE[1]!, state: 1 }), cables.put(AWAY), hooks.put(AWAY)];
}

// Its jib, its cable and its hook, where they are now.
function pose({ jibs, cables, hooks }: Parts, crane: Crane): void {
	if (crane.state === "none") return;
	const [x, y, z] = hookOf(crane);
	jibs.set(crane.jib, { x: crane.at[0], y: jibOf(crane), z: crane.at[1], ry: -crane.heading });
	cables.set(crane.cable, { x, y: jibOf(crane) + UNDER, z, s: [1, crane.drop, 1] });
	hooks.set(crane.hook, { x, y, z, ry: -crane.heading });
}

function hide(parts: Parts, crane: Crane): void {
	[crane.state, crane.waits] = ["none", []];
	if (crane.jib < 0) return;
	for (const [part, index] of [...crane.segments.map((each) => [parts.masts, each] as const), ...upperOf(parts, crane)]) {
		part.set(index, AWAY);
		part.mark(index, 0);
	}
}

// The lengths of its mast whose turn has come are born, or go.
function due(crane: Crane, seconds: number): void {
	const now = crane.waits.filter(([at]) => at <= seconds);
	crane.waits = crane.waits.filter(([at]) => at > seconds);
	for (const [, play] of now) play();
}

// Born, it stands; gone, it is hidden.
function settle(parts: Parts, crane: Crane, seconds: number): void {
	due(crane, seconds);
	if (crane.state === "going" && seconds >= crane.until) hide(parts, crane);
	if (crane.state !== "coming" || seconds < crane.until) return;
	crane.state = "up";
	for (const each of crane.segments.slice(0, crane.lengths)) parts.masts.mark(each, 0);
	for (const [part, index] of upperOf(parts, crane)) part.mark(index, 0);
}

// What stands, moves and hides a crane, in the parts that hold every subject's.
export function cranes(kit: Kit, count: number) {
	const parts = partsOf(kit, count);
	const { masts, jibs, cables, hooks, models } = parts;
	return {
		pose: (crane: Crane): void => pose(parts, crane),
		hide: (crane: Crane): void => hide(parts, crane),
		settle: (crane: Crane, seconds: number): void => settle(parts, crane, seconds),
		// It is born at the town's second `seconds`, high enough for a roof's foot at `high`, or goes from it. Its matter
		// comes from `door`, or goes back to it.
		stand(crane: Crane, born: boolean, high: number, seconds: number, door: Point, on: Stage): void {
			made(parts, crane);
			if (born) crane.lengths = lengthsFor(high);
			const [x, z] = crane.at;
			const shared = { tint: CRANE, parent: door, dense: DENSE };
			for (let each = 0; each < crane.lengths; each++) {
				const stand = { x, y: GROUND + each * SH, z, ry: 0, s: 1 };
				const at = seconds + (born ? each : crane.lengths - each) * STAGGER;
				// Each length makes its grains at its turn: a mast's, all made as it began, froze that frame (0.1 s for one
				// crane, 22/11).
				crane.waits.push([
					at,
					() => {
						if (born) masts.set(crane.segments[each]!, stand);
						playLayers({ ...shared, part: masts, index: crane.segments[each]!, model: models.mast, stand }, born, at, on, kit.random);
					},
				]);
			}
			due(crane, seconds);
			const at = seconds + (born ? crane.lengths * STAGGER : 0);
			crane.state = born ? "coming" : "going";
			pose(parts, crane);
			const top = { x, y: jibOf(crane), z, ry: -crane.heading, s: 1 };
			playLayers({ ...shared, part: jibs, index: crane.jib, model: models.jib, stand: top }, born, at, on, kit.random);
			playLayers({ ...shared, part: cables, index: crane.cable, model: null, stand: top }, born, at, on, kit.random);
			const ends = playLayers({ ...shared, part: hooks, index: crane.hook, model: null, stand: top }, born, at, on, kit.random);
			crane.until = ends + (born ? 0 : crane.lengths * STAGGER + 0.2);
		},
	};
}
export type Cranes = ReturnType<typeof cranes>;
