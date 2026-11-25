// The town never stays a blank screen (src/page/render/drawer.ts): when the browser takes the graphics card back
// (its context lost, short of memory), the drawing starts again on the same canvas, one tier lower, as soon as the
// context comes back; when it does not come back, the page comes back and says the town cannot be drawn. Played with
// the browser's own WEBGL_lose_context.

import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import type { Browser, Page } from "playwright-core";
import { french as worldTexts } from "../../src/page/sonar/i18n-fr.ts";
import { type Bench, openPage, PHONE, settle, startBenchAndBrowser } from "../sonar/tests/page/support/bench.ts";
import { inTownMode } from "./support/town.ts";
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

async function town(): Promise<Page> {
	const { page } = await openPage(browser, PHONE);
	await page.addInitScript(() => localStorage.setItem("sonar:view", "map"));
	await lightTown(page);
	await page.goto(`${bench.base}/?projet=alpha`);
	await page.locator("#viewport .agent-card").first().waitFor({ timeout: 30_000 });
	await page.locator(".town-phone").click();
	await page.locator("#town .world-layer.shown").waitFor({ state: "attached", timeout: 90_000 });
	return page;
}

// Loses the town's context; `back`: gives it back after a while, as a browser does once it has memory again.
const lose = (page: Page, back: boolean): Promise<void> =>
	page.evaluate(async (back) => {
		const canvas = [...document.querySelectorAll<HTMLCanvasElement>("#town canvas")].find((each) => each.getContext("webgl2") !== null)!;
		const lost = canvas.getContext("webgl2")!.getExtension("WEBGL_lose_context")!;
		lost.loseContext();
		if (back) {
			await new Promise((done) => setTimeout(done, 300));
			lost.restoreContext();
		}
	}, back);

// The town's canvas has its context back, the size of the new tier.
const drawn = (page: Page): Promise<boolean> =>
	page.evaluate(() => {
		const canvas = [...document.querySelectorAll<HTMLCanvasElement>("#town canvas")].find((each) => each.getContext("webgl2") !== null);
		const gl = canvas?.getContext("webgl2");
		return !!canvas && !!gl && !gl.isContextLost() && canvas.width > 0;
	});

// A screen of this density has one tier (half its pixels would be coarser than the screen): the town starts again at it.
test("phone: a lost graphics card draws the town again on the same canvas", async () => {
	const page = await town();
	const canvases = await page.locator("#town canvas").count();
	const tier = Number(await page.locator("#town").getAttribute("data-tier"));
	await lose(page, true);
	await settle(
		() => page.locator("#town").getAttribute("data-restarts"),
		(restarts) => restarts === "1",
	);
	await settle(
		() => drawn(page),
		(shown) => shown,
	);
	assert.equal(await page.locator("#town").getAttribute("data-failed"), null);
	assert.equal(Number(await page.locator("#town").getAttribute("data-tier")), tier);
	assert.equal(await page.locator("#town canvas").count(), canvases);
	assert.equal(await page.locator("body.town").count(), 1);
	await page.close();
});

test("phone: a graphics card that never comes back brings the page back, with its error", async () => {
	const page = await town();
	await lose(page, false);
	await page.locator(".ui-toast", { hasText: worldTexts.failed }).waitFor({ timeout: 15_000 });
	await page.locator("body.town").waitFor({ state: "detached", timeout: 15_000 });
	assert.equal(await page.locator("#viewport .agent-card").first().isVisible(), true);
	await page.close();
});
