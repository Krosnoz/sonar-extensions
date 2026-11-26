// Linear's issues as Sonar's tickets: those asked by their identifiers, and the candidates to link a session to.

import type { Ticket } from "@sonar/extension";
import type { AskLinear } from "./api";
import { fieldOf, nodesOf, textsOf } from "./decode";

const FIELDS = "identifier title url state { name type color } assignee { displayName }";
const OPEN = `filter: { state: { type: { nin: ["completed", "canceled"] } } }, orderBy: updatedAt`;
// Sonar refuses a whole answer for one title longer than this.
const TITLE_MOST = 500;

// An issue's identifier, as "ABC-12": nothing else is asked to Linear as one.
const IDENTIFIER = /^[A-Za-z0-9]+-\d+$/;
export const isIdentifier = (id: string): boolean => IDENTIFIER.test(id);

function ticketOf(node: unknown): Ticket | undefined {
	const issue = textsOf(node, "identifier", "title", "url");
	const state = textsOf(fieldOf(node, "state"), "name", "type", "color");
	const assigned = fieldOf(node, "assignee");
	const assignee = assigned === null ? null : textsOf(assigned, "displayName")?.displayName;
	if (!issue || !state || assignee === undefined) return undefined;
	return {
		id: issue.identifier,
		title: issue.title.slice(0, TITLE_MOST),
		url: issue.url,
		state: state.name,
		stateType: state.type,
		color: state.color,
		assignee,
	};
}

// One request for all the identifiers; one answer per id, in their order, null for one Linear does not know. They are
// asked as a filter, which leaves out what it does not find: `issue(id:)` fails the whole request for one unknown
// identifier. Archived issues are read too.
export async function readTickets(ask: AskLinear, ids: readonly string[]): Promise<(Ticket | null)[]> {
	const asked = ids.filter(isIdentifier).map((id) => id.toUpperCase());
	const found = asked.length
		? await ask(
				`query($ids: [ID!]!, $first: Int!) { issues(filter: { id: { in: $ids } }, first: $first, includeArchived: true) { nodes { ${FIELDS} } } }`,
				(data) => nodesOf(fieldOf(data, "issues"), ticketOf),
				{ ids: asked, first: asked.length },
			)
		: [];
	const byId = new Map(found.map((ticket) => [ticket.id.toUpperCase(), ticket]));
	return ids.map((id) => byId.get(id.toUpperCase()) ?? null);
}

// The user's own open issues, then the workspace's recently updated open ones, each once.
export async function readCandidates(ask: AskLinear): Promise<Ticket[]> {
	const all = await ask(
		`query { viewer { assignedIssues(first: 50, ${OPEN}) { nodes { ${FIELDS} } } } issues(first: 100, ${OPEN}) { nodes { ${FIELDS} } } }`,
		(data) => {
			const own = nodesOf(fieldOf(fieldOf(data, "viewer"), "assignedIssues"), ticketOf);
			const recent = nodesOf(fieldOf(data, "issues"), ticketOf);
			return own && recent ? [...own, ...recent] : undefined;
		},
	);
	return [...new Map(all.map((ticket) => [ticket.id, ticket])).values()];
}
