// The town's icon while the town comes or leaves, and an opening too slow for the machine (src/toggle.ts).
// A click on the icon during the way back was dropped without a sign; a processor 20 times slower left the map pale,
// the icon in its corner, for more than 4 minutes, without the town nor a word (14/11).

import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import type { Browser, Page } from "playwright-core";
import { french as worldTexts } from "../../src/i18n-fr.ts";
import { type Bench, DESKTOP, openPage, PHONE, settle, startBenchAndBrowser } from "../sonar/tests/page/support/bench.ts";
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

// `limit`: the opening's time limit, in milliseconds (`sonar:town-limit`): set under the bench's opening, it is passed
// at once, without waiting for a real slow machine.
async function open(limit?: number): Promise<{ page: Page; errors: string[] }> {
	const opened = await openPage(browser, DESKTOP);
	await opened.page.addInitScript(() => localStorage.setItem("sonar:view", "map"));
	await lightTown(opened.page);
	if (limit !== undefined)
		await opened.page.addInitScript((limit) => {
			localStorage.setItem("sonar:town-limit", String(limit));
			// A drawing asked for is offered whatever the machine (src/offered.ts): once the machine is
			// known not to hold the town, the page is left to read it.
			if (localStorage.getItem("sonar:town-unheld")) localStorage.removeItem("sonar:town-draw");
		}, limit);
	await opened.page.goto(`${bench.base}/?projet=alpha`);
	await opened.page.locator("#viewport .agent-card").first().waitFor({ timeout: 30_000 });
	return opened;
}
// What the dissolve left: the page's cover (src/cover.ts), a mask on a thing of the map.
const masked = (page: Page): Promise<number> =>
	page.evaluate(
		() =>
			document.querySelectorAll(".town-cover").length +
			[...document.querySelectorAll<HTMLElement>("#viewport, #viewport *")].filter((node) => node.style.maskImage || node.style.clipPath).length,
	);
const offered = (page: Page, answer: string): Promise<unknown> =>
	page.locator(`#town[data-offered='${answer}']`).waitFor({ state: "attached", timeout: 30_000 });

test("computer: while the town leaves, the icon says it is busy, as while it is prepared", async () => {
	const { page, errors } = await open();
	const icon = page.locator(".zoom .town-toggle");
	await offered(page, "true");
	await icon.click();
	await page.locator("#town .world-layer.shown").waitFor({ state: "attached", timeout: 90_000 });
	assert.equal(await icon.getAttribute("aria-busy"), null);
	// The way back has begun: the town is still there, and a click now would wait for its end. The click and the reading
	// are one step of the page: the way back lasts a few seconds, and a test late on a busy machine read the icon after
	// its end.
	const leaving = await icon.evaluate((button: HTMLElement) => {
		button.click();
		return { town: document.body.classList.contains("town"), busy: button.getAttribute("aria-busy"), spinners: button.querySelectorAll(".ui-spinner").length };
	});
	assert.deepEqual(leaving, { town: true, busy: "", spinners: 1 });
	await page.locator("body.town").waitFor({ state: "detached", timeout: 60_000 });
	assert.equal(await icon.getAttribute("aria-busy"), null);
	assert.equal(await icon.locator(".ui-spinner").count(), 0);
	assert.deepEqual(errors, []);
	await page.close();
});

test("phone: a session's panel open by its address leaves the town and its icon out of reach, as the rest of the page", async () => {
	const { page, errors } = await openPage(browser, PHONE);
	await page.addInitScript(() => localStorage.setItem("sonar:view", "map"));
	await lightTown(page);
	await page.goto(`${bench.base}/?projet=alpha&session=${bench.sessions.done}`);
	await offered(page, "true");
	// Inert itself, or inside a place that is: an extension's town sits in the place Sonar keeps for the Map's layers.
	assert.deepEqual(
		await settle(
			() =>
				page.evaluate(() =>
					["#town", ".town-phone"].map((selector) => {
						const node = document.querySelector(selector);
						return node ? node.closest("[inert]") !== null : undefined;
					}),
				),
			([town, icon]) => town === true && icon === true,
			15_000,
		),
		[true, true],
	);
	assert.deepEqual([...errors], []);
	await page.close();
});

test("computer: an opening past its time limit stops, says so once, and its icon goes for the day", async () => {
	const { page, errors } = await open(1);
	await offered(page, "true");
	await page.locator(".zoom .town-toggle").click();
	await page.locator(".ui-toast", { hasText: worldTexts.unheld }).waitFor({ timeout: 60_000 });
	assert.equal(await page.locator(".ui-toast", { hasText: worldTexts.unheld }).count(), 1);
	await offered(page, "false");
	assert.equal(await page.locator(".town-toggle:visible").count(), 0);
	// The page is back whole: its cards, no mask left, no town.
	await page.locator("body.town").waitFor({ state: "detached", timeout: 15_000 });
	assert.equal(await page.locator("#viewport .agent-card").first().isVisible(), true);
	assert.equal(await masked(page), 0);
	assert.equal(await page.locator("#town canvas").count(), 0);
	await page.reload();
	await page.locator("#viewport .agent-card").first().waitFor({ timeout: 30_000 });
	await offered(page, "false");
	assert.equal(await page.locator(".town-toggle:visible").count(), 0);
	assert.deepEqual(errors, []);
	await page.close();
});
