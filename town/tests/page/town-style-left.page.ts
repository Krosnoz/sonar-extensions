// The styles Sonar kept before the town left it for this extension: each project's settings file holds them under
// `world`. At Sonar's next start, the extension's server part takes them (src/server/style-left.ts): a project Sonar lists by
// its name, a folder of sessions it never listed by its file's name. The field then leaves Sonar's files, what else
// they hold stays, and each project's town keeps its style. On Sonar's page bench, with a Sonar that no longer knows
// the field: one that still does gives it to no extension.

import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { after, before, test } from "node:test";
import { type Bench, settle, startBench } from "../sonar/tests/page/support/bench.ts";
import { inTownMode, type TownStyle } from "./support/town.ts";

let bench: Bench;
before(async () => {
	inTownMode();
	bench = await startBench();
});
after(async () => {
	await bench?.close();
});

const kept = async (project: string): Promise<TownStyle> =>
	(await (await fetch(`${bench.base}/api/ext/town/style?project=${encodeURIComponent(project)}`)).json()) as TownStyle;

test("the styles Sonar's settings kept are taken at its next start, then leave its files", async () => {
	const settings = join(bench.home, ".sonar", "projects");
	mkdirSync(settings, { recursive: true });
	const fileOf = (name: string) => join(settings, `${name}.json`);
	const read = (name: string) => JSON.parse(readFileSync(fileOf(name), "utf8")) as Record<string, unknown>;
	// alpha: the bench's own project. "left alone": a folder of sessions Sonar never listed, its file named after it.
	const alpha = existsSync(fileOf("alpha")) ? read("alpha") : {};
	assert.deepEqual(await kept("alpha"), { style: null, drawn: null });
	writeFileSync(fileOf("alpha"), JSON.stringify({ ...alpha, world: { style: "neon", drawn: "sun" } }));
	writeFileSync(fileOf("left_alone"), JSON.stringify({ language: "fr", world: { style: null, drawn: "fjord" } }));

	assert.ok(bench.restart, "the bench is the file's own: its server starts again");
	await bench.restart();
	assert.deepEqual(
		await settle(
			() => kept("alpha"),
			(now) => now.style !== null,
			60_000,
		),
		{ style: "neon", drawn: "sun" },
	);
	assert.deepEqual(await kept("left alone"), { style: null, drawn: "fjord" });
	// The field left Sonar's files; the rest of each file stays.
	assert.deepEqual(read("alpha"), alpha);
	assert.deepEqual(read("left_alone"), { language: "fr" });
});
