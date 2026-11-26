// The workflow states of an issue's team, and the one write the extension makes in Linear: an issue's state.

import type { TicketState } from "@sonar/extension";
import type { AskLinear } from "./api";
import { fieldOf, nodesOf, textsOf } from "./decode";
import { isIdentifier } from "./tickets";

const checked = (id: string): string => {
	if (!isIdentifier(id)) throw new Error("This is not a Linear issue identifier, as ABC-12");
	return id;
};

function stateOf(node: unknown): (TicketState & { readonly position: number }) | undefined {
	const state = textsOf(node, "id", "name", "type", "color");
	const position = fieldOf(node, "position");
	return state && typeof position === "number" ? { ...state, position } : undefined;
}

// In the order of the team's board.
export async function readStates(ask: AskLinear, id: string): Promise<TicketState[]> {
	const states = await ask(
		`query($id: String!) { issue(id: $id) { team { states { nodes { id name type color position } } } } }`,
		(data) => nodesOf(fieldOf(fieldOf(fieldOf(data, "issue"), "team"), "states"), stateOf),
		{ id: checked(id) },
	);
	return states.toSorted((a, b) => a.position - b.position).map(({ position, ...state }) => state);
}

export async function writeState(ask: AskLinear, id: string, stateId: string): Promise<void> {
	const success = await ask(
		`mutation($id: String!, $stateId: String!) { issueUpdate(id: $id, input: { stateId: $stateId }) { success } }`,
		(data) => {
			const value = fieldOf(fieldOf(data, "issueUpdate"), "success");
			return typeof value === "boolean" ? value : undefined;
		},
		{ id: checked(id), stateId },
	);
	if (!success) throw new Error(`Linear did not change the state of ${id}`);
}
