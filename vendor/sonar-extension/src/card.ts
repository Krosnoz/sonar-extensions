// The card: extension.json at the root of the extension, read without running any of its code (./manifest.ts), its
// words in other languages checked and read by ./card-texts.ts. Types only.

import type { ReadFamily } from "./contract";
import type { Port } from "./ports";

// A key the extension keeps in Sonar's secrets, under its name: one for the user, or one per project. `why`: what the
// card of the key in Settings › Services says, where to find it and what it opens (KEY_WHY_MOST characters at most).
export type ManifestKey = { readonly name: string; readonly scope: "user" | "project"; readonly label?: string; readonly why?: string };

// The card's words in one language, each in place of the card's own: a word it does not give stays the card's. `keys`:
// by the name of a key the card declares.
export type CardTranslation = {
	readonly name?: string;
	readonly summary?: string;
	readonly description?: string;
	readonly keys?: { readonly [name: string]: { readonly label?: string; readonly why?: string } };
};

export type Manifest = {
	// Lower case letters, digits and dashes, 2 to 40 characters, a letter first; never a name the core reserves. The
	// extension's folder bears it.
	readonly id: string;
	readonly name: string;
	readonly version: string;
	// The version of this contract the extension was built against: refused when the core does not serve it.
	readonly contract: number;
	// What its line in Settings › Extensions says under its name, a few words (SUMMARY_MOST characters at most); the
	// description is the whole sentence, its tip. Without a summary, the description says both.
	readonly summary?: string;
	readonly description?: string;
	// Its words in other languages, by language code ("fr"): Sonar shows those of the page's language.
	readonly translations?: { readonly [language: string]: CardTranslation };
	// Files of the extension, relative to its root, with forward slashes: an SVG icon, its entries already built (one
	// file each, no import left to resolve), its style sheet.
	readonly icon?: string;
	readonly server?: string;
	readonly page?: string;
	readonly styles?: string;
	// The other files its page loads, each by its path: a part of its code imported once a screen opens, its images.
	// Served at /ext/<id>/<path> while it runs, as its page; the page reaches them from its module's own address
	// (`new URL("./later.js", import.meta.url)`).
	readonly files?: readonly string[];
	readonly keys?: readonly ManifestKey[];
	// The hosts it calls (api.example.com), and whether one of them bills: told to the user before it is installed.
	readonly calls?: readonly string[];
	readonly paid?: boolean;
	// What it reads of what Sonar measures, told to the user before it is installed: a read of a family it does not
	// declare throws. It informs the user, it is no barrier: the extension runs in Sonar's process.
	readonly reads?: readonly ReadFamily[];
	// The ports of the core it fills (ServerApi's provide). The card of the preview (POST /api/extensions/preview) carries
	// them; the page will show them before the install in a later version.
	readonly provides?: readonly Port[];
};
