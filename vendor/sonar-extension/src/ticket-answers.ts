// What a tickets provider an extension fills may give the core (TicketsProvider of ./ports.ts), checked the same way by
// Sonar (apps/server/src/extensions/) and by the kit (./testing.ts): an extension that gives what Sonar refuses fails in
// its own tests as in Sonar. Bounds keep a tracker's answer from filling the cache or the page. Plain functions: the kit
// imports nothing of Sonar.

import { fieldOf, isHttps, listOf, named, text } from "./answer-fields";
import type { Ticket, TicketsProvider, TicketState } from "./ports";

// A ticket's identifier: its team's prefix, then its number. Sonar's route asks a tracker for no other.
export const TICKET_ID = /^[A-Za-z0-9]+-\d+$/;
const TEAM_PREFIX = /^[A-Za-z0-9]{1,40}$/;
// A hexadecimal colour as a tracker writes it: "#" and 3, 4, 6 or 8 digits.
const COLOR = /^#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;
const ID_MOST = 40;
const TITLE_MOST = 500;
const WORD_MOST = 200;
// The tickets one answer holds at most: Sonar asks for more in several calls.
export const TICKETS_MOST = 200;
const STATES_MOST = 100;
const TEAMS_MOST = 200;
const NAME_MOST = 40;

// What Sonar says of an answer it refuses.
export const ticketsCannotRead = (call: string): string => `The extension's tickets provider answered ${call} with what Sonar cannot read`;

const isColor = (value: unknown): value is string => value === "" || (typeof value === "string" && COLOR.test(value));

function ticketOf(answer: unknown): Ticket | undefined {
	const [id, title, url, state, stateType, color, assignee] = ["id", "title", "url", "state", "stateType", "color", "assignee"].map((key) =>
		fieldOf(answer, key),
	);
	if (!named(id, ID_MOST) || !TICKET_ID.test(id) || !text(title, TITLE_MOST) || !isHttps(url)) return undefined;
	if (!text(state, WORD_MOST) || !text(stateType, WORD_MOST) || !isColor(color)) return undefined;
	if (!(assignee === null || text(assignee, WORD_MOST))) return undefined;
	return { id, title, url, state, stateType, color, assignee };
}

function stateOf(answer: unknown): TicketState | undefined {
	const [id, name, type, color] = ["id", "name", "type", "color"].map((key) => fieldOf(answer, key));
	return named(id, WORD_MOST) && text(name, WORD_MOST) && text(type, WORD_MOST) && isColor(color) ? { id, name, type, color } : undefined;
}

// Whether a project can reach the tracker or the code host, as `ready` says it.
export const readyOf = (answer: unknown): boolean | undefined => (typeof answer === "boolean" ? answer : undefined);

// One answer per id asked, in their order: a ticket, or null for one the tracker does not know.
export const ticketsOf = (answer: unknown, asked: number): (Ticket | null)[] | undefined =>
	Array.isArray(answer) && answer.length === asked ? listOf(answer, TICKETS_MOST, (item) => (item === null ? null : ticketOf(item))) : undefined;

export const candidatesOf = (answer: unknown): Ticket[] | undefined => listOf(answer, TICKETS_MOST, ticketOf);

export const statesOf = (answer: unknown): TicketState[] | undefined => listOf(answer, STATES_MOST, stateOf);

// The workspace a project reaches: its name and its teams' prefixes (letters and digits).
export function workspaceOf(answer: unknown): { name: string; teams: string[] } | undefined {
	const name = fieldOf(answer, "name");
	const teams = listOf(fieldOf(answer, "teams"), TEAMS_MOST, (prefix) => (typeof prefix === "string" && TEAM_PREFIX.test(prefix) ? prefix : undefined));
	return named(name, WORD_MOST) && teams ? { name, teams } : undefined;
}

// What a tickets provider lacks, by the first field missing or not of its type; null when it has all it needs.
export function ticketsRefusal(provider: TicketsProvider): keyof TicketsProvider | null {
	if (!named(provider.name, NAME_MOST)) return "name";
	const calls = ["ready", "workspace", "tickets", "candidates", "states", "setState"] as const;
	return calls.find((call) => typeof provider[call] !== "function") ?? null;
}

// One answer of the kit's provider, decoded, or the call fails as in Sonar.
async function read<A>(call: string, answer: Promise<unknown>, decode: (answer: unknown) => A | undefined): Promise<A> {
	const decoded = decode(await answer);
	if (decoded === undefined) throw new Error(ticketsCannotRead(call));
	return decoded;
}

// The provider as `provide.tickets` keeps it: its `name` read once, so that an object changed later, or a getter read
// again, does not escape the check. Its calls go to the extension's object.
export function keptTickets(provider: TicketsProvider): TicketsProvider {
	return {
		name: provider.name,
		ready: (project) => provider.ready(project),
		workspace: (project) => provider.workspace(project),
		tickets: (project, ids) => provider.tickets(project, ids),
		candidates: (project) => provider.candidates(project),
		states: (project, id) => provider.states(project, id),
		setState: (project, id, stateId) => provider.setState(project, id, stateId),
	};
}

// The provider as the kit gives it to a test: each answer Sonar refuses fails the call, with Sonar's words. It holds no
// delay over a call: Sonar does.
export function checkedTickets(provider: TicketsProvider): TicketsProvider {
	return {
		name: provider.name,
		ready: async (project) => read("ready", Promise.resolve(provider.ready(project)), readyOf),
		workspace: (project) => read("workspace", provider.workspace(project), workspaceOf),
		tickets: (project, ids) => read("tickets", provider.tickets(project, ids), (answer) => ticketsOf(answer, ids.length)),
		candidates: (project) => read("candidates", provider.candidates(project), candidatesOf),
		states: (project, id) => read("states", provider.states(project, id), statesOf),
		setState: (project, id, stateId) => provider.setState(project, id, stateId),
	};
}
