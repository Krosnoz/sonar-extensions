// The one request that reads every branch a project follows: for each, the pull requests open toward it, those merged
// into it, and, after the first, how many commits of the branch before it it lacks. Read only.

import { checksField } from "./checks";
import type { Repository } from "./remote";

const OPEN = 50;
const MERGED = 30;

const FIELDS = `fragment Tracked on PullRequest {
	number url title isDraft createdAt mergeable mergeStateStatus headRefName
	author { login }
	labels(first: 10) { nodes { name } }
	${checksField(50)}
}`;

// One alias per branch: `open<i>`, `merged<i>`, and `ref<i>` comparing it with the branch before it.
export function trackedQuery(count: number): string {
	const variables = Array.from({ length: count }, (_, index) => `$b${index}: String!${index > 0 ? `, $r${index}: String!` : ""}`).join(", ");
	const parts = Array.from({ length: count }, (_, index) =>
		[
			`open${index}: pullRequests(baseRefName: $b${index}, states: OPEN, first: ${OPEN}, orderBy: { field: CREATED_AT, direction: DESC }) { nodes { ...Tracked } }`,
			`merged${index}: pullRequests(baseRefName: $b${index}, states: MERGED, first: ${MERGED}, orderBy: { field: UPDATED_AT, direction: DESC }) { nodes { mergedAt } }`,
			index > 0 ? `ref${index}: ref(qualifiedName: $r${index}) { compare(headRef: $b${index - 1}) { aheadBy } }` : "",
		].join("\n"),
	).join("\n");
	return `query($owner: String!, $name: String!, ${variables}) { repository(owner: $owner, name: $name) {\n${parts}\n} } ${FIELDS}`;
}

export function trackedVariables({ owner, name }: Repository, branches: readonly string[]): Record<string, string> {
	const variables: Record<string, string> = { owner, name };
	branches.forEach((branch, index) => {
		variables[`b${index}`] = branch;
		if (index > 0) variables[`r${index}`] = `refs/heads/${branch}`;
	});
	return variables;
}
