// A key tried before Sonar saves it: the account it opens, the projects whose repository it sees, and those that have
// no repository on GitHub. A key GitHub refuses rejects with `refused` (./api.ts).

import type { KeyTrialRun } from "@sonar/extension";
import { loginOf, sees } from "./account";
import { githubWith, type Send } from "./api";
import type { Repositories } from "./repository";

export const keyTrial =
	(send: Send, repositories: Repositories): KeyTrialRun =>
	async (value, projects = []) => {
		const ask = githubWith(send, value);
		const account = await loginOf(ask);
		// Every repository is asked at once.
		const tried = await Promise.all(
			projects.map(async (project) => {
				const repository = await repositories.ofProject(project);
				return { project, repository, seen: repository ? await sees(ask, repository) : false };
			}),
		);
		return {
			account,
			reaches: tried.filter((each) => each.seen).map((each) => each.project),
			outside: tried.filter((each) => !each.repository).map((each) => each.project),
		};
	};
