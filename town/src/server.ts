// The server entry: Sonar calls start(api) when it starts, with the extension switched on. It keeps each project's
// town style (./style-store.ts) and serves it under /api/ext/town:
// - GET /style?project=<name>: { style, drawn }, as kept. A reading never draws.
// - POST /style { project, style }: `style` one of the six, the user's choice; or "automatic", the draw: the style
//   drawn for the project before, else the one the fewest other projects' towns show, kept. Answers { style, drawn }.
// At each start, it first takes the styles Sonar's settings kept before the town left it (./style-left.ts).

import type { Json, RouteRequest, ServerApi } from "@sonar/extension";
import { takeLeft } from "./style-left";
import { type Kept, readKept, writeKept } from "./style-store";
import { isStyle, leastTaken, NONE, shownOf, type World } from "./world";

const refused = (message: string, status: number) => Object.assign(new Error(message), { status });
const messageOf = (error: unknown) => (error instanceof Error ? error.message : String(error));
const answerOf = (world: World): Json => ({ style: world.style, drawn: world.drawn });
// Array.isArray does not tell a readonly array apart.
const isFields = (body: Json | undefined): body is { readonly [key: string]: Json } => typeof body === "object" && body !== null && !Array.isArray(body);

// A project Sonar lists: no style is kept for a name it does not know.
async function known(api: ServerApi, project: unknown): Promise<string> {
	if (typeof project !== "string" || !project) throw refused("Name the project.", 400);
	if (!(await api.projects.list()).some((each) => each.name === project)) throw refused(`No project ${project}.`, 404);
	return project;
}

// The world a choice gives: the draw keeps the style drawn before, else draws among the other projects Sonar lists.
async function chosen(api: ServerApi, kept: Kept, project: string, style: unknown): Promise<World> {
	if (isStyle(style)) return { ...(kept.projects[project] ?? NONE), style };
	if (style !== "automatic") throw refused("The style is one of the six, or automatic.", 400);
	const before = kept.projects[project]?.drawn;
	if (before) return { style: null, drawn: before };
	const others = (await api.projects.list()).filter((each) => each.name !== project);
	return { style: null, drawn: leastTaken(others.map((each) => shownOf(kept.projects[each.name]))) };
}

export async function start(api: ServerApi): Promise<void> {
	let kept: Kept = { projects: {}, setAside: {} };
	// One reading or change at a time, the first being the start's: a change is written from the styles the one before wrote.
	let queue: Promise<unknown> = Promise.resolve();
	const serial = <Value>(work: () => Promise<Value>): Promise<Value> => {
		const run = queue.then(work);
		queue = run.catch(() => undefined);
		return run;
	};
	const save = async (next: Kept): Promise<void> => {
		await writeKept(api.dataDir, next);
		kept = next;
	};

	api.routes.get("/style", ({ query }: RouteRequest) =>
		serial(async () => answerOf(kept.projects[await known(api, query["project"])] ?? NONE)),
	);
	api.routes.post("/style", ({ body }: RouteRequest) =>
		serial(async () => {
			const asked = isFields(body) ? body : {};
			const project = await known(api, asked["project"]);
			const world = await chosen(api, kept, project, asked["style"]);
			await save({ ...kept, projects: { ...kept.projects, [project]: world } });
			return answerOf(world);
		}),
	);

	await serial(async () => {
		kept = await readKept(api.dataDir, api.log);
		await takeLeft(api, kept, save).catch((error) => api.log(`The towns' styles were not taken from Sonar's settings: ${messageOf(error)}`));
	});
}
