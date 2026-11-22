// The page entry: Sonar's page calls start(api) once per page load, with the extension switched on. It draws what Sonar's
// plugin `jev` drew, in the places Sonar keeps for an extension: Jev's switch and usage in Services, under its TypeSafe
// key (./page/services.ts); the note of the Agents tab while TypeSafe has no key (./page/note.ts); and, when Jev switches
// itself off (its monthly cap reached, TypeSafe out of credits), the plugin's words said by Ping (ui.say), its switch
// moved without a new page. Its texts follow the page's language.

import type { PageApi } from "@sonar/extension";
import { kitOf } from "./page/kit";
import { stopText } from "./page/live";
import { notePart } from "./page/note";
import { servicesPart } from "./page/services";
import { settingsHub } from "./page/settings";

export function start(api: PageApi) {
	const kit = kitOf(api.language);
	const settings = settingsHub(api);
	api.slots.part(servicesPart(api, kit, settings));
	api.slots.part(notePart(api, kit, settings));
	api.live.on((data) => {
		const text = stopText(data, kit.texts);
		if (text === null) return;
		// A Sonar older than ui.say has only the toast.
		if (api.ui.say) api.ui.say(text);
		else api.ui.toast(text, "error");
		// Read without a word on a failure: the live connection's banner says an unreachable server.
		void settings.read().catch(() => undefined);
	});
}
