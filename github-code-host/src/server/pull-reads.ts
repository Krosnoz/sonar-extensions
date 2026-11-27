// The two ways Sonar asks for a session's pull request: by its address, and by the branch of its folder.

import type { PullReading } from "@sonar/extension";
import type { AskGitHub } from "./api";
import { fieldOf } from "./decode";
import { PULL, readingOf } from "./pull";
import type { Repository } from "./remote";

const BY_URL = `query($url: URI!) { resource(url: $url) { ... on PullRequest { ...Pull } } } ${PULL}`;
const BY_BRANCH = `query($owner: String!, $name: String!, $branch: String!) {
	repository(owner: $owner, name: $name) { pullRequests(headRefName: $branch, first: 5, orderBy: { field: CREATED_AT, direction: DESC }) { nodes { ...Pull } } }
} ${PULL}`;

export async function pullByUrl(ask: AskGitHub, url: string, unnamed: string): Promise<PullReading | null> {
	const resource = fieldOf(await ask(BY_URL, { url }), "resource");
	return resource ? readingOf(resource, unnamed) : null;
}

// As `gh pr view <branch>`: the open one, else the latest.
export async function pullOfBranch(ask: AskGitHub, repository: Repository, branch: string, unnamed: string): Promise<PullReading | null> {
	const data = await ask(BY_BRANCH, { ...repository, branch });
	const nodes = fieldOf(fieldOf(fieldOf(data, "repository"), "pullRequests"), "nodes");
	const readings = (Array.isArray(nodes) ? nodes : []).flatMap((node) => readingOf(node, unnamed) ?? []);
	return readings.find((each) => each.pull.state === "OPEN") ?? readings[0] ?? null;
}
