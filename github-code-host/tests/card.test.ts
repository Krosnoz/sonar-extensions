// The card (extension.json) as Sonar reads it: accepted by the contract, with what it asks for, its words in English
// and in French. And the server entry as Sonar starts it: it fills the port, and calls the one address its card names.

import { expect, spyOn, test } from "bun:test";
import { KEY_WHY_MOST, localized, readManifest } from "@sonar/extension";
import { fakeServer } from "@sonar/extension/testing";
import { start } from "../src/server";
import { viewer } from "./fake-github";
import { card } from "./support";

const manifest = () => {
	const reading = readManifest(card);
	if ("refusal" in reading) throw new Error(JSON.stringify(reading.refusal));
	return reading.manifest;
};

test("the card is accepted: a key per project, one address called, the port codeHost, nothing paid nor measured", () => {
	const { id, name, contract, keys, calls, provides, paid, reads } = manifest();
	expect({ id, name, contract, calls, provides, paid, reads }).toEqual({
		id: "github-code-host",
		name: "GitHub",
		contract: 1,
		calls: ["api.github.com"],
		provides: ["codeHost"],
		paid: undefined,
		reads: undefined,
	});
	expect(keys).toEqual([
		{
			name: "token",
			scope: "project",
			label: "GitHub",
			why: "It opens the pull requests and their CI on the cards, the issues given to agents and the git access of the sessions. Create it on github.com: Settings, Developer settings, Personal access tokens, Tokens (classic), with the “repo” scope.",
		},
	]);
});

test("the key says why in 300 characters at most, in both languages", () => {
	for (const language of ["en", "fr"]) expect(localized(manifest(), language).keys?.[0]?.why?.length).toBeLessThanOrEqual(KEY_WHY_MOST);
});

test("in French: its French words, the key's too", () => {
	const { name, summary, description, keys } = localized(manifest(), "fr");
	expect(name).toBe("GitHub");
	expect(summary).toBe("Tes PR, leur CI et tes issues GitHub");
	expect(description).toStartWith("GitHub comme hébergeur de code de Sonar");
	expect(keys?.[0]).toMatchObject({
		label: "GitHub",
		why: "Elle ouvre les PR et la CI sur les cartes, les issues confiées et l'accès git des sessions. Crée-la sur github.com : Settings, Developer settings, Personal access tokens, Tokens (classic), avec le droit « repo ».",
	});
});

test("started as Sonar starts it: the port is filled, and GitHub is called at the address the card names", async () => {
	const bench = fakeServer({ card });
	bench.setKey("token", "example-token", "shop");
	await bench.start(start);
	const called: string[] = [];
	const spy = spyOn(globalThis, "fetch").mockImplementation((async (url: string) => {
		called.push(new URL(url).host);
		return viewer();
	}) as never);
	try {
		expect(bench.codeHost()?.name).toBe("GitHub");
		expect(await bench.codeHost()?.account("shop")).toBe("ada");
	} finally {
		spy.mockRestore();
	}
	expect(called).toEqual(card.calls);
});
