// A pull request as GitHub's GraphQL API describes it (the fields of PULL), in Sonar's words: its checks, whether it
// merges, the branch it merges into, its reviews and comments.

import type { HostActivity, HostMergeable, HostPull, PullReading } from "@sonar/extension";
import { checksField, checksOf } from "./checks";
import { BODY_MOST, fieldOf, isTextOrAbsent, nodesOrNone, numberOf, REF_MOST, textOf, textsOf, TITLE_MOST, WORD_MOST } from "./decode";

export const PULL = `fragment Pull on PullRequest {
	number url title state isDraft mergeable baseRefName headRefOid
	reviews(last: 100) { nodes { author { login } state body submittedAt } }
	comments(last: 100) { nodes { author { login } body createdAt } }
	${checksField(100)}
}`;

const STATES: readonly HostPull["state"][] = ["OPEN", "MERGED", "CLOSED"];
export const stateOf = (value: unknown): HostPull["state"] | undefined => STATES.find((each) => each === value);

// GitHub says UNKNOWN while it works it out.
const mergeableOf = (word: unknown): HostMergeable => (word === "CONFLICTING" ? "conflict" : word === "MERGEABLE" ? "clean" : "unknown");

// A review or a comment; `at` null for one not given yet. A deleted account has no author.
function activityOf(node: unknown, kind: HostActivity["kind"]): { readonly given: HostActivity | null } | undefined {
	const [state, body] = ["state", "body"].map((key) => fieldOf(node, key));
	const at = fieldOf(node, kind === "review" ? "submittedAt" : "createdAt") ?? undefined;
	if (!isTextOrAbsent(state) || !isTextOrAbsent(body) || !isTextOrAbsent(at)) return undefined;
	// A review still being written (PENDING) is not given yet.
	if (!at || (kind === "review" && state === "PENDING")) return { given: null };
	const author = (textOf(fieldOf(fieldOf(node, "author"), "login")) ?? "?").slice(0, WORD_MOST);
	return { given: { kind, author, state: kind === "review" ? (state ?? "") : "", body: (body ?? "").slice(0, BODY_MOST), at } };
}

// Its reviews and comments, oldest first.
function activitiesOf(view: unknown): HostActivity[] | undefined {
	const reviews = nodesOrNone(fieldOf(view, "reviews"), (node) => activityOf(node, "review"));
	const comments = nodesOrNone(fieldOf(view, "comments"), (node) => activityOf(node, "comment"));
	if (!reviews || !comments) return undefined;
	return [...reviews, ...comments].flatMap(({ given }) => given ?? []).toSorted((a, b) => a.at.localeCompare(b.at));
}

// `view`: a pull request read with the fields of PULL; null for what cannot be read as one.
export function readingOf(view: unknown, unnamed: string): PullReading | null {
	const texts = textsOf(view, "url", "title", "state");
	const number = numberOf(fieldOf(view, "number"));
	const draft = fieldOf(view, "isDraft");
	const state = stateOf(texts?.state);
	const [base, head] = ["baseRefName", "headRefOid"].map((key) => fieldOf(view, key));
	const checks = checksOf(fieldOf(view, "commits"), unnamed);
	const activity = activitiesOf(view);
	if (!texts || number === undefined || typeof draft !== "boolean" || !state || !checks || !activity) return null;
	if (!isTextOrAbsent(base) || !isTextOrAbsent(head)) return null;
	const pull = { number, url: texts.url, title: texts.title.slice(0, TITLE_MOST), state, draft, checks, ...(head ? { head } : {}) };
	return { pull, mergeable: mergeableOf(fieldOf(view, "mergeable")), base: (base ?? "").slice(0, REF_MOST), activity };
}
