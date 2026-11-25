// The town (src/): the "Visualisation" icon turns the Map into an isometric town of the project's subjects
// and agents, and back. three.js loads at the first touch; the page comes back whole, without a mask left on a card. The
// icon is on the Map only; while the town shows, it waits in the bottom right corner. Another tab hides the town, and
// the Map shows it again as it was, until the icon is touched again. On a phone, the icon sits in the bottom left corner.

import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import type { Browser, Page } from "playwright-core";
import { french as worldTexts } from "../../src/i18n-fr.ts";
import { type Bench, DESKTOP, openPage, PHONE, settle, startBenchAndBrowser } from "../sonar/tests/page/support/bench.ts";
import { unfinished } from "../sonar/tests/page/support/phone-finish-audit.ts";
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

// `card`: the page reads this name as its graphics card's, a computer's, and the town is drawn as the page chooses;
// without one, the town is the light drawing a page test asks for (./support/town-draw.ts).
async function open(device: typeof DESKTOP | typeof PHONE, dark = false, card?: string): Promise<{ page: Page; errors: string[] }> {
	const opened = await openPage(browser, device);
	if (dark) await opened.page.emulateMedia({ colorScheme: "dark" });
	await opened.page.addInitScript(() => localStorage.setItem("sonar:view", "map"));
	if (card === undefined) await lightTown(opened.page);
	else if (card)
		await opened.page.addInitScript((card) => {
			Object.defineProperty(navigator, "gpu", { value: undefined });
			// The method is called with its context (`read.call`).
			// oxlint-disable-next-line typescript/unbound-method
			const read = WebGL2RenderingContext.prototype.getParameter;
			// 0x9246: UNMASKED_RENDERER_WEBGL.
			WebGL2RenderingContext.prototype.getParameter = function (name: number) {
				return name === 0x9246 ? card : (read.call(this, name) as unknown);
			};
		}, card);
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
// The town is there once its signs show: the page's cards are all bricks by then.
const arrived = (page: Page): Promise<unknown> => page.locator("#town .world-layer.shown").waitFor({ state: "attached", timeout: 90_000 });
const tab = (page: Page, view: string): Promise<void> => page.locator(`.tabs button[data-view='${view}']`).click();
// The map's things faded as a whole while the town came: they must break up cell by cell, as the cards do. Watched from
// before the touch, every style the page writes on the map's things is read.
const watchFades = (page: Page): Promise<void> =>
	page.evaluate(() => {
		const seen = new Set<string>();
		Object.assign(window, { faded: seen });
		new MutationObserver((changes) => {
			for (const { target } of changes)
				// Not the map itself: with no sea, it hides all at once when the last point has landed (morph.ts, `bare`).
				if (
					(target instanceof HTMLElement || target instanceof SVGElement) &&
					target.id !== "viewport" &&
					target.style.opacity !== "" &&
					Number(target.style.opacity) < 1
				)
					seen.add(target.getAttribute("class") ?? target.tagName);
		}).observe(document.querySelector("#viewport")!, { subtree: true, attributes: true, attributeFilter: ["style"] });
	});
const faded = (page: Page): Promise<string[]> => page.evaluate(() => [...(window as unknown as { faded: Set<string> }).faded]);
// The signs the town shows that cover one another, or that the screen cuts.
const crowded = (page: Page): Promise<string[]> =>
	page.evaluate(() => {
		const boxes = [...document.querySelectorAll<HTMLElement>("#town .world-sign:not(.world-off)")]
			.map((node) => ({ name: node.getAttribute("aria-label") ?? "", box: node.getBoundingClientRect() }))
			.filter(({ box }) => box.width > 0);
		const cut = boxes.filter(({ box }) => box.left < 0 || box.right > innerWidth).map(({ name }) => `cut: ${name}`);
		const over = boxes.flatMap((a, at) =>
			boxes
				.slice(at + 1)
				.filter((b) => a.box.left < b.box.right && b.box.left < a.box.right && a.box.top < b.box.bottom && b.box.top < a.box.bottom)
				.map((b) => `${a.name} over ${b.name}`),
		);
		return [...cut, ...over];
	});

test("computer: the map turns into the town, its icon waits in the corner, then the map comes back whole", async () => {
	const { page, errors } = await open(DESKTOP);
	const icon = page.locator(".zoom .town-toggle");
	assert.equal(await icon.getAttribute("aria-label"), worldTexts.open);
	// The map at rest first: while it zooms in at its opening, it fades its zones' summaries itself (islands.ts).
	await settle(
		() =>
			page.evaluate(async () => {
				const world = document.querySelector("#viewport .world")!;
				const before = getComputedStyle(world).transform;
				await new Promise((done) => setTimeout(done, 250));
				return before === getComputedStyle(world).transform;
			}),
		(still) => still,
	);
	await watchFades(page);
	await icon.click();
	await page.locator("#town canvas[data-engine]").waitFor({ state: "attached", timeout: 60_000 });
	assert.equal(await icon.getAttribute("aria-pressed"), "true");
	assert.equal(await icon.getAttribute("aria-label"), worldTexts.close);
	// The map's other tools leave room to the town; its icon goes down to the bottom right corner.
	assert.equal(await page.locator("#zoom-in").isVisible(), false);
	await settle(
		() => icon.boundingBox(),
		(box) => box !== null && Math.abs(DESKTOP.viewport.width - box.x - box.width - 24) <= 1 && Math.abs(DESKTOP.viewport.height - box.y - box.height - 24) <= 1,
	);
	// The town goes on under the top bar, as the map does: no strip of the map shows over it.
	assert.equal((await page.locator("#town").boundingBox())?.y, 0);
	await arrived(page);
	// While the page broke up, nothing of it faded: the zones, the links and their tags went with the ground under them.
	assert.deepEqual(await faded(page), []);
	assert.deepEqual(await crowded(page), []);
	await icon.click();
	await page.locator("body.town").waitFor({ state: "detached", timeout: 60_000 });
	assert.equal(await page.locator("#town canvas").count(), 0);
	assert.equal(await masked(page), 0);
	assert.equal(await page.locator("#viewport .agent-card").first().isVisible(), true);
	assert.equal(await icon.evaluate((node) => node.classList.contains("cornered")), false);
	assert.deepEqual(errors, []);
	await page.close();
});

test("phone: the town stays behind another tab, and the Map shows it again until the icon is touched", async () => {
	const { page, errors } = await open(PHONE, true);
	const icon = page.locator(".town-phone");
	// The map is drawn before the rest of the page's code, which brings the icon: it shows a moment after the cards.
	await icon.waitFor({ state: "visible", timeout: 10_000 });
	assert.deepEqual(await unfinished(page), []);
	await icon.click();
	await arrived(page);
	assert.deepEqual(await unfinished(page), []);
	// On a narrow screen the subjects' names sit side by side: none covers another, none is cut by the edge.
	assert.deepEqual(await crowded(page), []);
	// The icon changed under the still pointer as it was pressed: its tip does not come back.
	assert.equal(await page.locator(".ui-tooltip:popover-open").count(), 0);
	await tab(page, "agents");
	// Out of sight and not drawn, but kept; no icon on the Agents tab.
	await settle(
		() => page.evaluate((): [boolean, boolean] => [document.body.classList.contains("town"), document.querySelector("#town")!.classList.contains("away")]),
		([town, away]) => !town && away,
	);
	assert.equal(await page.locator(".town-toggle:visible").count(), 0);
	assert.equal(await page.locator("#town canvas[data-engine]").count(), 1);
	await tab(page, "map");
	await settle(
		() => page.evaluate((): [boolean, boolean] => [document.body.classList.contains("town"), document.querySelector("#town")!.classList.contains("away")]),
		([town, away]) => town && !away,
	);
	assert.equal(await icon.getAttribute("aria-pressed"), "true");
	await icon.click();
	await page.locator("body.town").waitFor({ state: "detached", timeout: 60_000 });
	assert.equal(await masked(page), 0);
	assert.deepEqual(errors, []);
	await page.close();
});

test("computer, motion reduced: the page is the town at once, without its dissolve", async () => {
	const { page, errors } = await open(DESKTOP);
	await page.emulateMedia({ reducedMotion: "reduce" });
	// What the page shows of itself behind its edge, at each change: the dissolve shows it half gone, the town at once
	// never.
	await page.evaluate(() => {
		const shown = new Set<string>();
		Object.assign(window, { shown });
		new MutationObserver(() => {
			const state = document.querySelector<HTMLElement>("#town .town-cover")?.dataset["page"];
			if (state) shown.add(state);
		}).observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ["data-page"] });
	});
	await page.locator(".zoom .town-toggle").click();
	await arrived(page);
	assert.equal(await page.evaluate(() => (window as unknown as { shown: Set<string> }).shown.has("broken")), false);
	// Nothing of the page shows under the town.
	assert.equal(await page.evaluate(() => document.querySelector<HTMLElement>("#town .town-cover")?.dataset["page"]), "gone");
	assert.deepEqual(errors, []);
	await page.close();
});

test("computer: a figure's name is its card's name alone, without the marks beside it in the card's head", async () => {
	const { page, errors } = await open(DESKTOP);
	const card = page.locator(`#viewport article.agent-card[data-handle="${bench.sessions.done}"]`);
	const name = (await card.locator(".head .name").innerText()).trim();
	// What a linked computer's card or a cloud session's holds in its head, beside the name.
	await card
		.locator(".head")
		.evaluate((head) => head.append(Object.assign(document.createElement("span"), { className: "ui-status machine-mark", textContent: "Marque-Z" })));
	await page.locator(".zoom .town-toggle").click();
	await arrived(page);
	// The words as written, shown or not: the names show only from the nearer levels.
	const names = await page.locator("#town .world-name").evaluateAll((nodes) => nodes.map((node) => node.textContent ?? ""));
	assert.deepEqual(
		names.filter((each) => each.includes("Marque-Z")),
		[],
	);
	assert.equal(
		names.some((each) => each.trim() === name),
		true,
	);
	assert.deepEqual(errors, []);
	await page.close();
});

// The town is drawn whole or not offered (src/offered.ts): the test browser draws on its processor.
const offered = (page: Page, answer: string): Promise<unknown> =>
	page.locator(`#town[data-offered='${answer}']`).waitFor({ state: "attached", timeout: 30_000 });

test("computer and phone: a machine that draws on its processor has no town icon", async () => {
	for (const device of [DESKTOP, PHONE]) {
		const { page, errors } = await open(device, false, "");
		await offered(page, "false");
		assert.equal(await page.locator(".town-toggle:visible").count(), 0);
		assert.deepEqual(errors, []);
		await page.close();
	}
});

// A phone's card said what a computer's says, and its user touched the icon to be told the town does not work (13/11).
test("phone: a touch screen has no town icon, even with a card that says it is a computer's", async () => {
	const { page, errors } = await open(PHONE, false, "ANGLE (NVIDIA, NVIDIA GeForce RTX 3070 Direct3D11 vs_5_0 ps_5_0, D3D11)");
	await offered(page, "false");
	assert.equal(await page.locator(".town-toggle:visible").count(), 0);
	assert.deepEqual(errors, []);
	await page.close();
});

// A computer's card too weak for the town: its name is a computer's, and the test browser's processor draws for it.
test("computer: a card that does not hold the whole town says so once, and its icon goes for the day", async () => {
	const { page, errors } = await open(DESKTOP, false, "ANGLE (Intel, Intel(R) HD Graphics 4000 Direct3D11 vs_5_0 ps_5_0, D3D11)");
	await offered(page, "true");
	await page.locator(".zoom .town-toggle").click();
	await page.locator(".ui-toast", { hasText: worldTexts.unheld }).waitFor({ timeout: 120_000 });
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

// The town's files load as the pointer comes onto its icon: the click finds them there. Loaded at the click, they were
// the first 0.1 to 0.4 s of the wait (13/11).
test("computer: three.js loads as the pointer comes onto the town's icon, before the click", async () => {
	const { page, errors } = await open(DESKTOP);
	const icon = page.locator(".town-toggle:visible").first();
	await icon.waitFor({ timeout: 30_000 });
	const three = page.waitForEvent("response", {
		predicate: async (response) => response.request().resourceType() === "script" && (await response.text()).includes("isWebGPURenderer"),
		timeout: 15_000,
	});
	await icon.hover();
	await three;
	assert.equal(await page.locator("#town canvas").count(), 0);
	assert.deepEqual(errors, []);
	await page.close();
});

test("computer: the Agents tab has no town icon", async () => {
	const { page, errors } = await open(DESKTOP);
	await tab(page, "agents");
	await page.locator("#agents .agents-row").first().waitFor({ timeout: 30_000 });
	assert.equal(await page.locator(".town-toggle:visible").count(), 0);
	assert.deepEqual(errors, []);
	await page.close();
});
