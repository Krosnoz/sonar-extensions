// The words of an extension's card, the user reads them: whether a name signs, its short line (`summary`), why each key
// is asked (`why`), and its words in other languages (`translations`), checked as ./manifest.ts checks the rest of the card, then the card read in one
// language. A word malformed refuses the card, named by its path in the card ("translations.fr.summary").

import type { CardTranslation, Manifest, ManifestKey } from "./card";
import type { Refusal } from "./manifest";

// A short line under the extension's name: as long as a toast at most (TOAST_MOST of ./rules.ts), the other sentence
// an extension writes for Sonar to show.
export const SUMMARY_MOST = 200;
// Why a key is asked, in the card of the key: where to find it and what it opens, two sentences. Longer, its card would
// fill a phone's screen.
export const KEY_WHY_MOST = 300;
// A language's code, as the page names its language ("fr", "en").
const LANGUAGE = /^[a-z]{2}$/;
const TRANSLATED = ["name", "summary", "description"] as const;
const KEY_TRANSLATED = ["label", "why"] as const;

type Fields = { readonly [key: string]: unknown };
export const isFields = (value: unknown): value is Fields => typeof value === "object" && value !== null && !Array.isArray(value);
export const isText = (value: unknown): value is string => typeof value === "string" && value.trim() !== "";
const textOrAbsent = (value: unknown) => value === undefined || isText(value);

// What draws nothing: spaces, controls, format characters (zero width…), combining marks alone, and the letters that
// are blank (the Hangul fillers, the empty braille cell).
const BLANK = /[\p{White_Space}\p{Cc}\p{Cf}\p{Z}\p{M}ᅟᅠ⠀ㅤﾠ]/gu;
// A name that signs: some character drawn, and not Sonar's, in any case or width ("Ｓｏｎａｒ"): its letters and digits
// alone, its punctuation and spaces left out ("Sonar.", "S.O.N.A.R"). Letters of another script that look alike are not
// told apart.
export const signs = (name: string) => {
	const drawn = name.normalize("NFKC");
	return drawn.replace(BLANK, "") !== "" && drawn.replace(/[^\p{L}\p{N}]/gu, "").toLowerCase() !== "sonar";
};

const tooLong = (field: string, text: unknown, most = SUMMARY_MOST): Refusal | null =>
	typeof text === "string" && text.length > most ? { kind: "too-long", field, most } : null;

// The words of the keys in one language, each by the name of a key the card declares.
function keysRefusal(at: string, keys: unknown, declared: readonly string[]): Refusal | null {
	if (keys === undefined) return null;
	if (!isFields(keys)) return { kind: "field", field: at };
	for (const [key, words] of Object.entries(keys)) {
		if (!declared.includes(key)) return { kind: "undeclared-key", field: at, key };
		if (!isFields(words)) return { kind: "field", field: `${at}.${key}` };
		const wrong = KEY_TRANSLATED.find((field) => !textOrAbsent(words[field]));
		if (wrong) return { kind: "field", field: `${at}.${key}.${wrong}` };
		const long = tooLong(`${at}.${key}.why`, words["why"], KEY_WHY_MOST);
		if (long) return long;
	}
	return null;
}

function translationRefusal(language: string, words: unknown, declared: readonly string[]): Refusal | null {
	if (!LANGUAGE.test(language)) return { kind: "language", language };
	const at = `translations.${language}`;
	if (!isFields(words)) return { kind: "field", field: at };
	const wrong = TRANSLATED.find((field) => !textOrAbsent(words[field]));
	if (wrong) return { kind: "field", field: `${at}.${wrong}` };
	const { name, summary, keys } = words;
	// Sonar signs its toasts with its name, in the page's language too.
	if (typeof name === "string" && !signs(name)) return { kind: "name", name };
	return tooLong(`${at}.summary`, summary) ?? keysRefusal(`${at}.keys`, keys, declared);
}

// The first word of a card, already checked field by field, that refuses it; null when they all pass. `keys`: those it
// declares.
export function wordsRefusal({ summary, translations }: Fields, keys: readonly ManifestKey[]): Refusal | null {
	const long =
		tooLong("summary", summary) ?? keys.reduce<Refusal | null>((found, key) => found ?? tooLong(`keys.${key.name}.why`, key.why, KEY_WHY_MOST), null);
	if (long) return long;
	const declared = keys.map((key) => key.name);
	for (const [language, words] of Object.entries(isFields(translations) ? translations : {})) {
		const refusal = translationRefusal(language, words, declared);
		if (refusal) return refusal;
	}
	return null;
}

const picked = (words: Fields, fields: readonly string[]) =>
	Object.fromEntries(fields.flatMap((field) => (isText(words[field]) ? [[field, words[field]]] : [])));

// The words of a card once checked, those it does not know left out.
export function takenTranslations(translations: Fields): { readonly [language: string]: CardTranslation } {
	return Object.fromEntries(
		Object.entries(translations).map(([language, words]) => {
			const own = isFields(words) ? words : {};
			const keys = isFields(own["keys"])
				? Object.fromEntries(Object.entries(own["keys"]).map(([key, texts]) => [key, picked(isFields(texts) ? texts : {}, KEY_TRANSLATED)]))
				: null;
			return [language, { ...picked(own, TRANSLATED), ...(keys ? { keys } : {}) }];
		}),
	);
}

// The card in `language`: its words translated there, the others as the card writes them. Without words in that
// language, the card itself.
export function localized(manifest: Manifest, language: string): Manifest {
	const words = manifest.translations?.[language];
	if (!words) return manifest;
	const { keys, ...texts } = words;
	return { ...manifest, ...texts, ...(manifest.keys ? { keys: manifest.keys.map((key) => ({ ...key, ...keys?.[key.name] })) } : {}) };
}
