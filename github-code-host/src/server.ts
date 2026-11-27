// The server entry: Sonar calls start(api) when it starts, with the extension switched on. It fills Sonar's code host
// (the port `codeHost`) with GitHub, and gives the trial of its key (./server/provider.ts, ./server/trial.ts). It
// imports nothing of Sonar when it runs: the contract gives types only.

import type { ServerApi } from "@sonar/extension";
import type { Send } from "./server/api";
import { githubProvider, KEY } from "./server/provider";
import { projectRepositories } from "./server/repository";
import { keyTrial } from "./server/trial";

// `send`: how a request leaves, which the tests give.
export function startGitHub(api: ServerApi, send: Send) {
	const repositories = projectRepositories(api);
	api.provide.codeHost(githubProvider(api, send, repositories));
	// A Sonar older than the trial of a key has none: the key is then saved without being tried.
	api.keys.trial?.(KEY, keyTrial(send, repositories));
}

export function start(api: ServerApi) {
	startGitHub(api, (url, init) => fetch(url, init));
}
