// A merge of a subject is laid on its building while the town is open. A tower crane stands by the building and a
// truck comes by the street with a pallet of bricks; the crane takes the pallet up, and the pallet pours its bricks
// into the storey to come: the share of that storey the merge lays (./merge-floors.ts). The roof and the sign go up
// with a new storey. Then the truck and the crane go. One truck at a time: the next merges wait (./site-jobs.ts).
// Nothing is made up: a truck comes for a merge the server counted (./sources.ts#wantedOf), never for a pull request
// that closed without one, and the town stays read only. With motion reduced, or for what changed while the town was
// not looked at, the building shows its merges at once. A town that followed a merge shows what a town opened after
// it shows (./rising.ts).
import { clears, craneAt, cranes, hookOf } from "./crane";
import { bedOf, deliveries, loadOf, routeOf, wheelsOf, type Wheels } from "./delivery";
import type { Grid } from "./grid";
import type { HeightMap } from "./heights";
import type { Kit, World } from "./kit";
import type { Stage } from "./live-steps";
import { footOf, levelOf, type House } from "./rising";
import { BD, BW } from "./shapes";
import { REST, askedOf, begin, shows, towards, works, type Now, type Site, type The } from "./site-jobs";
import { HOOK, LOAD } from "./site-models";

type Anchor = World["anchors"][number];
type Point = [number, number, number];

// The door of a site's building: where the matter of its crane comes from and goes back to.
const doorOf = ({ house }: Site): Point => [house.wall.x, 0.5, house.wall.z + BD / 2];
// The height of the roof's foot once every merge told is laid: the crane's jib turns over it.
const highOf = (site: Site): number => footOf(site.house, Math.ceil(levelOf(site.house, askedOf(site))));

function siteOf(anchor: Anchor, house: House, grid: Grid): Site {
	// The crane stands by the side of the building the camera sees, near its front corner.
	const crane = craneAt(house.wall.x + BW / 2 + 0.45, house.wall.z + BD / 2 - 0.45);
	const merges = anchor.topic.merges ?? 0;
	return { anchor, house, route: routeOf(grid, anchor.index), crane, load: loadOf(house.wall.color), merges, job: null, carried: false, gone: -1, lift: 0 };
}

// Its merges are there at once, and nothing of a job is left.
function settle(the: The, site: Site, on: Stage): void {
	[site.merges, site.job, site.carried, site.gone, site.lift] = [Math.max(site.merges, askedOf(site)), null, false, -1, 0];
	shows(the, site, levelOf(site.house, site.merges), on);
	the.cranes.hide(site.crane);
	the.loads.truck(site.load, null);
	the.loads.pallet(site.load, null);
}

// The crane stands while a merge is laid or waits, and until its truck is gone. Too short for the merges that came
// since it stood, it goes, and stands again higher.
function stands(the: The, site: Site, { seconds, on }: Now): void {
	const { crane, house } = site;
	const wanted = site.job !== null || site.gone >= 0 || askedOf(site) > site.merges;
	the.cranes.settle(crane, seconds);
	if (crane.state === "none" && wanted) {
		// At rest, its hook hangs over the building.
		[crane.heading, crane.reach, crane.drop] = [...towards(crane, 0, house.wall.x - 0.4, house.wall.z - 0.2), REST];
		the.cranes.stand(crane, true, highOf(site), seconds, doorOf(site), on);
	} else if (crane.state === "up" && !site.job && (!wanted || !clears(crane, highOf(site)))) the.cranes.stand(crane, false, 0, seconds, doorOf(site), on);
}

// Where the truck is: it comes loaded, waits by the kerb until the crane has lifted its pallet, then leaves.
function wheelsFor({ job, route, gone }: Site): { wheels: Wheels | null; loaded: boolean } {
	const phase = job?.phase;
	if (phase === "come") return { wheels: wheelsOf(route, job!.t, -1), loaded: true };
	if (phase === "aim" || phase === "down") return { wheels: wheelsOf(route, route.come, -1), loaded: true };
	if (phase === "lift") return { wheels: wheelsOf(route, route.come, -1), loaded: false };
	return { wheels: gone >= 0 ? wheelsOf(route, route.come, gone) : null, loaded: false };
}

// The truck, the pallet and the crane, where the job has them now.
function drawn(the: The, site: Site): void {
	const { crane, job, load } = site;
	const { wheels, loaded } = wheelsFor(site);
	the.loads.truck(load, wheels);
	the.cranes.pose(crane);
	if (!site.carried || !job) return the.loads.pallet(load, wheels && loaded ? bedOf(wheels) : null, 0, wheels?.size);
	// The pallet empties into the storey as its bricks are laid.
	const left = job.phase === "empty" ? Math.max(0.001, (job.high - job.filled) / (job.high - job.low)) : 1;
	const [x, y, z] = hookOf(crane);
	the.loads.pallet(load, [x, y - (HOOK + LOAD) * left, z], -crane.heading, left);
}

// One step of a site towards what its subject's merges ask. `quick`: they are there at once.
function step(the: The, site: Site, now: Now, quick: boolean): void {
	const idle = !site.job && site.gone < 0 && site.crane.state === "none";
	if (idle && askedOf(site) <= site.merges) return;
	if (quick) return settle(the, site, now.on);
	if (!site.job && askedOf(site) > site.merges && clears(site.crane, highOf(site))) begin(the, site, now.on);
	if (site.gone >= 0) site.gone = site.gone + now.dt > site.route.go + 0.3 ? -1 : site.gone + now.dt;
	stands(the, site, now);
	if (site.job) works(the, site, site.job, now);
	drawn(the, site);
}

export function sites(kit: Kit, anchors: Anchor[], houses: House[], grid: Grid, heights: HeightMap) {
	const the: The = { cranes: cranes(kit, anchors.length), loads: deliveries(kit, anchors.length), random: kit.random, heights };
	const all = anchors.map((anchor, at) => siteOf(anchor, houses[at]!, grid));
	let stage: Stage | null = null;
	let [sudden, last] = [false, 0];
	return {
		// The town follows its subjects' merges from now on (./live.ts keeps them). `now`: what changed while the town was
		// not looked at is there at once.
		follow(on: Stage, now = false): void {
			[stage, sudden] = [on, sudden || now];
		},
		tick(seconds: number): void {
			if (!stage) return;
			// A mark of 0 says an instance is there (./parts.ts#Part): the town's first instant is not one.
			// Half a second at most a frame: a town drawn slowly keeps its trucks at their pace, and what a hidden window
			// skipped is not played in one frame.
			const now: Now = { seconds: Math.max(seconds, 0.001), dt: Math.min(0.5, Math.max(0, seconds - last)), on: stage };
			// The merges of a subject to come are there when its building rises (./plot.ts): no truck comes to a block not built.
			for (const site of all) step(the, site, now, sudden || !stage.moves() || site.anchor.topic.held === true);
			[sudden, last] = [false, seconds];
		},
		// A merge is laid on the building of the subject `index`: its scaffold stands meanwhile (./scaffolds.ts).
		busy: (index: number): boolean => all[index]!.job !== null,
		// A merge of the subject `index` is being laid, or waits to be: its pull request's bar stays (./landing.ts).
		pending: (index: number): boolean => all[index]!.job !== null || askedOf(all[index]!) > all[index]!.merges,
		// The height of the foot of the storey to come of the subject `index`: where its scaffold stands.
		foot: (index: number): number => footOf(all[index]!.house, Math.floor(all[index]!.house.level)),
	};
}
