// A Sonar server in memory, for the tests of an extension's server entry in its own repository
// (docs/extension-testing.md): `start(bench.api)` runs as in Sonar, without Sonar. What the extension does is read back (its routes
// called, its live messages, its log, its tools called); what it reads is posed (keys, sessions, projects, settings,
// events, what Sonar measures). It keeps the core's rules that hold in a few lines (./rules.ts, a key its card does not declare, a route's
// status), and says them in the words of Sonar in English. It does not check a tool's arguments against its JSON
// Schema, nor tell a name of the core's tools: Sonar does. The same cases run against it and against Sonar's server
// (tests/support/extension-cases.ts), so that it does not drift.

import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { AgentTool, Json, Manifest, ProjectLine, RouteHandler, RouteRequest, ServerApi, ServerEntry, ServerEvents, SessionLine, Stop } from "./contract";
import { readManifest } from "./manifest";
import type { ClosedSession } from "./measures";
import { checkedJudge, CORE_LENT_NAMES, judgeRefusal, keptJudge } from "./judge-answers";
import type { JudgeProvider } from "./ports";
import { type Measures, measuresOf, notDeclared } from "./testing-measures";
import { eventRefusal, isToolFullName, isToolName, LIVE_MOST, provideRefusal, routeStatus, SERVER_EVENTS, TOOL_FULL_NAME_MOST, wrongToolField } from "./rules";

export type Answer = { readonly status: number; readonly body: Json };
export type ToolAnswer = { readonly text: string; readonly isError: boolean };
export type ToolCaller = Parameters<AgentTool["run"]>[1];

export type Bench = {
	readonly api: ServerApi;
	// Its routes, as the page calls them at /api/ext/<id><path>.
	readonly get: (path: string, query?: Readonly<Record<string, string>>) => Promise<Answer>;
	readonly post: (path: string, body?: Json) => Promise<Answer>;
	// What it sent live, and the lines of its log, in order.
	readonly live: readonly Json[];
	readonly log: readonly string[];
	// A key the user gave: for a project when its card keeps it per project.
	readonly setKey: (name: string, value: string, project?: string) => void;
	// The open sessions and the projects it lists, as the test fills them.
	readonly sessions: SessionLine[];
	readonly projects: ProjectLine[];
	// Tells its listeners that the user closed a session, after it joins `measures.closed` as in Sonar. `task`: the
	// session ran a delegated task (false by default).
	readonly emit: <Name extends keyof ServerEvents>(event: Name, data: ServerEvents[Name], task?: boolean) => void;
	// What Sonar measures, as the test fills it (./testing-measures.ts).
	readonly measures: Measures;
	// Its tools by their full name (<id>_<name>), and an agent's call of one.
	readonly tools: () => readonly { readonly name: string; readonly readOnly: boolean }[];
	readonly call: (name: string, input: Json, caller?: ToolCaller) => Promise<ToolAnswer>;
	// Runs its `start` with `api`, as Sonar does: once it ended, `provide` throws. Returns what `start` returned.
	readonly start: (start: ServerEntry["start"]) => Promise<void | Stop>;
	// The judge it gave (`provide.judge`), as Sonar would call it: an answer Sonar refuses fails the call
	// (./judge-answers.ts); null while it gave none.
	readonly judge: () => JudgeProvider | null;
};

// `card`: its extension.json as read; refused, the bench throws why. `dataDir`: a new temporary folder by default.
// `userName`: "the user" by default.
export type BenchOptions = {
	readonly card: unknown;
	readonly language?: "en" | "fr";
	readonly dataDir?: string;
	readonly settings?: Json;
	readonly userName?: string;
};

const messageOf = (error: unknown) => (error instanceof Error ? error.message : String(error));
// As JSON carries it between the page and Sonar.
// oxlint-disable-next-line typescript/no-unsafe-type-assertion -- what JSON.stringify wrote, JSON.parse reads back as JSON
const asJson = (value: Json | undefined): Json => (value === undefined ? null : (JSON.parse(JSON.stringify(value)) as Json));
const bytesOf = (text: string) => new TextEncoder().encode(text).length;
const keyOf = (name: string, project: string | undefined) => JSON.stringify([name, project ?? null]);

const route = (table: Map<string, RouteHandler>) => (path: string, handle: RouteHandler) => {
	if (!path.startsWith("/")) throw new Error(`The path "${path}" must start with "/".`);
	table.set(path, handle);
};

async function answer(table: Map<string, RouteHandler>, request: RouteRequest): Promise<Answer> {
	const handle = table.get(request.path);
	if (!handle) return { status: 404, body: { error: `No route ${request.path}` } };
	try {
		return { status: 200, body: asJson(await handle(request)) };
	} catch (error) {
		return { status: routeStatus(error), body: { error: messageOf(error) } };
	}
}

// Its keys, read as Sonar reads them: only those its card declares, a project's with its project.
function keysOf(manifest: Manifest) {
	const given = new Map<string, string>();
	const read = async (name: string, project?: string) => {
		const key = manifest.keys?.find((each) => each.name === name);
		if (!key) throw new Error(`The key "${name}" is not declared by the extension's card.`);
		if (key.scope === "project" && !project) throw new Error(`The key "${name}" is kept per project: name the project.`);
		return given.get(keyOf(name, key.scope === "project" ? project : undefined))?.trim() || null;
	};
	return { read, set: (name: string, value: string, project?: string) => void given.set(keyOf(name, project), value) };
}

// Its tools: a refusal throws, and goes to its log, as in Sonar.
function toolsOf(id: string, log: string[]) {
	const tools = new Map<string, AgentTool>();
	const refused = (reason: string): never => {
		log.push(reason);
		throw new Error(reason);
	};
	const add = (tool: AgentTool) => {
		const full = `${id}_${tool.name}`;
		if (!isToolName(tool.name))
			refused(
				`The tool's name "${String(tool.name)}" must have 40 characters at most: lower case letters and digits, parts joined by one "_", a letter first.`,
			);
		if (!isToolFullName(full)) refused(`The tool's full name "${full}" must have ${TOOL_FULL_NAME_MOST} characters at most, the extension's id included.`);
		if (tools.has(full)) refused(`The tool "${full}" is already added.`);
		const wrong = wrongToolField(tool);
		if (wrong === "input") refused(`Sonar cannot read the schema of the arguments of the tool "${full}": it must describe an object (type "object").`);
		if (wrong) refused(`The field "${wrong}" of the tool "${full}" is missing or not of its type.`);
		tools.set(full, tool);
	};
	const call = async (
		name: string,
		input: Json,
		caller: ToolCaller = { handle: "s-test", sessionId: "test-session", project: "test" },
	): Promise<ToolAnswer> => {
		const tool = tools.get(name);
		if (!tool) return { text: `Unknown tool: ${name}.`, isError: true };
		try {
			const text: unknown = await tool.run(asJson(input), caller);
			return typeof text === "string" ? { text, isError: false } : { text: `${name} did not answer a text.`, isError: true };
		} catch (error) {
			return { text: `${name} failed: ${messageOf(error)}`, isError: true };
		}
	};
	return { add, call, list: () => Array.from(tools, ([name, tool]) => ({ name, readOnly: tool.readOnly === true })) };
}

// Its listeners, each on its own as in Sonar: one that throws stops neither the others nor the event. An event of a
// family its card does not declare is refused, as in Sonar. As Sonar notes a close before it tells it, the session
// closed joins `closed` (sessions.closed) first.
function eventsOf(log: string[], reads: Manifest["reads"], closed: ClosedSession[]) {
	const listeners = new Set<(data: ServerEvents["session-closed"]) => void>();
	const failed = (failure: unknown) => void log.push(`a listener of session-closed failed: ${messageOf(failure)}`);
	const emit = (_event: keyof ServerEvents, data: ServerEvents["session-closed"], task = false) => {
		closed.push({ ...data, task });
		for (const listen of listeners) {
			try {
				void Promise.resolve(listen(data)).catch(failed);
			} catch (failure) {
				failed(failure);
			}
		}
	};
	// `event` as plain JavaScript may give it: any value, a Symbol too, which would throw in a template.
	const on = (event: unknown, listen: (data: ServerEvents["session-closed"]) => void) => {
		const refusal = eventRefusal(reads, event);
		if (refusal === "unknown") throw new Error(`The event "${String(event)}" is not one of Sonar's: ${SERVER_EVENTS.join(", ")}.`);
		if (refusal) throw new Error(notDeclared(refusal.family, `on("${String(event)}")`));
		listeners.add(listen);
		return () => void listeners.delete(listen);
	};
	return { emit, on };
}

// The ports it fills, refused as Sonar refuses them: a port its card does not declare, one filled twice, or once its
// start ended. Until a test starts it through the bench, its start counts as under way.
function portsOf(provides: Manifest["provides"]) {
	let starting = true;
	let judge: JudgeProvider | null = null;
	const provide = (given: JudgeProvider) => {
		const refusal = provideRefusal(provides, "judge", starting, judge !== null);
		if (refusal === "undeclared") throw new Error(`Its card does not declare the port "judge": add "judge" to its "provides".`);
		if (refusal === "late") throw new Error(`The port "judge" is filled during its start only.`);
		if (refusal === "twice") throw new Error(`It already fills the port "judge".`);
		const provider = keptJudge(given);
		const named = judgeRefusal(provider);
		if (named === "lend-unnamed") throw new Error('Its judge lends a key without "lentAs": name the key it lends.');
		if (named === "lent-as-core")
			throw new Error(
				`Its judge's "lentAs" "${String(provider.lentAs)}" is a name Sonar lends itself (${CORE_LENT_NAMES.join(", ")}): name its key otherwise.`,
			);
		if (named) throw new Error(`Its judge's "lentAs" must have 2 to 40 characters: lower case letters, digits and "-".`);
		judge = provider;
	};
	const start = async (run: () => void | Stop | Promise<void | Stop>) => {
		try {
			return await run();
		} finally {
			starting = false;
		}
	};
	return { provide, start, judge: () => (judge ? checkedJudge(judge) : null) };
}

// Its settings, kept as JSON carries them.
function settingsOf(saved: Json): ServerApi["settings"] {
	let settings = saved;
	return {
		read: async () => settings,
		write: async (value) => {
			settings = asJson(value);
		},
	};
}

export function fakeServer(options: BenchOptions): Bench {
	const reading = readManifest(options.card);
	if ("refusal" in reading) throw new Error(`Its card is refused: ${JSON.stringify(reading.refusal)}`);
	const { manifest } = reading;
	const { id } = manifest;
	const routes = { get: new Map<string, RouteHandler>(), post: new Map<string, RouteHandler>() };
	const live: Json[] = [];
	const log: string[] = [];
	const keys = keysOf(manifest);
	const tools = toolsOf(id, log);
	const sessions: SessionLine[] = [];
	const projects: ProjectLine[] = [];
	const measures = measuresOf(manifest.reads);
	const events = eventsOf(log, manifest.reads, measures.bench.closed);
	const { trust, closed, ...reads } = measures.api;
	const ports = portsOf(manifest.provides);
	const api: ServerApi = {
		contract: manifest.contract,
		id,
		language: () => options.language ?? "en",
		userName: () => options.userName ?? "the user",
		log: (message) => void log.push(message),
		dataDir: options.dataDir ?? mkdtempSync(join(tmpdir(), `${id}-`)),
		routes: { get: route(routes.get), post: route(routes.post) },
		live: {
			send: (data) => {
				const bytes = bytesOf(JSON.stringify({ type: "ext", id, data }));
				if (bytes > LIVE_MOST) throw new Error(`Live message too big: ${bytes} bytes, ${LIVE_MOST} at most.`);
				live.push(asJson(data));
			},
		},
		settings: settingsOf(options.settings ?? null),
		keys: { read: keys.read },
		tools: { add: tools.add },
		sessions: { list: async () => [...sessions], closed },
		projects: { list: async () => [...projects], trust },
		...reads,
		on: events.on,
		provide: { judge: ports.provide },
	};
	return {
		api,
		get: (path, query = {}) => answer(routes.get, { path, query, body: undefined }),
		post: (path, body) => answer(routes.post, { path, query: {}, body: body === undefined ? undefined : asJson(body) }),
		live,
		log,
		setKey: keys.set,
		sessions,
		projects,
		emit: events.emit,
		measures: measures.bench,
		tools: tools.list,
		call: tools.call,
		start: (start) => ports.start(() => start(api)),
		judge: ports.judge,
	};
}
