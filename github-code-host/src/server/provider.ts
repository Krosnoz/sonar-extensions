// GitHub as Sonar's code host (the port `codeHost`): each call reads the project's key, then asks GitHub. The cache of
// the readings, the watch of a pull request, the issues taken and the branches followed are Sonar's.

import type { CodeHostProvider, ServerApi } from "@sonar/extension";
import { loginOf } from "./account";
import { githubWith, type Send } from "./api";
import { labeledIssues } from "./issues";
import { mergedPulls } from "./merged";
import { openPull, pullState } from "./open-pull";
import { pullByUrl, pullOfBranch } from "./pull-reads";
import type { Repositories } from "./repository";
import { trackedBranches } from "./tracked";

export const KEY = "token";

export function githubProvider(api: ServerApi, send: Send, repositories: Repositories): CodeHostProvider {
	// The name of a check GitHub gives none, in the language the user reads now.
	const unnamed = () => (api.language() === "fr" ? "vérification" : "check");

	// Sonar asks `ready` first: a call for a project without a key is a failure of the call, and GitHub is not asked.
	const askFor = async (project: string) => {
		const key = await api.keys.read(KEY, project);
		if (!key) throw new Error(`GitHub: the project ${project} has no key`);
		return githubWith(send, key);
	};

	// A call about the project's repository needs both.
	const reached = async (project: string) => {
		const ask = await askFor(project);
		const repository = await repositories.ofProject(project);
		if (!repository) throw new Error(`GitHub: the project ${project} has no repository`);
		return { ask, repository };
	};

	return {
		name: "GitHub",
		// The key alone: a project whose repository is not found still gives its sessions' git the key.
		ready: async (project) => Boolean(await api.keys.read(KEY, project)),
		repository: async (project) => {
			const found = await repositories.ofProject(project);
			return found ? `${found.owner}/${found.name}` : null;
		},
		account: async (project) => loginOf(await askFor(project)),
		pullByUrl: async (project, url) => pullByUrl(await askFor(project), url, unnamed()),
		pullOfBranch: async (project, folder, branch) => {
			const repository = await repositories.ofFolder(folder);
			return repository ? pullOfBranch(await askFor(project), repository, branch, unnamed()) : null;
		},
		issues: async (project, label) => {
			const { ask, repository } = await reached(project);
			return labeledIssues(ask, repository, label);
		},
		openPull: async (project, pull) => {
			const { ask, repository } = await reached(project);
			return openPull(ask, repository, pull);
		},
		pullState: async (project, number) => {
			const { ask, repository } = await reached(project);
			return pullState(ask, repository, number);
		},
		merged: async (project, author, since) => {
			const { ask, repository } = await reached(project);
			return mergedPulls(ask, repository, author, since);
		},
		tracked: async (project, branches, since) => {
			const { ask, repository } = await reached(project);
			return trackedBranches(ask, repository, branches, since, unnamed());
		},
		// GitHub takes any user name with a token.
		gitAccess: async (project) => {
			const password = await api.keys.read(KEY, project);
			return password ? { host: "github.com", username: "x-access-token", password } : null;
		},
	};
}
