// The pull requests an author merged in a repository since a day, as GitHub's search finds them: 500 at most, 100 a
// page, one page after the other.

import type { MergedPull } from "@sonar/extension";
import type { AskGitHub } from "./api";
import { fieldOf, nodesOf, REF_MOST, textOf, textsOf } from "./decode";
import type { Repository } from "./remote";

const SEARCH = `query($q: String!, $after: String) {
	search(query: $q, type: ISSUE, first: 100, after: $after) {
		pageInfo { hasNextPage endCursor }
		nodes { ... on PullRequest { createdAt mergedAt baseRefName } }
	}
}`;
const PAGES = 5;

function mergedOf(node: unknown): MergedPull | undefined {
	const texts = textsOf(node, "createdAt", "mergedAt", "baseRefName");
	return texts && { createdAt: texts.createdAt, mergedAt: texts.mergedAt, base: texts.baseRefName.slice(0, REF_MOST) };
}

// `since`: a day, as 2026-09-07.
export async function mergedPulls(ask: AskGitHub, { owner, name }: Repository, author: string, since: string): Promise<MergedPull[]> {
	const q = `repo:${owner}/${name} author:${author} is:pr is:merged merged:>=${since}`;
	const found: MergedPull[] = [];
	let after: string | null = null;
	for (let page = 1; page <= PAGES; page++) {
		const search: unknown = fieldOf(await ask(SEARCH, { q, after }), "search");
		const next = fieldOf(fieldOf(search, "pageInfo"), "hasNextPage");
		const nodes = nodesOf(search, mergedOf);
		if (typeof next !== "boolean" || !nodes) throw new Error("GitHub: unreadable search");
		found.push(...nodes);
		after = textOf(fieldOf(fieldOf(search, "pageInfo"), "endCursor")) ?? null;
		if (!next || !after) break;
	}
	return found;
}
