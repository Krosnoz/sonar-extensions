// What every block of the page reads: the API Sonar gives the page entry, the texts and formats of the page's language.
// Kept once, as the entry starts (../page.ts); the blocks read it when they draw, never on import.

import type { PageApi } from "@sonar/extension";
import { type Formats, formatsOf } from "./format";
import { english, type Texts } from "./texts";
import { french } from "./texts-fr";

export type Kit = { readonly api: PageApi; readonly ui: PageApi["ui"]; readonly texts: Texts; readonly format: Formats };

let kept: Kit | null = null;

export function keep(api: PageApi): void {
	const texts = api.language === "fr" ? french : english;
	kept = { api, ui: api.ui, texts, format: formatsOf(api.language === "fr" ? "fr-FR" : "en-US", texts) };
}

export function kit(): Kit {
	if (kept === null) throw new Error("The statistics' page entry has not started.");
	return kept;
}
