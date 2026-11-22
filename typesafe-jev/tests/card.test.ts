// The card (extension.json) as Sonar reads it: accepted by the contract, and its words those Sonar's plugin `jev` had on
// its line in Settings › Extensions and on its key's card in Settings › Services, in English and in French.

import { expect, test } from "bun:test";
import { localized, readManifest } from "@sonar/extension";
import { card } from "./support";

const manifest = () => {
	const reading = readManifest(card);
	if ("refusal" in reading) throw new Error(JSON.stringify(reading.refusal));
	return reading.manifest;
};

test("in English: the plugin's short text on its line, and why its key is asked", () => {
	const { name, summary, keys } = localized(manifest(), "en");
	expect(name).toBe("Jev");
	expect(summary).toBe("Sentence and urgency of the cards");
	expect(keys).toEqual([
		{
			name: "typesafe",
			scope: "user",
			label: "TypeSafe",
			why: "It opens Jev: the sentence and the urgency of the cards, the messages waiting for you, the links between agents. Create it on typesafe.ai.",
		},
	]);
});

test("in French: the plugin's French words, its description too", () => {
	const { name, summary, description, keys } = localized(manifest(), "fr");
	expect(name).toBe("Jev");
	expect(summary).toBe("Phrase et urgence des cartes");
	expect(description).toStartWith("Jev, le modèle de TypeSafe, lit ce que disent tes agents");
	expect(keys?.[0]).toMatchObject({
		label: "TypeSafe",
		why: "Elle ouvre Jev : la phrase et l'urgence des cartes, les messages qui t'attendent, les liens entre agents. Crée-la sur typesafe.ai.",
	});
});

test("in a language the card has no words for, its own words", () => {
	expect(localized(manifest(), "de").summary).toBe("Sentence and urgency of the cards");
});
