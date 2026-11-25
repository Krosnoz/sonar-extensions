// The style of a project's town (src/page/style/town-style.ts): the town is built in the style the project's
// settings keep. The first time, the page asks the server for Sonar's draw, which stays; a style the user chose shows
// instead.

import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import type { Browser } from "playwright-core";
import { type Bench, DESKTOP, openPage, startBenchAndBrowser } from "../sonar/tests/page/support/bench.ts";
import { inTownMode, type TownStyle, townStyleOf } from "./support/town.ts";
import { lightTown } from "./support/town-draw.ts";

let bench: Bench;
let browser: Browser;
before(async () => {
	inTownMode();
	[bench, browser] = await startBenchAndBrowser();
});
after(async () => {
	await browser?.close();
	await bench?.close();
});

const kept = (): Promise<TownStyle> => townStyleOf(bench.base).kept();
const choose = (style: string): Promise<Response> => townStyleOf(bench.base).choose(style);

// The style the town says it is built in, once its icon is touched.
async function built(): Promise<{ style: string | null; errors: string[] }> {
	const { page, errors } = await openPage(browser, DESKTOP);
	await page.addInitScript(() => localStorage.setItem("sonar:view", "map"));
	await lightTown(page);
	await page.goto(`${bench.base}/?projet=alpha`);
	await page.locator("#viewport .agent-card").first().waitFor({ timeout: 30_000 });
	await page.locator(".zoom .town-toggle").click();
	const town = page.locator("#town[data-style]");
	await town.waitFor({ state: "attached", timeout: 60_000 });
	const style = await town.getAttribute("data-style");
	await page.close();
	return { style, errors };
}

test("computer: the town asks for Sonar's draw the first time, then takes the style the user chose", async () => {
	const first = await built();
	const { style, drawn } = await kept();
	assert.equal(style, null);
	assert.ok(drawn, "the draw is kept in the project's settings");
	assert.equal(first.style, drawn);
	const chosen = drawn === "neon" ? "fjord" : "neon";
	await choose(chosen);
	const second = await built();
	assert.equal(second.style, chosen);
	// The bench goes back to Sonar's draw for the files that share it.
	await choose("automatic");
	assert.deepEqual(await kept(), { style: null, drawn });
	assert.deepEqual([...first.errors, ...second.errors], []);
});
