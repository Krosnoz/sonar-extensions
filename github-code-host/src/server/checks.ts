// The checks of a pull request's CI, those of its last commit (check runs and old commit statuses), each with its
// verdict in Sonar's words. A check "cancelled" mostly comes from a run that was replaced: it does not count.

import type { HostCheck } from "@sonar/extension";
import { fieldOf, isTextOrAbsent, nodesOf, nodesOrNone, textOf, WORD_MOST } from "./decode";

// What a reading asks of a pull request's last commit, `most` checks at most.
export const checksField = (most: number) => `commits(last: 1) { nodes { commit { statusCheckRollup { contexts(first: ${most}) { nodes {
	kind: __typename
	... on CheckRun { name status conclusion }
	... on StatusContext { context state }
} } } } } }`;

const FAILED = new Set(["FAILURE", "ERROR", "TIMED_OUT", "ACTION_REQUIRED", "STARTUP_FAILURE"]);
const PENDING = new Set(["QUEUED", "IN_PROGRESS", "WAITING", "PENDING", "REQUESTED", "EXPECTED"]);

// A check's outcome in one word: a check cancelled or skipped tells nothing.
const verdictOf = (state: string): HostCheck["verdict"] =>
	FAILED.has(state) ? "failed" : PENDING.has(state) ? "pending" : state === "SUCCESS" || state === "NEUTRAL" ? "passed" : "skipped";

// A status (old commit statuses) has a state; a check run has a status, then a conclusion once completed. `unnamed`:
// the name of a check GitHub gives none.
function checkOf(node: unknown, unnamed: string): HostCheck | undefined {
	const [kind, name, context, status, state] = ["kind", "name", "context", "status", "state"].map((key) => fieldOf(node, key));
	const conclusion = fieldOf(node, "conclusion") ?? undefined;
	if (!isTextOrAbsent(name) || !isTextOrAbsent(context) || !isTextOrAbsent(status) || !isTextOrAbsent(state)) return undefined;
	if (!isTextOrAbsent(conclusion)) return undefined;
	const outcome = textOf(kind) === "StatusContext" ? (state ?? "") : status === "COMPLETED" ? (conclusion ?? "") : (status ?? "");
	return { name: (name ?? context ?? unnamed).slice(0, WORD_MOST), state: outcome, verdict: verdictOf(outcome) };
}

// `commits`: the field of `checksField`. A commit without any CI has no rollup.
export function checksOf(commits: unknown, unnamed: string): HostCheck[] | undefined {
	const each = nodesOrNone(commits, (node) => {
		const rollup = fieldOf(fieldOf(node, "commit"), "statusCheckRollup");
		return rollup === null ? [] : nodesOf(fieldOf(rollup, "contexts"), (check) => checkOf(check, unnamed));
	});
	return each && (each[0] ?? []);
}
