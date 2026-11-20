// The server entry, run by the contract's kit as Sonar runs it, without Sonar.

import { beforeAll, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import type { Json } from "@sonar/extension";
import { fakeServer } from "@sonar/extension/testing";
import { NOTE_MOST, start } from "../src/server";

const bench = fakeServer({ card: JSON.parse(readFileSync(new URL("../extension.json", import.meta.url), "utf8")) });
beforeAll(() => start(bench.api));

test("no note yet: the route says so, and so does the tool", async () => {
	expect(await bench.get("/note")).toEqual({ status: 200, body: { text: "", savedAt: null } });
	expect(bench.tools()).toEqual([{ name: "pinned-note_read", readOnly: true }]);
	expect(await bench.call("pinned-note_read", {})).toEqual({ text: "No note is pinned yet.", isError: false });
});

test("a note saved by the page is read back, and read by an agent", async () => {
	const saved = await bench.post("/note", { text: "Answer in English." });
	expect(saved).toEqual({ status: 200, body: { text: "Answer in English.", savedAt: expect.any(Number) } });
	expect(await bench.get("/note")).toEqual(saved);
	expect(await bench.call("pinned-note_read", {})).toEqual({ text: "Answer in English.", isError: false });
});

test("a note that is not a text, or too long, is refused with a 400", async () => {
	const refused: Json[] = [{}, { text: 3 }, { text: "x".repeat(NOTE_MOST + 1) }];
	for (const body of refused)
		expect(await bench.post("/note", body)).toEqual({ status: 400, body: { error: `The note must be a text of ${NOTE_MOST} characters at most.` } });
	expect((await bench.get("/note")).body).toMatchObject({ text: "Answer in English." });
});
