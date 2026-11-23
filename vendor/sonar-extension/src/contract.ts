// The contract between Sonar and an extension, version 1: what an extension published in a repository of its own may
// rely on. Plain data, plain functions and Promises only: no library of the core crosses it (no Effect, no Schema), so
// an extension built once keeps working while the core changes. An extension imports nothing of Sonar when it runs: its
// entries receive this API as their one argument. Types only here; the core fills them (apps/server, apps/web).
//
// A change that an extension built against version 1 would not survive raises CONTRACT; an addition does not. The
// contract promises only what the core does.
//
// A session has two names. `handle` ("s-…") is the name Sonar gives a session while it is open; `sessionId` is its
// agent's own id (its transcript's), which outlives the handle, and the one every read of what Sonar measures gives.
// What Sonar measures has its types in ./measures.ts; the ports an extension fills, in ./ports.ts.

import type { JudgeProvider } from "./ports";
import type {
	ClosedSession,
	Covered,
	LandedMerge,
	PresenceMinute,
	ProjectTrust,
	SessionTimeline,
	Since,
	StoppedCommand,
	TaskLine,
	UsageLine,
	Velocity,
} from "./measures";

export const CONTRACT = 1;

// Anything JSON carries.
export type Json = null | boolean | number | string | readonly Json[] | { readonly [key: string]: Json };

// The card (extension.json) has its types in ./card.ts.

// A family of what Sonar measures (ServerApi below): `usage` (usage.days, usage.timeline, usage.velocity), `presence`,
// `tasks`, `sessions` (sessions.closed and the event "session-closed"), `merges`, `commands`, `trust` (projects.trust).
// sessions.list and projects.list need none: what is open now is no measure. A card declares those it reads.
export type ReadFamily = "usage" | "presence" | "tasks" | "sessions" | "merges" | "commands" | "trust";

// --- The server's side: `export function start(api)` of the file `server` names. ---

export type RouteRequest = {
	// The path after /api/ext/<id>, with its leading slash.
	readonly path: string;
	readonly query: Readonly<Record<string, string>>;
	// The body decoded from JSON; undefined without one.
	readonly body: Json | undefined;
};
// Answers JSON. A thrown Error becomes a 500 with its message, as { error }; one with a `status` from 400 to 499
// (Object.assign(new Error("…"), { status: 404 })) that status.
export type RouteHandler = (request: RouteRequest) => Json | Promise<Json>;

// A tool given to the agents through Sonar's MCP server, named <id>_<name>. `name`: lower case letters and digits,
// parts joined by one underscore, a letter first, 40 characters at most; its full name 52 at most (./rules.ts). `input`: a JSON Schema (draft 2020-12) of an
// object, its arguments, checked before `run`. `readOnly`: it changes nothing, so a session that only reads may call it.
// The text it answers is read by the agent; a thrown Error is told to the agent as the tool's failure. `caller`: the
// calling session, by its handle and its agent's session id (null while Sonar knows none: its agent has none yet, or it
// runs on a linked computer), and its project.
export type AgentTool = {
	readonly name: string;
	readonly description: string;
	readonly input: { readonly [key: string]: Json };
	readonly readOnly?: boolean;
	readonly run: (input: Json, caller: { readonly handle: string; readonly sessionId: string | null; readonly project: string }) => string | Promise<string>;
};

// An open session. `sessionId`: its agent's session id, null until its agent has one.
export type SessionLine = {
	readonly handle: string;
	readonly sessionId: string | null;
	readonly name: string;
	readonly project: string;
	readonly folder: string;
	readonly working: boolean;
};
export type ProjectLine = { readonly name: string; readonly folder: string };

export type ServerEvents = {
	// A session the user closed: its handle, and its agent's session id (null when its agent had none).
	readonly "session-closed": {
		readonly handle: string;
		readonly sessionId: string | null;
		readonly name: string;
		readonly project: string;
		readonly at: number;
	};
};

export type ServerApi = {
	readonly contract: number;
	readonly id: string;
	// The language the user reads: the extension brings its own texts.
	readonly language: () => "en" | "fr";
	// The user's name, as Sonar's settings give it.
	readonly userName: () => string;
	// A line in Sonar's log, under the extension's id.
	readonly log: (message: string) => void;
	// A folder of its own, kept between versions, for what it stores: made when it is first read.
	readonly dataDir: string;
	// Routes under /api/ext/<id>, one handler per method and path.
	readonly routes: {
		readonly get: (path: string, handle: RouteHandler) => void;
		readonly post: (path: string, handle: RouteHandler) => void;
	};
	// A message to every page open, received by the extension's page entry alone (PageApi.live). Throws past 64 KiB of
	// JSON.
	readonly live: { readonly send: (data: Json) => void };
	// Its own settings, in Sonar's settings file under extensions.<id>: null while none is saved.
	readonly settings: { readonly read: () => Promise<Json>; readonly write: (value: Json) => Promise<void> };
	// A key its card declares; null while the user gave none. A key the card does not declare is refused.
	readonly keys: { readonly read: (name: string, project?: string) => Promise<string | null> };
	// Throws when the name is malformed, too long with its id, taken by another of its tools or by one of the core's, or when the core cannot
	// read its input's schema.
	readonly tools: { readonly add: (tool: AgentTool) => void };
	// The open sessions; those the user closed, the oldest first (`from`: the first close Sonar keeps).
	readonly sessions: {
		readonly list: () => Promise<readonly SessionLine[]>;
		readonly closed: (bound: Since) => Promise<Covered<ClosedSession>>;
	};
	// The projects; the trust of each one Sonar knows the folder of, as Sonar measured it last (it reads each one's git
	// history: calls close together share one measure).
	readonly projects: { readonly list: () => Promise<readonly ProjectLine[]>; readonly trust: () => Promise<readonly ProjectTrust[]> };
	// The agents' work: by day and session, from the day of `from` on, the oldest day first, then by session id in the
	// order JavaScript sorts strings (`from`: the later of `since` and the start of the oldest day Sonar keeps whole, some
	// weeks back; null until Sonar has read its agents' files once since it started); a session's timeline from `since`,
	// never before that oldest day; the velocity as Sonar computed it last, null before its first computation or while the
	// user does not want their activity measured.
	readonly usage: {
		readonly days: (bound: Since) => Promise<Covered<UsageLine>>;
		readonly timeline: (sessionId: string, bound: Since) => Promise<SessionTimeline>;
		readonly velocity: () => Promise<Velocity | null>;
	};
	// The delegated tasks ended at `from` or after, and those not ended, the first delegated first. `from`: as far back as
	// Sonar keeps an ended task (setting `retention.historyDays`).
	readonly tasks: { readonly list: (bound: Since) => Promise<Covered<TaskLine>> };
	// The user's minutes, the oldest first. `from`: the first minute Sonar keeps; null while the user does not want their
	// activity measured (setting `metrics`).
	readonly presence: { readonly minutes: (bound: Since) => Promise<Covered<PresenceMinute>> };
	// The merges landed, the oldest first. `from`: the first merge Sonar keeps, null while it keeps none.
	readonly merges: { readonly landed: (bound: Since) => Promise<Covered<LandedMerge>> };
	// The commands Sonar stopped, the oldest first. `from`: as far back as Sonar keeps them.
	readonly commands: { readonly stopped: (bound: Since) => Promise<Covered<StoppedCommand>> };
	// Returns what stops the listening. Throws for an event the core does not tell, or one of a family its card does not
	// declare (`sessions` for "session-closed": sessions.closed gives the same).
	readonly on: <Name extends keyof ServerEvents>(event: Name, listen: (data: ServerEvents[Name]) => void) => () => void;
	// Fills a port of the core (./ports.ts), during its start only. Throws for a port its card does not declare
	// (`provides`), one it filled already, or once its start ended.
	readonly provide: { readonly judge: (provider: JudgeProvider) => void };
};

// What `start` may return: called once when the server stops.
export type Stop = () => void | Promise<void>;
export type ServerEntry = { readonly start: (api: ServerApi) => void | Stop | Promise<void | Stop> };

// --- The page's side: `export function start(api)` of the file `page` names. ---

// A screen the extension draws in a place the core names: `mount` the first time it shows (once per page load, and per
// project for a project's screen: the screen is kept between two openings of the settings), then `enter` each time it
// shows, `leave` when it hides. One of them that throws cuts the extension for the page.
export type ScreenSlot = {
	readonly title: string;
	// An icon of the core's set, by its name; a name the core does not know shows its plug.
	readonly icon?: string;
	readonly mount: (node: HTMLElement, context: { readonly project?: string }) => { readonly enter?: () => void; readonly leave?: () => void } | void;
};

// A part the extension draws in a screen the core keeps, at a place that screen names (PART_PLACES of ./rules.ts):
// "statistics", Sonar's statistics, or "project-statistics", a project's, whose `mount` gets `{ project }`; "services",
// what it shows in Sonar's Services screen, in the group of the first key its card declares, after the key (drawn again
// once the key is given or changed), else in a group of its own; "agents", a note at the top of the Agents tab. It follows a screen's rules: `mount`
// once per page load (and per project), then `enter` each time the screen shows, `leave` when it hides (the Agents tab
// stays drawn: its notes get one `enter`, no `leave`); one of them that throws cuts the extension for the page, and its
// parts leave their places. Its node is drawn in the place's flow, as if its children were the place's. The core offers
// the statistics while a part is placed in them.
export type PartSlot = {
	readonly [Screen in keyof PartPlaces]: { readonly screen: Screen; readonly place: PartPlaces[Screen]; readonly mount: ScreenSlot["mount"] };
}[keyof PartPlaces];
// The places of each screen the core keeps where an extension draws a part (PART_PLACES of ./rules.ts).
export type PartPlaces = {
	readonly statistics: "top" | "accounts" | "bottom";
	readonly "project-statistics": "main";
	readonly services: "section";
	readonly agents: "notes";
};
// The tones of a toast (TOAST_TONES of ./rules.ts).
export type ToastTone = "info" | "error";
// The core's screens an extension's page shows by name (CORE_SCREENS of ./rules.ts): a project's, or Sonar's Services.
export type CoreScreen = "trust" | "project-statistics" | "services";

export type PageSlots = {
	// A screen of Sonar's settings, after the core's.
	readonly settingsScreen: (screen: ScreenSlot) => void;
	// A screen of each project's settings.
	readonly projectScreen: (screen: ScreenSlot) => void;
	// A part in a screen the core keeps. Throws for a screen or a place the core does not name.
	readonly part: (part: PartSlot) => void;
	// An action of the command bar.
	readonly command: (action: { readonly title: string; readonly icon?: string; readonly hint?: string; readonly run: () => void }) => void;
};

// The core's interface parts an extension reuses, so that it looks and behaves as the rest: each returns a node.
export type PageUi = {
	readonly el: (tag: string, className?: string, text?: string) => HTMLElement;
	readonly icon: (name: string) => HTMLElement;
	readonly fold: (title: string, body: HTMLElement) => HTMLElement;
	readonly empty: (title: string, text?: string) => HTMLElement;
	readonly segmented: (options: readonly { readonly id: string; readonly label: string }[], chosen: string, choose: (id: string) => void) => HTMLElement;
	// What `node` counts, on hover. With `name`, `node` also takes the keyboard's focus, says `name` to a screen reader,
	// and a touch shows the tip: for a figure that is not a control.
	readonly tip: (node: HTMLElement, text: string, name?: string) => void;
	// Ping's cloud of dots in the corner of a tile. `seed` keeps its shape from one drawing to the next.
	readonly cloud: (tile: HTMLElement, seed: string) => void;
	// A reading that failed, said once in its place with "Retry".
	readonly failure: (reason: string, retry: () => void) => HTMLElement;
	// Fills `place` with what `read` gives: dots while it waits, then `draw`, or the failure said once with "Retry". Only
	// the last `load` of a place draws; one that ends once its screen left draws in the part kept.
	readonly load: <Value>(place: HTMLElement, read: () => Promise<Value>, draw: (value: Value) => HTMLElement | readonly HTMLElement[]) => Promise<void>;
	// A brief message at the top of the screen, the core's toast ("info" by default): a plain text, 200 characters at
	// most, else it throws (toastRefusal of ./rules.ts). Past 3 in 10 s, one is left out (TOAST_PACE); the same text
	// already on screen is not shown twice. Sonar signs it with the extension's name; the extension has one on screen,
	// the new one in place of its own, and never makes one of Sonar's leave.
	readonly toast: (text: string, tone?: ToastTone) => void;
	// A message that matters, said to the user: Ping says it in his bubble while the voice runs, else it is the
	// extension's error toast. Signed with the extension's name, bounded as a toast's text (it throws as one), 3 in 10 s.
	// Absent from a Sonar older than it: an extension calls `api.ui.say?.(text)`, or its toast without it.
	readonly say?: (text: string) => void;
	// The core's switch in its labelled row, as a setting's. A click moves it and calls `change` with its new position;
	// held while `change` runs, its `disabled` left as the extension sets it. If it rejects, the switch goes back and the
	// failure is said by the extension's `toast` (Sonar's default words for one it refuses); if it throws at once, the
	// extension is cut, as by a listener's throw.
	// `hint`: its tip. `disabled`: held (a key still to give).
	readonly toggle: (
		label: string,
		on: boolean,
		change: (on: boolean) => Promise<unknown> | void,
		options?: { readonly hint?: string; readonly disabled?: boolean },
	) => HTMLElement;
	// The core's number field in its labelled row, as a setting's: its label tied to the field, `hint` under it, and the
	// line that says how the saving went. The value leaves when the field is left or on Enter, only when it changed: the
	// number, or null for an empty field. A text that is no finite number, or one under `min`, is refused on the spot in
	// that line, `change` not called. Held while `change` runs; "Saved" once it resolves; if it rejects, the line says its
	// Error's message (Sonar's default words for one a toast refuses), and the field keeps what is written; if it throws at
	// once, the extension is cut, as by a listener's throw. `alert`: said in that line in the error's tone while the field
	// holds the value it was drawn with and nothing else is said there, bounded as a toast's text (it throws as one).
	// `placeholder`: the field's words while it is empty.
	// `disabled`: held. Its words are set as plain text. The extension draws the row again to change its value.
	// Absent from a Sonar older than it: an extension tests `api.ui.number` before its call.
	readonly number?: (
		label: string,
		value: number | null,
		change: (value: number | null) => Promise<unknown> | void,
		options?: {
			readonly hint?: string;
			readonly min?: number;
			readonly step?: number;
			readonly placeholder?: string;
			readonly disabled?: boolean;
			readonly alert?: string;
		},
	) => HTMLElement;
	// The core's note, as a plugin's at the top of the Agents tab: a plain text, then `action` as a link, and a × that
	// hides it and calls `close`. One of them that throws cuts the extension.
	readonly note: (
		text: string,
		options?: { readonly action?: { readonly label: string; readonly run: () => void }; readonly close?: () => void },
	) => HTMLElement;
};

export type PageApi = {
	readonly contract: number;
	readonly id: string;
	readonly language: "en" | "fr";
	readonly slots: PageSlots;
	readonly ui: PageUi;
	// Its own routes, by their path after /api/ext/<id>. A refusal throws an Error with the reason.
	readonly http: {
		readonly get: (path: string, query?: Readonly<Record<string, string>>) => Promise<Json>;
		readonly post: (path: string, body?: Json) => Promise<Json>;
	};
	// What its server entry sent; returns what stops the listening.
	readonly live: { readonly on: (listen: (data: Json) => void) => () => void };
	// A value kept in this browser, under the extension's id.
	readonly storage: { readonly read: (key: string) => string | null; readonly write: (key: string, value: string) => void };
	// Shows one of its own screens by its title: a project's when `project` is given, else in the settings shown, or in
	// those the page opens on its own project. Or a screen of the core's by its name (CORE_SCREENS of ./rules.ts): a
	// project's in place when that project's settings show, else in its settings opened on it; Sonar's Services, where its
	// keys are given, in the settings shown, else in those the page opens. Throws for a title it did not place, a name the
	// core does not give, or a project's screen of the core's without its project.
	readonly open: (
		screen:
			| { readonly title: string; readonly project?: string }
			| { readonly core: Exclude<CoreScreen, "services">; readonly project: string }
			| { readonly core: "services" },
	) => void;
};

// Its start ends within 10 s, or the extension is cut for the page, as when it throws.
export type PageEntry = { readonly start: (api: PageApi) => void | Promise<void> };
