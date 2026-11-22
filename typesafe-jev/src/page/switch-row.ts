// Jev's switch in its part of Services (./services.ts), as Sonar's plugin's (its jev/switch.ts): acting at once.
// Without the key, the part is greyed and the switch shows off, held, its tip saying why: Jev is not called, and the
// setting saved comes back with the key.

import type { PageApi } from "@sonar/extension";
import type { Kit } from "./kit";
import type { JevView } from "./settings";

export function switchRow(api: PageApi, kit: Kit, part: HTMLElement, jev: JevView): HTMLElement {
	const keyed = jev.key !== null;
	part.classList.toggle("no-key", !keyed);
	// A refusal says Sonar's own words ("Settings not saved."), as the plugin's switch.
	const change = (on: boolean) => api.http.post("/settings", { on }).catch(() => Promise.reject(new Error("")));
	return api.ui.toggle(kit.texts.jevOn, keyed && jev.on, change, keyed ? {} : { hint: kit.texts.jevNeedsKey, disabled: true });
}
