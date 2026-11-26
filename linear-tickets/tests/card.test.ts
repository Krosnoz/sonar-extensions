// The card (extension.json) as Sonar reads it: accepted by the contract, with what it asks for, its words in English
// and in French. And the server entry as Sonar starts it: it fills the port, and calls the one address its card names.

import { expect, spyOn, test } from "bun:test";
import { localized, readManifest } from "@sonar/extension";
import { fakeServer } from "@sonar/extension/testing";
import { start } from "../src/server";
import { workspace } from "./fake-linear";
import { card } from "./support";

const manifest = () => {
	const reading = readManifest(card);
	if ("refusal" in reading) throw new Error(JSON.stringify(reading.refusal));
	return reading.manifest;
};

test("the card is accepted: a key per project, one address called, the port tickets, nothing paid", () => {
	const { id, name, keys, calls, provides, paid } = manifest();
	expect({ id, name, calls, provides, paid }).toEqual({ id: "linear-tickets", name: "Linear", calls: ["api.linear.app"], provides: ["tickets"], paid: undefined });
	expect(keys).toEqual([
		{
			name: "key",
			scope: "project",
			label: "Linear",
			why: "It opens the project's issues in Linear. Create it in Linear: Settings, API, Personal API keys.",
		},
	]);
});

test("in French: its French words, the key's too", () => {
	const { summary, description, keys } = localized(manifest(), "fr");
	expect(summary).toBe("Tes tickets Linear dans Sonar");
	expect(description).toStartWith("Linear comme suivi de tickets de Sonar");
	expect(keys?.[0]).toMatchObject({ label: "Linear", why: "Elle ouvre les tickets du projet dans Linear. Crée-la dans Linear : Settings, API, Personal API keys." });
});

test("started as Sonar starts it: the port is filled, and Linear is called at the address the card names", async () => {
	const bench = fakeServer({ card });
	bench.setKey("key", "example-key", "acme");
	await bench.start(start);
	const called: string[] = [];
	const spy = spyOn(globalThis, "fetch").mockImplementation((async (url: string) => {
		called.push(new URL(url).host);
		return workspace();
	}) as never);
	try {
		await bench.tickets()?.workspace("acme");
	} finally {
		spy.mockRestore();
	}
	expect(called).toEqual(card.calls);
});
