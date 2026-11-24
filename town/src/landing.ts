// A pull request merged while the town is open keeps its bar on its subject's sign, full, while its storey is laid
// (./sites.ts). Before, the bar left with the merge: the crane then worked for a pull request the sign no longer said.
// Nothing is made up: the bar is one the sign showed for an open pull request, which its session now says merged.
import type { Topic } from "./kit";
import type { Stage, Wanted } from "./live-steps";
import type { Pull } from "./pulls";

// The seconds a merged pull request's bar waits for its merge to be counted: the server says the pull request merged
// and its subject's merges, not always in one message.
const WAIT = 3;
// The map's tone of a merged pull request (./pulls.ts#toneOf).
const MERGED = "tone-done";
// Its bar once merged: every check ended.
const full = (pull: Pull): Pull => ({ ...pull, tone: MERGED, red: false, done: pull.total });

// `pending`: whether a merge of the subject `index` is being laid or waits to be.
export function landing(topics: Topic[], pending: (index: number) => boolean) {
	// What each subject's sign showed open at the last telling.
	let open = topics.map((topic) => topic.pulls ?? []);
	// For each subject: the town's second its bars were kept at (0: at the next step), and whether their storey began.
	const kept = topics.map(() => ({ since: 0, began: false }));
	let stage: Stage | null = null;
	let revision = 0;
	// Whether a bar is kept: a town at rest does nothing of this at its frames.
	let keeping = false;
	return {
		// Called once the subjects' pull requests are those of the fleet now (./live.ts). `now`: what changed while the
		// town was not looked at is there at once, and no bar is kept.
		follow(wanted: Wanted[], on: Stage, now = false): void {
			stage = on;
			for (const [index, topic] of topics.entries()) {
				const merged = new Set(wanted.filter((each) => each.topic === topic.name).flatMap((each) => each.merged ?? []));
				const still = new Set((topic.pulls ?? []).map((pull) => pull.url));
				const left = open[index]!.filter((pull) => merged.has(pull.url) && !still.has(pull.url));
				open[index] = topic.pulls ?? [];
				if (!left.length || now || !on.moves()) continue;
				topic.landing = [...(topic.landing ?? []), ...left.map(full)];
				kept[index] = { since: 0, began: false };
				keeping = true;
				revision++;
			}
		},
		// The bars go once their storey is laid, or when no merge was counted for them.
		tick(seconds: number): void {
			if (!keeping) return;
			keeping = false;
			for (const [index, topic] of topics.entries()) {
				if (!topic.landing?.length) continue;
				const state = kept[index]!;
				state.since ||= seconds;
				if (pending(index) && stage?.moves()) state.began = true;
				else if (state.began || !stage?.moves() || seconds - state.since >= WAIT) {
					topic.landing = [];
					revision++;
					continue;
				}
				keeping = true;
			}
		},
		// How many times the bars changed: the signs say them again (./sign-again.ts).
		revision: (): number => revision,
	};
}
