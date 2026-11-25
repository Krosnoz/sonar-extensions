// The town follows the fleet while it is open. The page says who is there now (../sonar/sources.ts#wantedOf); the town
// compares it with what it shows itself, figure by figure, and plays what differs (./live-steps.ts). A session that
// opens: an inhabitant is born at its place, from its building's door. One that closes: it goes back to the door. An
// agent that changes state: it goes from its old place while it is born at the new one, in its new colour, with what it
// carries. A subagent that starts: a robot is born from its agent's chest; one no longer listed goes back to it; one
// that ends turns grey. Who only changes place glides (./crowd-lay.ts).
// Nothing is made up: each movement comes from a change of the fleet, and the town stays read only.
import type { Point } from "./births";
import type { Life, Parts } from "./bodies";
import { lay, type Glides, type Square } from "./crowd-lay";
import type { Topic } from "../render/kit";
import { step, type Lives, type Stage, type Wanted } from "./live-steps";
import { joined, keyOf } from "../sonar/pulls";

// The subject's counts, as its sign says them (../signs/sign-nodes.ts).
function counted(topics: Topic[], squares: Square[], index: number): void {
	const topic = topics[index]!;
	topic.agents = squares.filter((square) => square.index === index).flatMap((square) => square.agents);
	for (const [state, count] of [
		[1, "working"],
		[2, "waiting"],
		[3, "reviewing"],
	] as const)
		topic[count] = topic.agents.filter((agent) => agent.state === state).length;
}

// Each subject's pull requests are those of its sessions now (../sonar/pulls.ts). True when its sign has them to say again.
function pulled(topics: Topic[], wanted: Wanted[]): boolean {
	let changed = false;
	for (const topic of topics) {
		const pulls = joined(wanted.filter((each) => each.topic === topic.name).map((each) => each.pulls));
		changed ||= keyOf(pulls) !== keyOf(topic.pulls ?? []);
		topic.pulls = pulls;
	}
	return changed;
}

// Each subject's merges are the most its sessions say now, as at the town's opening (../sonar/sources.ts#fleetOf); a subject
// without a session left keeps those it had.
function merged(topics: Topic[], wanted: Wanted[]): void {
	for (const topic of topics) {
		const said = wanted.filter((each) => each.topic === topic.name).map((each) => each.merges ?? 0);
		if (said.length) topic.merges = Math.max(...said);
	}
}

// Each figure is told what is wanted of it: its agent as it is now, or nothing when its session is gone.
function told(town: Lives, squares: Square[], topics: Topic[], wanted: Wanted[]): void {
	const left = new Map(wanted.map((each) => [`${each.topic}\n${each.handle}`, each]));
	for (const square of squares) {
		const topic = topics[square.index]!.name;
		for (const life of square.lives) {
			if (life.free) continue;
			const key = `${topic}\n${life.agent.handle}`;
			life.want = left.get(key) ?? null;
			left.delete(key);
			town.active.add(life);
		}
	}
	// Who has no figure takes a spare one of its subject's places; without one left, or in a subject the town has not
	// built, it shows at the town's next opening. In a subject whose block is being built (../sites/plot.ts), once it is built.
	for (const each of left.values()) {
		const index = topics.findIndex((topic) => topic.name === each.topic && !topic.held);
		const life = squares
			.filter((square) => square.index === index)
			.flatMap((square) => square.lives)
			.find((spare) => spare.free);
		if (!life) continue;
		life.free = false;
		life.agent = life.figure.agent = { name: each.name, state: each.state, seed: town.random(), children: [], handle: each.handle };
		life.want = each;
		town.active.add(life);
	}
}

// `doorOf`: where the matter of a subject's inhabitants comes from and goes back to, by the subject's index.
export function living(parts: Parts, squares: Square[], topics: Topic[], glides: Glides, doorOf: (index: number) => Point, random: () => number) {
	const homes = new Map<Life, Square>();
	for (const square of squares) for (const life of square.lives) homes.set(life, square);
	const town: Lives = { parts, homes, active: new Set(), changed: new Set(), births: [], doorOf, random, busy: 0, sudden: false, began: 0 };
	let stage: Stage | null = null;
	let revision = 0;
	return {
		// Who is there now. `now`: what changed while the town was not looked at is there at once.
		follow: (wanted: Wanted[], on: Stage, now = false): void => {
			[stage, town.sudden] = [on, town.sudden || now];
			told(town, squares, topics, wanted);
			if (pulled(topics, wanted)) revision++;
			merged(topics, wanted);
		},
		tick: (seconds: number): void => {
			if (!stage) return;
			town.began = 0;
			for (const life of town.active) step(town, life, seconds, stage);
			for (const square of town.changed) lay(parts, square, seconds, !town.sudden && stage.seen(square.lot) ? glides : null);
			for (const index of new Set([...town.changed].map((square) => square.index))) counted(topics, squares, index);
			if (town.changed.size) revision++;
			town.changed.clear();
			for (const born of town.births.splice(0)) born();
			town.sudden = false;
		},
		// How many times the town changed what it shows: its labels are written again when it moves (../signs/signs.ts).
		revision: (): number => revision,
	};
}
