// The page's texts (src/page/texts.ts, src/page/texts-fr.ts): the same keys in both languages, a French that is not a
// copy of the English, and the words Sonar's plugin says when Jev switches itself off, as a toast Sonar shows.

import { expect, test } from "bun:test";
import { type Json, toastRefusal } from "@sonar/extension";
import { stopText } from "../src/page/live";
import { english } from "../src/page/texts";
import { french } from "../src/page/texts-fr";

// Every text of a dictionary by its path, a function said with sample arguments.
function said(texts: object, path = ""): Record<string, string> {
	const out: Record<string, string> = {};
	for (const [key, value] of Object.entries(texts)) {
		const at = `${path}${key}`;
		if (typeof value === "string") out[at] = value;
		else if (typeof value === "function") out[at] = String(value("1", "2", true));
		else Object.assign(out, said(value as object, `${at}.`));
	}
	return out;
}

test("the French has every key of the English, and none copied from it", () => {
	const [en, fr] = [said(english), said(french)];
	expect(Object.keys(fr).toSorted()).toEqual(Object.keys(en).toSorted());
	for (const [key, text] of Object.entries(en)) expect({ key, text: fr[key] }).not.toEqual({ key, text });
});

// Sonar says the extension's name before the words: they go on from it ("Jev is off: …"), and never name a setting
// the user cannot find on a screen.
test("Jev off at its cap or out of credits: the plugin's words without its name, a toast Sonar shows", () => {
	expect(stopText({ kind: "cap", usd: 2 }, english)).toBe("is off: it cost $2 this month, its cap. Turn it on again in Services, or raise its cap.");
	expect(stopText({ kind: "cap", usd: 2.5 }, french)).toBe("est coupé : il a coûté 2.5 $ ce mois-ci, son plafond. Rallume-le dans Services, ou monte son plafond.");
	expect(stopText({ kind: "credits" }, english)).toBe("is off: TypeSafe has no credits left. Turn it on again after the top-up.");
	expect(stopText({ kind: "credits" }, french)).toBe("est coupé : TypeSafe n'a plus de crédits. Rallume-le après la recharge.");
	for (const texts of [english, french])
		for (const data of [{ kind: "cap", usd: 2 }, { kind: "credits" }] as Json[]) expect(toastRefusal(stopText(data, texts), "error")).toBeNull();
});

test("any other message says nothing", () => {
	for (const data of [null, "cap", 2, [], {}, { kind: "cap" }, { kind: "cap", usd: "2" }, { kind: "cap", usd: Number.NaN }, { kind: "other" }] as Json[])
		expect(stopText(data, english)).toBeNull();
});
