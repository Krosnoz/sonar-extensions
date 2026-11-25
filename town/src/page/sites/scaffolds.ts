// A subject's open pull requests stand a scaffold round the storey to come of its building: their checks run there. A
// check that fails turns it red, and shakes it for a moment. Its last pull request merged or closed, it goes; it
// stands while a merge is laid (./sites.ts), and goes up with the storey to come. It is born and goes in layers, its
// matter from the building's door and back to it, as the inhabitants (../people/layers.ts); a town opened on an open pull
// request shows it standing, built with its building.
// Nothing is made up: a scaffold stands for pull requests the page shows (../sonar/pulls.ts), and the town stays read only.
import type { Kit, World } from "../render/kit";
import { playLayers } from "../people/layer-play";
import type { Stage } from "../people/live-steps";
import { scaffold } from "./scaffold-model";
import { BD } from "../render/shapes";
import { OVER } from "../plan/town-blocks";

type Anchor = World["anchors"][number];
type Point = [number, number, number];

export const [WOOD, RED] = ["#c99a5b", "#e0473c"];
// Far under the town: a scaffold that stands nowhere.
const AWAY = -4000;
// The seconds a scaffold shakes when a check fails, and how far, in metres.
const [SHAKE, FAR] = [0.5, 0.07];
// The grains of a lattice's cell: a figure's count made a wall of sparks (../people/layer-grains.ts).
const DENSE = 0.07;

// `at`: its instance (-1: none yet). `state`: not there, being born until `until`, there, going until `until`.
// `high`: the height it stands at. `shake`: the town's second its shake ends at (0: it does not shake).
type Site = { anchor: Anchor; at: number; state: "none" | "coming" | "up" | "going"; until: number; high: number; red: boolean; shake: number };
// A step's instant: the town's second, and whether what changes is there at once, without layers, grains nor shake.
type Now = { seconds: number; quick: boolean; on: Stage };
// What the merges of a subject, by its index, ask of its scaffold (./sites.ts): to stand while one is laid, and the
// height of the foot of the storey to come.
export type Works = { busy: (index: number) => boolean; foot: (index: number) => number };
// What the building of a subject that comes while the town is open asks of its scaffold (./plot.ts): to stand while
// it rises, and the height of the foot of the storey being laid, which the scaffold goes up with.
export type Rising = { busy: (index: number) => boolean; foot: () => number };

const pullsOf = (site: Site) => site.anchor.topic.pulls ?? [];
// Over the building's middle, at the height it stands at.
const placeOf = ({ anchor, high }: Site): Point => [anchor.at[0], high, anchor.at[2]];

// What a step does to a scaffold's instance, in the one part that holds every subject's.
function hands(kit: Kit, count: number) {
	const model = scaffold();
	const part = kit.part(model, count, { layers: true });
	return {
		// The scaffold of `site` is written where it stands, `off` aside while it shakes.
		write(site: Site, off = 0): void {
			const [x, y, z] = placeOf(site);
			const given = { x: x + off, y, z, color: site.red ? RED : WOOD };
			if (site.at < 0) site.at = part.put(given);
			// An instance put after the town's first image is sent to the graphics card once it is written again.
			part.set(site.at, given);
		},
		stands(site: Site): void {
			part.mark(site.at, 0);
			site.state = "up";
		},
		gone(site: Site): void {
			part.set(site.at, { x: 0, y: AWAY, z: 0 });
			part.mark(site.at, 0);
			[site.state, site.shake] = ["none", 0];
		},
		// It is born, or goes, in layers from the town's second `at`, its matter from its building's door or back to
		// it. Returns the second its layers end at.
		play(site: Site, born: boolean, at: number, on: Stage): number {
			const [x, y, z] = placeOf(site);
			const played = {
				part,
				index: site.at,
				model,
				stand: { x, y, z, ry: 0, s: 1 },
				tint: site.red ? RED : WOOD,
				parent: [x, 0.5, z + BD / 2] as Point,
				dense: DENSE,
			};
			return playLayers(played, born, at, on, kit.random);
		},
	};
}
type Hands = ReturnType<typeof hands>;

// A scaffold born stands. Born under the user's eyes, it is heard as it stands: red, its checks fail already; without
// a pull request, it is the scaffold of bricks to lay (a new building, a merge), heard as the building site's.
function stood(site: Site, { quick, on }: Now, the: Hands): void {
	the.stands(site);
	if (!quick) on.hear?.(site.red ? "red" : pullsOf(site).length ? "frame" : "site", placeOf(site));
}

// A scaffold comes when its subject has an open pull request or a merge being laid (`wanted`), at the height `foot`
// and in the colour `red` asks, and goes when it has none any more, or when the storey to come is another.
function turn(site: Site, wanted: boolean, foot: number, red: boolean, now: Now, the: Hands): void {
	const { seconds, quick, on } = now;
	if (site.state === "coming" && (quick || seconds >= site.until)) stood(site, now, the);
	if (site.state === "going" && (quick || seconds >= site.until)) the.gone(site);
	if (site.state === "none" && wanted) {
		[site.red, site.high] = [red, foot];
		the.write(site);
		if (quick) the.stands(site);
		else [site.state, site.until] = ["coming", the.play(site, true, seconds, on)];
	} else if (site.state === "up" && (!wanted || site.high !== foot)) {
		if (quick) the.gone(site);
		else [site.state, site.until] = ["going", the.play(site, false, seconds, on) + 0.2];
	}
}

// A scaffold that stands round a building that rises under it (./plot.ts) goes up with the storey being laid. False
// when it has not moved.
function climb(site: Site, foot: number, the: Hands): boolean {
	if (site.state !== "up" || site.high === foot) return false;
	site.high = foot;
	the.write(site);
	return true;
}

// A scaffold that stands takes the colour `red` asks, and shakes for a moment when a check starts to fail.
function tint(site: Site, red: boolean, { seconds, quick, on }: Now, the: Hands): void {
	if (site.state !== "up" && site.state !== "coming") return;
	if (red !== site.red) {
		[site.red, site.shake] = [red, red && !quick && site.state === "up" ? seconds + SHAKE : 0];
		the.write(site);
		// Its checks fail under the user's eyes: heard as it shakes. One still being born is heard red as it stands.
		if (site.shake > 0) on.hear?.("red", placeOf(site));
	}
	if (site.shake <= 0) return;
	const left = Math.max(0, site.shake - seconds);
	the.write(site, Math.sin(left * 46) * FAR * (left / SHAKE));
	if (left === 0) site.shake = 0;
}

// `works`: what the subjects' merges ask of their scaffolds; without them, a scaffold stands round its roof's foot.
// `rising`: what the building of a subject to come asks of its own.
export function scaffolds(kit: Kit, anchors: Anchor[], works?: Works, rising?: Rising) {
	const the = hands(kit, anchors.length);
	const footOf = ({ at, index }: Anchor): number => works?.foot(index) ?? at[1] - OVER;
	const sites: Site[] = anchors.map((anchor) => ({ anchor, at: -1, state: "none", until: 0, high: footOf(anchor), red: false, shake: 0 }));
	// A town opened on an open pull request: its scaffold stands, built with its building.
	for (const site of sites) {
		if (!pullsOf(site).length) continue;
		site.red = pullsOf(site).some((pull) => pull.red);
		the.write(site);
		the.stands(site);
	}
	let stage: Stage | null = null;
	let sudden = false;
	return {
		// The town follows its subjects' pull requests from now on (../people/live.ts keeps them). `now`: what changed while the
		// town was not looked at is there at once.
		follow(on: Stage, now = false): void {
			[stage, sudden] = [on, sudden || now];
		},
		// One step of each scaffold towards what its subject's pull requests ask, at the town's second `seconds`.
		tick(seconds: number): void {
			if (!stage) return;
			// A mark of 0 says an instance is there (../render/parts.ts#Part): the town's first instant is not one.
			const now: Now = { seconds: Math.max(seconds, 0.001), quick: sudden || !stage.moves(), on: stage };
			for (const site of sites) {
				const red = pullsOf(site).some((pull) => pull.red);
				const climbs = rising?.busy(site.anchor.index) ?? false;
				// A subject to come has no building yet: its pull requests stand no scaffold before it rises.
				const wanted = climbs || (!site.anchor.topic.held && (pullsOf(site).length > 0 || (works?.busy(site.anchor.index) ?? false)));
				const foot = climbs ? rising!.foot() : footOf(site.anchor);
				if (!climbs || !climb(site, foot, the)) turn(site, wanted, foot, red, now, the);
				tint(site, red, now, the);
			}
			sudden = false;
		},
	};
}
