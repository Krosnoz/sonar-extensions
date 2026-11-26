// Linear as Sonar's ticket tracker (the port `tickets`): each call reads the project's key, then asks Linear. The
// cache, the links between sessions and tickets and the search of a ticket in a text are Sonar's.

import type { ServerApi, TicketsProvider } from "@sonar/extension";
import { type AskLinear, linearAt } from "./api";
import { readStates, writeState } from "./states";
import { readCandidates, readTickets } from "./tickets";
import { readWorkspace } from "./workspace";

export const KEY = "key";

// A key as the user types it, not saved yet: the workspace it opens names its row in Sonar's Services. A key Linear
// refuses rejects with `refused` (./api.ts).
export const workspaceOfKey = (url: string) => async (value: string) => ({ account: (await readWorkspace(linearAt(url, value))).name });

export function linearProvider(api: ServerApi, url: string): TicketsProvider {
	// Sonar asks `ready` first: a call for a project without a key is a failure of the call.
	const linearFor = async (project: string): Promise<AskLinear> => {
		const key = await api.keys.read(KEY, project);
		if (!key) throw new Error(`No Linear key for the project "${project}": add one in Sonar's Settings > Services`);
		return linearAt(url, key);
	};
	return {
		name: "Linear",
		ready: async (project) => Boolean(await api.keys.read(KEY, project)),
		workspace: async (project) => readWorkspace(await linearFor(project)),
		tickets: async (project, ids) => readTickets(await linearFor(project), ids),
		candidates: async (project) => readCandidates(await linearFor(project)),
		states: async (project, id) => readStates(await linearFor(project), id),
		setState: async (project, id, stateId) => writeState(await linearFor(project), id, stateId),
	};
}
