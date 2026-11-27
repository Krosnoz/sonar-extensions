// The open issues of a repository that carry a label, the oldest first: the issues the user handed over to Sonar's
// agents. 20 at most: a day never takes more. Only an issue whose label was put last by a person who can write in the
// repository counts: anyone opens an issue, and an issue form puts its labels for anyone.

import type { HostIssue } from "@sonar/extension";
import type { AskGitHub } from "./api";
import { BODY_MOST, fieldOf, nodesOf, numberOf, textOf, textsOf, TITLE_MOST } from "./decode";
import type { Repository } from "./remote";

const LABELED = `query($owner: String!, $name: String!, $label: String!) {
	repository(owner: $owner, name: $name) {
		issues(first: 20, states: OPEN, labels: [$label], orderBy: { field: CREATED_AT, direction: ASC }) {
			nodes { number title url body timelineItems(itemTypes: [LABELED_EVENT], last: 20) { nodes { ... on LabeledEvent { label { name } actor { login } } } } }
		}
	}
}`;

const WRITER = `query($owner: String!, $name: String!, $login: String!) {
	repository(owner: $owner, name: $name) { collaborators(login: $login) { edges { permission } } }
}`;

const WRITES = new Set<unknown>(["ADMIN", "MAINTAIN", "WRITE"]);

// A label put on an issue. A deleted account has no actor: `login` null.
function labelingOf(node: unknown): { readonly label: string; readonly login: string | null } | undefined {
	const label = textOf(fieldOf(fieldOf(node, "label"), "name"));
	const actor = fieldOf(node, "actor");
	const login = actor === null ? null : textOf(fieldOf(actor, "login"));
	return label === undefined || login === undefined ? undefined : { label, login };
}

function labeledOf(node: unknown) {
	const texts = textsOf(node, "title", "url", "body");
	const number = numberOf(fieldOf(node, "number"));
	const labelings = nodesOf(fieldOf(node, "timelineItems"), labelingOf);
	if (!texts || number === undefined || !labelings) return undefined;
	const issue: HostIssue = { number, title: texts.title.slice(0, TITLE_MOST), url: texts.url, body: texts.body.slice(0, BODY_MOST) };
	return { issue, labelings };
}

async function writes(ask: AskGitHub, repository: Repository, login: string): Promise<boolean> {
	const data = await ask(WRITER, { ...repository, login });
	const edges = fieldOf(fieldOf(fieldOf(data, "repository"), "collaborators"), "edges");
	return Array.isArray(edges) && edges.some((edge) => WRITES.has(fieldOf(edge, "permission")));
}

export async function labeledIssues(ask: AskGitHub, repository: Repository, label: string): Promise<HostIssue[]> {
	const nodes = nodesOf(fieldOf(fieldOf(await ask(LABELED, { ...repository, label }), "repository"), "issues"), labeledOf);
	if (!nodes) throw new Error("GitHub: unreadable issues");
	// GitHub matches a label's name whatever its case.
	const labeled = nodes.map(({ issue, labelings }) => ({
		issue,
		labeler: labelings.findLast((each) => each.label.toLowerCase() === label.toLowerCase())?.login,
	}));
	// Each person is asked about once, one after the other.
	const writers = new Set<string>();
	for (const login of new Set(labeled.map((each) => each.labeler))) if (login && (await writes(ask, repository, login))) writers.add(login);
	return labeled.filter((each) => writers.has(each.labeler ?? "")).map((each) => each.issue);
}
