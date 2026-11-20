// The server entry: Sonar calls start(api) when it starts, with the extension switched on. Its routes, under
// /api/ext/statistics, answer what Sonar's own statistics answer: every project's (/global), a project's (/project)
// and its sessions' strips (/tasks). The first two are long to compute (the usage, the trust of each project): a screen
// gets the last computation at once, and the next opening has the one made meanwhile (./kept.ts). `updatedAt` says
// when it was computed.

import type { RouteRequest, ServerApi } from "@sonar/extension";
import { keptByKey } from "./kept";
import { statsReader } from "./read";
import type { GlobalStats, ProjectStats } from "./shapes";
import { strips } from "./strips";

const projectOf = ({ query }: RouteRequest): string => {
	const project = query["project"];
	if (project === undefined) throw Object.assign(new Error("Name the project: ?project=<name>."), { status: 400 });
	return project;
};

export function start(api: ServerApi) {
	const { project, global } = statsReader(api);
	const whole = keptByKey<null, GlobalStats>();
	const projects = keptByKey<string, ProjectStats>();
	api.routes.get("/global", () => whole.get(null, global));
	api.routes.get("/project", (request) => {
		const name = projectOf(request);
		return projects.get(name, () => project(name));
	});
	api.routes.get("/tasks", (request) => strips(api, projectOf(request)));
}
