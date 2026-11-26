// The server entry: Sonar calls start(api) when it starts, with the extension switched on. It fills Sonar's ticket
// tracker (the port `tickets`) with Linear, and gives the trial of its key (./server/provider.ts). It imports nothing
// of Sonar when it runs: the contract gives types only.

import type { ServerApi } from "@sonar/extension";
import { LINEAR_URL } from "./server/api";
import { KEY, linearProvider, workspaceOfKey } from "./server/provider";

// `url`: Linear's address, which the tests give.
export function startLinear(api: ServerApi, url: string) {
	api.provide.tickets(linearProvider(api, url));
	// A Sonar older than the trial of a key has none: the key is then saved without being tried.
	api.keys.trial?.(KEY, workspaceOfKey(url));
}

export function start(api: ServerApi) {
	startLinear(api, LINEAR_URL);
}
