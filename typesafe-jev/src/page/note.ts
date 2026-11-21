// Without a TypeSafe key, Jev reads no message: a note at the top of the Agents tab says what it changes (the decisions
// in their order of arrival, neither urgency nor "same topic" links on the map), with the way to Services, as Sonar's
// plugin's (its jev/note.ts). Its × hides it on this browser for good; it goes once the key is given, and comes back if
// the key is removed. A reading that fails leaves it as it was, without a word: the live connection's banner says an
// unreachable server.

import type { PageApi, PartSlot } from "@sonar/extension";
import type { Kit } from "./kit";
import type { SettingsHub } from "./settings";

const HIDDEN = "note-hidden";

export function notePart(api: PageApi, kit: Kit, settings: SettingsHub): PartSlot {
	return {
		screen: "agents",
		place: "notes",
		mount: (node) => {
			const note = api.ui.note(kit.texts.note.body, {
				action: { label: kit.texts.note.open, run: () => api.open({ core: "services" }) },
				close: () => api.storage.write(HIDDEN, "1"),
			});
			note.hidden = true;
			node.append(note);
			settings.hear((jev) => {
				note.hidden = jev.key !== null || api.storage.read(HIDDEN) === "1";
			});
			// The Agents tab stays drawn: entered once, when the page starts.
			return { enter: () => void settings.read().catch(() => undefined) };
		},
	};
}
