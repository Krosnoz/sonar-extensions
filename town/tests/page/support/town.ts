// What the town's page tests share about the extension: the bench lays it from this repository's release, and the
// tests read its style's route and the addresses of its pictures and sounds.

import { join } from "node:path";

// release/ at this repository's root, written by `bun run build` there (town.json and town.tar.gz among its files).
const RELEASE = join(import.meta.dirname, "..", "..", "..", "..", "release");

const more = (name: string, value: string) => (process.env[name] = [process.env[name], value].filter(Boolean).join(","));
// Called before the bench starts: the bench lays the extension, switched on. A copy of Sonar that still has its own town
// (its plugin "world") would give two icons and each sound's line twice: the plugin is switched off, which changes
// nothing on a Sonar without it.
export function inTownMode(): void {
	process.env["BENCH_RELEASE"] = RELEASE;
	more("BENCH_RELEASE_EXTENSIONS", "town");
	more("BENCH_PLUGINS_OFF", "world");
}

// A project's town style, as the extension's server part keeps it.
export type TownStyle = { style: string | null; drawn: string | null };
// The route that saves a style, and the one that reads it, as a test intercepts them.
export const STYLE_ROUTE = "**/api/ext/town/style";
export const STYLE_READ_ROUTE = `${STYLE_ROUTE}?*`;
// The address the pictures of the styles are served from.
export const TOWN_PICTURES = "/ext/town/towns";
// The address the town's sound files are served from.
const TOWN_SOUNDS = "/ext/town/sounds/";
// The sound file a request asks for, under Sonar's sounds or the town's; "" for another request.
export const soundFileOf = (path: string): string =>
	path.startsWith(TOWN_SOUNDS) ? path.slice(TOWN_SOUNDS.length) : path.startsWith("/sounds/") ? path.slice("/sounds/".length) : "";

// The bench's project alpha: its town style as kept, and a choice saved ("automatic" for the draw).
export function townStyleOf(base: string): { kept: () => Promise<TownStyle>; choose: (style: string) => Promise<Response> } {
	return {
		kept: async () => (await (await fetch(`${base}/api/ext/town/style?project=alpha`)).json()) as TownStyle,
		choose: (style) =>
			fetch(`${base}/api/ext/town/style`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ project: "alpha", style }) }),
	};
}

// A reading of the style, as a project whose town was never opened answers it.
export const NEVER_DRAWN: TownStyle = { style: null, drawn: null };
