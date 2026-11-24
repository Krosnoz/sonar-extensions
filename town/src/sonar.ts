// What the town takes of Sonar: the API of the contract its entry is given (./start.ts), as an extension of another
// repository takes it. The town reads nothing else of the page.

import type { PageApi, PageLook, PageMap, PageSession, PageSounds } from "@sonar/extension";

// The parts of the API the town needs, each of them: a Sonar older than one of them does not start the town.
export type Sonar = PageApi & {
	readonly map: Required<PageMap>;
	readonly look: PageLook;
	readonly sounds: PageSounds;
	readonly session: (handle: string) => PageSession | null;
	readonly openSession: (handle: string) => void;
};

let given: Sonar | null = null;

// Kept once, by the entry. Throws for a Sonar that lacks a part: its start then cuts the town for the page.
export function hold(api: PageApi): Sonar {
	const { map, look, sounds, session, openSession } = api;
	if (!map?.hide || !map.floating || !look || !sounds || !session || !openSession) throw new Error("This Sonar is older than the town.");
	const { hide, floating } = map;
	given = { ...api, map: { ...map, hide, floating }, look, sounds, session, openSession };
	return given;
}

// What the page keeps floating over the Map, which the signs keep clear of. Before the start, in the tests that lay
// the signs without a page: nothing.
export const floating = (): readonly DOMRect[] => given?.map.floating() ?? [];
// The project the Map shows, "" for none: its town's style and draws come from its name. Before the start, in the
// tests that build the town without a page: none.
export const shownProject = (): string => given?.map.shown().project ?? "";

export function sonar(): Sonar {
	if (!given) throw new Error("The town has not started.");
	return given;
}
