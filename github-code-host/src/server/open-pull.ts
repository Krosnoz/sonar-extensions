// The pull request Sonar opens for a branch already on GitHub: the one open for it, or a new one; and later, whether it
// was merged.

import type { HostPull } from "@sonar/extension";
import type { AskGitHub } from "./api";
import { fieldOf, nodesOf, numberOf, textOf } from "./decode";
import { stateOf } from "./pull";
import type { Repository } from "./remote";

const OPEN = `query($owner: String!, $name: String!, $head: String!) { repository(owner: $owner, name: $name) {
	id pullRequests(headRefName: $head, states: OPEN, first: 1) { nodes { number url } } } }`;
const CREATE = `mutation($repository: ID!, $base: String!, $head: String!, $title: String!, $body: String!) {
	createPullRequest(input: { repositoryId: $repository, baseRefName: $base, headRefName: $head, title: $title, body: $body }) {
		pullRequest { number url } } }`;
const STATE = `query($owner: String!, $name: String!, $number: Int!) { repository(owner: $owner, name: $name) {
	pullRequest(number: $number) { state } } }`;

function openedOf(node: unknown): { number: number; url: string } | undefined {
	const number = numberOf(fieldOf(node, "number"));
	const url = textOf(fieldOf(node, "url"));
	return number === undefined || url === undefined ? undefined : { number, url };
}

type Asked = { readonly base: string; readonly head: string; readonly title: string; readonly body: string };

export async function openPull(ask: AskGitHub, repository: Repository, { base, head, title, body }: Asked): Promise<{ number: number; url: string }> {
	const found = fieldOf(await ask(OPEN, { ...repository, head }), "repository");
	const id = textOf(fieldOf(found, "id"));
	const open = nodesOf(fieldOf(found, "pullRequests"), openedOf);
	if (id === undefined || !open) throw new Error(`GitHub: ${repository.owner}/${repository.name} is not seen`);
	if (open[0]) return open[0];
	const data = await ask(CREATE, { repository: id, base, head, title, body });
	const created = openedOf(fieldOf(fieldOf(data, "createPullRequest"), "pullRequest"));
	if (!created) throw new Error("GitHub: unreadable pull request");
	return created;
}

export async function pullState(ask: AskGitHub, repository: Repository, number: number): Promise<HostPull["state"]> {
	const data = await ask(STATE, { ...repository, number });
	const state = stateOf(fieldOf(fieldOf(fieldOf(data, "repository"), "pullRequest"), "state"));
	if (!state) throw new Error(`GitHub: pull request #${number} is not seen`);
	return state;
}
