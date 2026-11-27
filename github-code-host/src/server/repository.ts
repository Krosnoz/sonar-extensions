// A project's repository: the field `github` ("owner/name") of its settings file when Sonar hands it over, else the
// "origin" remote of its main folder. Sonar hands over a field only once it no longer knows it (projects.left): while
// Sonar has a setting of its own by that name, an extension gets nothing of it, and the remote alone counts.

import type { ServerApi } from "@sonar/extension";
import { named, originReader, type Repository } from "./remote";

const FIELD = "github";

export type Repositories = {
	readonly ofProject: (project: string) => Promise<Repository | null>;
	readonly ofFolder: (folder: string) => Promise<Repository | null>;
};

// The name Sonar gives a project it does not list: its settings file's.
const fileName = (project: string) => project.replace(/[^a-zA-Z0-9._-]/g, "_");

export function projectRepositories(api: ServerApi): Repositories {
	const ofFolder = originReader();
	return {
		ofFolder,
		ofProject: async (project) => {
			// A Sonar older than `projects.left` has none.
			const [left, projects] = await Promise.all([api.projects.left?.(FIELD) ?? [], api.projects.list()]);
			const listed = projects.find((each) => each.name === project);
			const kept = left.find((each) => each.project === project) ?? (listed ? undefined : left.find((each) => each.project === fileName(project)));
			const set = named(kept?.value);
			if (set) return set;
			return listed ? ofFolder(listed.folder) : null;
		},
	};
}
