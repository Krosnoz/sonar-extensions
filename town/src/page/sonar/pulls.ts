// A subject's pull requests, as its building shows them (../sites/scaffolds.ts) and its sign says them (../signs/sign-nodes.ts): the
// open ones of its sessions, each once.
import type { MapPull } from "@sonar/extension";

// `done` of `total`: its checks that ended. `tone`: the map's. `red`: a check fails.
export type Pull = { url: string; number: number; tone: string; red: boolean; done: number; total: number };

// Its tone, as the map's chip gives it: green once merged or its CI passed, red while it fails, orange while it runs.
const CI_TONES = { passed: "tone-done", failed: "tone-urgent", pending: "tone-wait", none: "tone-neutral" } as const;
const toneOf = (pr: MapPull): string => (pr.state === "merged" ? "tone-done" : pr.state === "closed" ? "tone-neutral" : CI_TONES[pr.ci]);

// A session's open pull requests, as the Map says them (MapPull of @sonar/extension, its checks that ended counted).
// One merged or closed is not kept: nothing is tested on it any more.
export const seenOf = (prs: readonly MapPull[]): Pull[] =>
	prs
		.filter((pr) => pr.state === "open")
		.map((pr) => ({ url: pr.url, number: pr.number, tone: toneOf(pr), red: pr.ci === "failed", done: pr.done, total: pr.total }));

// A subject's pull requests from those of its sessions: two sessions of one branch show the same one. In the order of
// their numbers; one that fails for a session fails.
export function joined(lists: readonly (readonly Pull[])[]): Pull[] {
	const kept = new Map<string, Pull>();
	for (const pull of lists.flat()) if (!kept.get(pull.url)?.red) kept.set(pull.url, pull);
	return [...kept.values()].toSorted((a, b) => a.number - b.number);
}

// What the sign shows of them: it says them again when this changes.
export const keyOf = (pulls: readonly Pull[]): string => pulls.map((pull) => `${pull.url} ${pull.tone} ${pull.done}/${pull.total}`).join("\n");
