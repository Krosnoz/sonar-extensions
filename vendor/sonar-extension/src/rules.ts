// Rules of the contract both sides apply: the core (apps/server) and the testing kit (./testing.ts). An extension tested
// with the kit meets in Sonar the refusals it met in its tests.

import type { CoreScreen, PartPlaces, ReadFamily, ServerEvents, ToastTone } from "./contract";
import type { Port } from "./ports";

// What one live message may weigh, as JSON in its envelope { type: "ext", id, data }: the socket of a phone carries
// every extension's.
export const LIVE_MOST = 64 * 1024;

// A tool's name: its parts joined by one underscore, so that its full name (<id>_<name>) never holds "__", which Sonar's
// MCP server keeps for the tools of other servers.
const TOOL_NAME = /^[a-z][a-z0-9]*(?:_[a-z0-9]+)*$/;
const TOOL_NAME_MOST = 40;
export const isToolName = (name: unknown): name is string => typeof name === "string" && name.length <= TOOL_NAME_MOST && TOOL_NAME.test(name);

// Claude Code names a tool of Sonar's MCP server mcp__sonar__<name>, and takes 64 characters at most: a tool's full name
// holds in what is left. The gateway's names hold in it too (apps/server/src/mcp/gateway-names.ts).
export const TOOL_FULL_NAME_MOST = 64 - "mcp__sonar__".length;
export const isToolFullName = (full: string): boolean => full.length <= TOOL_FULL_NAME_MOST;

// The first field of a tool, beside its name, that is missing or not of its type; null when none is. The extension's
// code is plain JavaScript: each field is checked as it came. "input" must be the schema of an object.
export function wrongToolField(tool: { readonly [field: string]: unknown }): "description" | "run" | "input" | null {
	const { description, run, input } = tool;
	if (typeof description !== "string" || !description.trim()) return "description";
	if (typeof run !== "function") return "run";
	return typeof input === "object" && input !== null && !Array.isArray(input) && "type" in input && input.type === "object" ? null : "input";
}

// The core's events an extension listens to (ServerEvents of ./contract.ts): another name is refused, rather than heard
// never.
export const SERVER_EVENTS: readonly (keyof ServerEvents)[] = ["session-closed"];
const isServerEvent = (name: unknown): name is keyof ServerEvents => SERVER_EVENTS.some((each) => each === name);

// The family of what Sonar measures each event tells: a read of that family gives the same lines (sessions.closed).
const EVENT_FAMILIES: { readonly [Name in keyof ServerEvents]: ReadFamily } = { "session-closed": "sessions" };

// Why an extension may not listen to `event`: a name Sonar does not tell, or a family its card does not declare; null
// when it may.
export function eventRefusal(reads: readonly ReadFamily[] | undefined, event: unknown): { readonly family: ReadFamily } | "unknown" | null {
	if (!isServerEvent(event)) return "unknown";
	const family = EVENT_FAMILIES[event];
	return reads?.includes(family) ? null : { family };
}

// The families of what Sonar measures a card may declare (Manifest.reads of ./contract.ts).
export const READ_FAMILIES: readonly ReadFamily[] = ["usage", "presence", "tasks", "sessions", "merges", "commands", "trust"];
export const isReadFamily = (value: unknown): value is ReadFamily => READ_FAMILIES.some((each) => each === value);

// A read of what Sonar measures, kept to the families its card declares: another throws `refused(family, call)`, which
// names the family to declare. `call`: the read as the extension writes it (usage.days).
export const declaredOnly =
	(reads: readonly ReadFamily[] | undefined, refused: (family: ReadFamily, call: string) => string) =>
	<Args extends unknown[], Value>(family: ReadFamily, call: string, read: (...args: Args) => Promise<Value>) =>
	async (...args: Args): Promise<Value> => {
		if (!reads?.includes(family)) throw new Error(refused(family, call));
		return read(...args);
	};

// A read's bound (Since of ./contract.ts) as the extension's plain JavaScript gives it: an object whose `since` is a
// finite number. Another one throws, rather than read everything or nothing.
export const isSince = (bound: unknown): bound is { readonly since: number } =>
	typeof bound === "object" && bound !== null && "since" in bound && typeof bound.since === "number" && Number.isFinite(bound.since);

// The screens the core keeps where an extension draws a part (PartSlot of ./contract.ts), each with its places in their
// order on the screen (docs/extensions.md says what each one holds).
export const PART_PLACES: { readonly [Screen in keyof PartPlaces]: readonly PartPlaces[Screen][] } = {
	statistics: ["top", "accounts", "bottom"],
	"project-statistics": ["main"],
	services: ["section"],
	agents: ["notes"],
	map: ["tools", "layer"],
	"project-general": ["sections"],
};
// The same, read by any name: the extension's plain JavaScript may give anything.
const placesByName: { readonly [screen: string]: readonly string[] } = PART_PLACES;

// Whether a part goes there: a screen and one of its places that the core names. The extension's plain JavaScript may
// give anything.
export const isPartPlace = (screen: unknown, place: unknown): boolean =>
	typeof screen === "string" && Object.hasOwn(PART_PLACES, screen) && placesByName[screen]?.some((each) => each === place) === true;

// A toast an extension's page shows (PageUi's `toast` of ./contract.ts): a plain text, never HTML, of TOAST_MOST
// characters at most, in one of the core's tones. Its plain JavaScript may give anything: another text or tone is
// refused, with what is wrong.
export const TOAST_MOST = 200;
export const TOAST_TONES: readonly ToastTone[] = ["info", "error"];
export function toastRefusal(text: unknown, tone: unknown): "text" | "long" | "tone" | null {
	if (typeof text !== "string" || !text.trim()) return "text";
	if (text.length > TOAST_MOST) return "long";
	return tone === undefined || TOAST_TONES.some((each) => each === tone) ? null : "tone";
}

// TOAST_PACE.most toasts in TOAST_PACE.ms at most for each extension: one past them is left out, without a word, so
// that a loop does not cover the screen. A pace of its own for each extension: whether a toast asked `now` may show.
export const TOAST_PACE = { most: 3, ms: 10_000 } as const;
export function toastPace(): (now: number) => boolean {
	const shown: number[] = [];
	return (now) => {
		while (shown.length && now - (shown[0] ?? now) >= TOAST_PACE.ms) shown.shift();
		if (shown.length >= TOAST_PACE.most) return false;
		shown.push(now);
		return true;
	};
}

// The core's screens an extension's page shows by name (PageApi's `open` of ./contract.ts): "trust", a project's trust;
// "project-statistics", a project's statistics (the screen of PART_PLACES); "services", Sonar's Services, where its keys
// are given. A link from its own blocks to the core's screen that says more, as the statistics' "See the trust", a line
// of every project's that opens the project's own, or a note that asks for its key.
export const CORE_SCREENS: readonly CoreScreen[] = ["trust", "project-statistics", "services"];
export const isCoreScreen = (name: unknown): name is CoreScreen => CORE_SCREENS.some((each) => each === name);

// The ports of the core a card may declare it fills (Manifest.provides of ./contract.ts).
export const PORTS: readonly Port[] = ["judge", "tickets"];
export const isPort = (value: unknown): value is Port => PORTS.some((each) => each === value);

// Why an extension may not fill `port` now (ServerApi's provide of ./contract.ts): its card does not declare it, its
// start ended, or it filled it already; null when it may.
export const provideRefusal = (
	provides: readonly Port[] | undefined,
	port: Port,
	starting: boolean,
	filled: boolean,
): "undeclared" | "late" | "twice" | null => (!provides?.includes(port) ? "undeclared" : !starting ? "late" : filled ? "twice" : null);

// Whether a port's call failed as "off" (./ports.ts): the core then does without the answer, as with no extension.
export const isOff = (error: unknown): boolean => typeof error === "object" && error !== null && "off" in error && error.off === true;

// Whether a tickets call failed as "refused" (./ports.ts): the tracker refused the project's key, which is not an
// unreachable tracker.
export const isRefused = (error: unknown): boolean => typeof error === "object" && error !== null && "refused" in error && error.refused === true;

// What a route that throws answers: 500, unless the extension gave its Error a status from 400 to 499.
export const routeStatus = (error: unknown): number => {
	const status = typeof error === "object" && error !== null ? (error as { readonly status?: unknown }).status : undefined;
	return typeof status === "number" && Number.isInteger(status) && status >= 400 && status < 500 ? status : 500;
};
