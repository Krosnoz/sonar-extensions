// One merge being laid on a subject's building (./sites.ts): its job, phase after phase. The truck comes; the crane
// aims at its pallet, reaches down, lifts it, swings it beside the storey to come and lowers it; the pallet pours its
// bricks, and the storey shows the merge's share as they land; then the crane's hook goes back up.
import { hookOf, type Crane, type Cranes } from "./crane";
import { bedOf, wheelsOf, type Deliveries, type Load, type Route } from "./delivery";
import type { HeightMap } from "../plan/heights";
import type { World } from "../render/kit";
import type { Stage } from "../people/live-steps";
import { LANDS, RATE, pourOf } from "./pouring";
import { footOf, lay, levelOf, type House } from "./rising";
import { BW, BD, SH } from "../render/shapes";
import { HOOK, LOAD } from "./site-models";
import { OVER } from "../plan/town-blocks";

type Anchor = World["anchors"][number];
// Where the crane's jib points, how far out its hook is, how far down.
type Pose = [heading: number, reach: number, drop: number];

// `empty`: the pallet pours its bricks into the storey.
type Phase = "come" | "aim" | "down" | "lift" | "swing" | "lower" | "empty" | "stay";
// The seconds the crane takes to aim at the truck, reach down, lift, swing to the storey, lower, and stay before it
// goes; the truck's coming and the pallet's emptying end on what they wait for.
const SPANS: Record<Phase, number> = { come: 0, aim: 1.2, down: 0.9, lift: 1.2, swing: 2.2, lower: 0.9, empty: 0, stay: 1.2 };
const NEXT: Record<Phase, Phase | null> = { come: "aim", aim: "down", down: "lift", lift: "swing", swing: "lower", lower: "empty", empty: "stay", stay: null };
// How far down the hook waits, and hangs while the jib swings.
export const REST = 0.7;
const HELD = 1.3;
// The merges that wait for the crane at most: the older ones are laid at once.
const WAITING = 3;
// How fast the roof goes up, a second.
const LIFTS = 3.5;

// One merge being laid: on the storey `storey`, from the share `low` to `high`, `filled` of it laid. `t`: the seconds
// in its phase; `from`: the crane's pose as the phase began. `pouring`: the town's second its bricks land from.
export type Job = { phase: Phase; t: number; from: Pose; storey: number; low: number; high: number; filled: number; pouring: number };
// `merges`: those its building shows. `carried`: the crane holds the pallet. `gone`: the seconds since its truck left,
// unloaded (-1: it has not). `lift`: how far the roof is up over a storey begun, from 0 to 1.
export type Site = {
	anchor: Anchor;
	house: House;
	route: Route;
	crane: Crane;
	load: Load;
	merges: number;
	job: Job | null;
	carried: boolean;
	gone: number;
	lift: number;
};
// A step's instant: the town's second, the seconds since the last step, and where grains and bricks fly.
export type Now = { seconds: number; dt: number; on: Stage };
// What the sites share: the parts of their cranes and of their trucks, the town's draws and its heights.
export type The = { cranes: Cranes; loads: Deliveries; random: () => number; heights: HeightMap };

const ease = (k: number): number => k * k * (3 - 2 * k);
const turnTo = (from: number, to: number): number => from + Math.atan2(Math.sin(to - from), Math.cos(to - from));
const poseOf = ({ heading, reach, drop }: Crane): Pose => [heading, reach, drop];
export const askedOf = (site: Site): number => site.anchor.topic.merges ?? 0;
// The jib's angle and reach to the point (`x`, `z`), turning the short way from `heading`.
export const towards = ({ at }: Crane, heading: number, x: number, z: number): [number, number] => [
	turnTo(heading, Math.atan2(z - at[1], x - at[0])),
	Math.hypot(z - at[1], x - at[0]),
];

// The crane's pose at the end of the job's phase: over the truck's pallet, down on it, up with it, beside the storey
// to come on the side the camera sees, down to it, then back up.
function aimOf(site: Site, job: Job): Pose {
	const { crane, house, route } = site;
	const [heading, reach, drop] = job.from;
	const parked = bedOf(wheelsOf(route, route.come, -1));
	// The height its cable starts at.
	const top = hookOf({ ...crane, drop: 0 })[1];
	switch (job.phase) {
		case "aim":
			return [...towards(crane, heading, parked[0], parked[2]), drop];
		case "down":
			return [heading, reach, top - (parked[1] + LOAD + HOOK)];
		case "lift":
			return [heading, reach, HELD];
		case "swing":
			return [...towards(crane, heading, house.wall.x + BW / 2 + 0.75, house.wall.z - 0.2), drop];
		case "lower":
			return [heading, reach, top - (footOf(house, job.storey) + SH * 0.5 + LOAD + HOOK)];
		case "stay":
			return [heading, reach, REST];
		default:
			return job.from;
	}
}

// The building shows `level`, never less than it showed, its roof over `lifted` storeys; what reads the town's heights
// follows it.
export function shows(the: The, site: Site, level: number, on: Stage, lifted?: number): void {
	const { house, anchor } = site;
	const before = house.top;
	lay(house, anchor, Math.max(house.level, level), lifted);
	if (house.top === before) return;
	on.rises(anchor.at[1] + 0.2);
	the.heights.add(house.wall.x - BW / 2, house.wall.z - BD / 2, house.wall.x + BW / 2, house.wall.z + BD / 2, anchor.at[1]);
}

// The next merge that lays something gets its job; those that lay nothing (a building at its most storeys) bring no
// truck.
export function begin(the: The, site: Site, on: Stage): void {
	const { house } = site;
	const asked = askedOf(site);
	if (asked - site.merges > WAITING) site.merges = asked - WAITING;
	shows(the, site, levelOf(house, site.merges), on);
	while (site.merges < asked && levelOf(house, site.merges + 1) <= house.level) site.merges++;
	if (site.merges >= asked) return;
	const storey = Math.floor(house.level);
	const [low, high] = [house.level - storey, levelOf(house, site.merges + 1) - storey];
	[site.job, site.lift] = [{ phase: "come", t: 0, from: poseOf(site.crane), storey, low, high, filled: low, pouring: Infinity }, 0];
	// The roof will stand over the town's top, where nothing is laid (../render/part-material.ts#built).
	on.rises(footOf(house, storey + 1) + OVER + 0.2);
}

// The pallet's bricks are laid as they land; all of them laid, the merge is in the building.
function pours(the: The, site: Site, job: Job, { seconds, dt, on }: Now): void {
	if (seconds < job.pouring) return;
	job.filled = Math.min(job.high, job.filled + RATE * dt);
	const { x, z } = site.house.wall;
	if (job.filled < job.high) {
		// The bricks are heard as they land, higher as the building rises (nine storeys at most).
		on.knock?.([x, footOf(site.house, job.storey) + job.filled * SH, z], Math.min(1, (job.storey + job.filled) / 9));
		return shows(the, site, job.storey + job.filled, on, job.storey + Math.max(site.lift, job.low > 0 ? 1 : 0));
	}
	[site.merges, site.carried, site.lift] = [site.merges + 1, false, 0];
	// The merge is in the building; the storey it ends is heard as done.
	on.hear?.(job.high >= 1 - 1e-6 ? "built" : "merged", [x, footOf(site.house, job.storey + 1), z]);
	shows(the, site, levelOf(site.house, site.merges), on);
}

// What ends with the job's phase: the hook holds the pallet, the truck leaves, the pallet pours.
function ended(the: The, site: Site, job: Job, { seconds, on }: Now): void {
	if (job.phase === "down") site.carried = true;
	if (job.phase === "lift") site.gone = 0;
	if (job.phase !== "lower") return;
	const [x, y, z] = hookOf(site.crane);
	const poured = pourOf(site.house, job.storey, [job.low, job.high], [x, y - HOOK - LOAD / 2, z], seconds, the.random);
	on.bricks(poured.grains, poured.until);
	job.pouring = seconds + LANDS;
}

// The roof goes up as the pallet comes over a storey to begin.
function lifts(the: The, site: Site, job: Job, { seconds, dt, on }: Now): void {
	if (job.low > 0 || (job.phase !== "swing" && job.phase !== "lower" && job.phase !== "empty")) return;
	site.lift += (1 - site.lift) * Math.min(1, dt * LIFTS);
	if (seconds < job.pouring) shows(the, site, site.house.level, on, job.storey + site.lift);
}

// Whether the job's phase is over: the truck is there and the crane stands, the bricks are laid, or its seconds have
// passed.
function over(site: Site, job: Job): boolean {
	if (job.phase === "come") return job.t >= site.route.come && site.crane.state === "up";
	return job.phase === "empty" ? !site.carried : job.t >= SPANS[job.phase];
}

// One step of the job: the crane goes to its phase's pose, then the next phase begins.
export function works(the: The, site: Site, job: Job, now: Now): void {
	const { crane } = site;
	// The more merges wait, the faster it goes.
	job.t += now.dt * (1 + Math.max(0, Math.min(WAITING, askedOf(site) - site.merges - 1)) * 0.4);
	const span = SPANS[job.phase];
	const k = span ? ease(Math.min(1, job.t / span)) : 0;
	const [from, aim] = [job.from, aimOf(site, job)];
	[crane.heading, crane.reach, crane.drop] = [from[0] + (aim[0] - from[0]) * k, from[1] + (aim[1] - from[1]) * k, from[2] + (aim[2] - from[2]) * k];
	lifts(the, site, job, now);
	if (job.phase === "empty") pours(the, site, job, now);
	if (!over(site, job)) return;
	ended(the, site, job, now);
	const next = NEXT[job.phase];
	site.job = next ? { ...job, phase: next, t: 0, from: poseOf(crane) } : null;
}
