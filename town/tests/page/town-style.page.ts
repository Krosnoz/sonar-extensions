// The block "Ville" of a project's general screen: a picture per style of town, Sonar's draw first, the one chosen
// checked. A choice is saved at the click (not by "Enregistrer"), with its saving shown; a save the server does not
// answer puts the choice back with why. Shown where the town is offered only; finished in a window 390 px wide; by
// night in the dark theme. A town built in another style ends, and its next opening builds the style chosen. Behavior
// of the extension's page part on Sonar's page bench.

import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import type { Browser, Locator, Page, Route } from "playwright-core";
import { type Bench, DESKTOP, openPage, PHONE, settle, startBenchAndBrowser } from "../sonar/tests/page/support/bench.ts";
import { blendedCards } from "../sonar/tests/page/support/blended-cards.ts";
import { unfinished } from "../sonar/tests/page/support/phone-finish-audit.ts";
import { inTownMode, NEVER_DRAWN, STYLE_READ_ROUTE, STYLE_ROUTE, TOWN_PICTURES, type TownStyle, townStyleOf } from "./support/town.ts";
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

const NAMES: Record<string, string> = { riverside: "Rive", brick: "Brique", sun: "Soleil", neon: "Néon", fjord: "Fjord", oasis: "Oasis" };
const kept = (): Promise<TownStyle> => townStyleOf(bench.base).kept();
const choose = (style: string): Promise<Response> => townStyleOf(bench.base).choose(style);
// Sonar's draw, kept by the bench: the settings back on it.
async function drawn(): Promise<string> {
	await choose("automatic");
	const { drawn } = await kept();
	assert.ok(drawn);
	return drawn;
}

// The screen on a machine that is offered the town: the test browser is, once a drawing is asked for by hand.
async function screen(device: typeof DESKTOP | typeof PHONE): Promise<{ page: Page; errors: string[]; block: Locator }> {
	const { page, errors } = await openPage(browser, device);
	await lightTown(page);
	await page.goto(`${bench.base}/?projet=alpha&reglages=general`);
	const block = page.locator('dialog.settings[open] .settings-pane[data-screen="general"] [data-block="town-style"]');
	await block.waitFor();
	return { page, errors, block };
}
const tile = (block: Locator, choice: string): Locator => block.locator(`.town-tile[data-value="${choice}"]`);
const checked = (block: Locator): Promise<string | null> => block.locator('.town-tile[aria-checked="true"]').getAttribute("data-value");
// The pictures a tile shows, loaded.
const shown = (tile: Locator): Promise<string[]> =>
	settle(
		() =>
			tile
				.locator("img:visible")
				.evaluateAll((all) => all.map((each) => ((each as HTMLImageElement).naturalWidth > 0 ? (each.getAttribute("src") ?? "") : "not loaded"))),
		(all) => all.length > 0 && !all.includes("not loaded"),
	);

test("on a wide screen: after « Autres projets », Sonar's draw first, a choice saved at the click with its saving shown", async () => {
	const draw = await drawn();
	const chosen = draw === "neon" ? "fjord" : "neon";
	const { page, errors, block } = await screen(DESKTOP);
	const values = block.locator("> summary .ui-section-values");
	// The section just before it: an extension's block sits first in the place Sonar keeps for the extensions' sections.
	const before = (node: Element) => {
		let at: Element | null = node;
		while (at && !at.previousElementSibling) at = at.parentElement;
		return (at?.previousElementSibling as HTMLElement | null | undefined)?.dataset["block"];
	};
	assert.equal(await block.evaluate(before), "hold-agents");
	assert.equal(await block.locator(".ui-section-title").innerText(), "Ville");
	assert.equal(await values.innerText(), `Automatique · ${NAMES[draw]}`);
	assert.equal(await block.locator(".town-tiles").isVisible(), false);
	await block.locator("> summary").click();
	assert.equal(await block.locator(".town-tiles").getAttribute("aria-label"), "Style de la ville");
	assert.deepEqual(await block.locator(".town-tile").evaluateAll((all) => all.map((each) => (each as HTMLElement).dataset["value"])), [
		"automatic",
		"riverside",
		"brick",
		"sun",
		"neon",
		"fjord",
		"oasis",
	]);
	assert.equal(await checked(block), "automatic");
	// Sonar's draw shows the style drawn, each style its own town, by day in the light theme.
	assert.equal((await tile(block, "automatic").innerText()).replace(/\s+/g, " "), `Automatique ${NAMES[draw]}`);
	assert.deepEqual(await shown(tile(block, "automatic")), [`${TOWN_PICTURES}/${draw}-day.webp`]);
	assert.deepEqual(await shown(tile(block, "brick")), [`${TOWN_PICTURES}/brick-day.webp`]);
	assert.equal(await tile(block, "automatic").getAttribute("data-tip"), "Sonar prend le style que tes autres projets ont le moins.");

	// The save held back: the choice shows the saving.
	let release: () => void = () => undefined;
	const held = new Promise<void>((resolve) => (release = resolve));
	await page.route(STYLE_ROUTE, async (route: Route) => {
		if (route.request().method() === "POST") await held;
		await route.continue();
	});
	await tile(block, chosen).click();
	await block.locator(".phone-wait").waitFor();
	assert.equal(await block.locator(".town-tiles").getAttribute("aria-busy"), "true");
	assert.equal(await checked(block), chosen);
	assert.equal(await values.innerText(), NAMES[chosen]);
	assert.match(await block.innerText(), /Enregistrement…/);
	release();
	await block.locator(".phone-wait").waitFor({ state: "detached" });
	assert.equal(await block.locator(".town-tiles").getAttribute("aria-busy"), null);
	assert.deepEqual(await settle(kept, (each) => each.style === chosen), { style: chosen, drawn: draw });
	assert.equal(await checked(block), chosen);
	await page.unroute(STYLE_ROUTE);

	// Saved without "Enregistrer": the screen opened again shows it; Sonar's draw chosen again keeps its style.
	await page.reload();
	await block.waitFor();
	assert.equal(await values.innerText(), NAMES[chosen]);
	await block.locator("> summary").click();
	assert.equal(await checked(block), chosen);
	await tile(block, "automatic").click();
	assert.deepEqual(await settle(kept, (each) => each.style === null), { style: null, drawn: draw });
	assert.equal(
		await settle(
			() => values.innerText(),
			(text) => text.startsWith("Automatique"),
		),
		`Automatique · ${NAMES[draw]}`,
	);
	assert.deepEqual(errors, []);
	await page.close();
});

test("on a wide screen: a save the server does not answer puts the choice back, with why", async () => {
	const draw = await drawn();
	const { page, block } = await screen(DESKTOP);
	await page.route(STYLE_ROUTE, (route: Route) => (route.request().method() === "POST" ? route.abort() : route.continue()));
	await block.locator("> summary").click();
	await tile(block, draw === "sun" ? "oasis" : "sun").click();
	const failed = block.locator(".phone-fail");
	await failed.waitFor();
	assert.equal(await checked(block), "automatic");
	assert.equal(await block.locator(".town-tiles").getAttribute("aria-busy"), null);
	assert.equal(await block.locator("> summary .ui-section-values").innerText(), `Automatique · ${NAMES[draw]}`);
	assert.match(await failed.innerText(), /Le style n'est pas enregistré\./);
	assert.match(await failed.innerText(), new RegExp(`Le serveur n'a pas répondu\\. La ville garde le style Automatique · ${NAMES[draw]}\\.`));
	assert.deepEqual(await kept(), { style: null, drawn: draw });
	await page.close();
});

test("before any draw, Sonar's choice shows the six styles; in the dark theme, the towns by night, each card seen", async () => {
	await drawn();
	const { page, errors } = await openPage(browser, DESKTOP);
	await lightTown(page);
	// The settings as a project whose town was never opened gives them.
	await page.route(STYLE_READ_ROUTE, async (route: Route) => {
		const response = await route.fetch();
		await route.fulfill({ response, json: NEVER_DRAWN });
	});
	await page.emulateMedia({ colorScheme: "dark" });
	await page.goto(`${bench.base}/?projet=alpha&reglages=general`);
	const block = page.locator('dialog.settings[open] .settings-pane[data-screen="general"] [data-block="town-style"]');
	await block.waitFor();
	assert.equal(await block.locator("> summary .ui-section-values").innerText(), "Automatique");
	await block.locator("> summary").click();
	assert.equal(await checked(block), "automatic");
	assert.equal(await tile(block, "automatic").innerText(), "Automatique");
	assert.deepEqual(
		await shown(tile(block, "automatic")),
		Object.keys(NAMES).map((style) => `${TOWN_PICTURES}/${style}-night.webp`),
	);
	assert.deepEqual(await shown(tile(block, "oasis")), [`${TOWN_PICTURES}/oasis-night.webp`]);
	await block.scrollIntoViewIfNeeded();
	assert.deepEqual(await blendedCards(page), []);
	assert.deepEqual(errors, []);
	await page.close();
});

test("in a window 390 px wide: the choices and a refusal are finished", async () => {
	const draw = await drawn();
	const { page, block } = await screen(PHONE);
	await block.locator("> summary").click();
	await shown(tile(block, "oasis"));
	await block.scrollIntoViewIfNeeded();
	assert.deepEqual(await unfinished(page), []);
	await page.route(STYLE_ROUTE, (route: Route) => (route.request().method() === "POST" ? route.abort() : route.continue()));
	await tile(block, draw === "sun" ? "oasis" : "sun").click();
	await block.locator(".phone-fail").waitFor();
	await block.locator(".phone-fail").scrollIntoViewIfNeeded();
	assert.deepEqual(await unfinished(page), []);
	await page.close();
});

test("a machine that is not offered the town has no block « Ville »", async () => {
	const { page, errors } = await openPage(browser, DESKTOP);
	await page.goto(`${bench.base}/?projet=alpha&reglages=general`);
	const pane = page.locator('dialog.settings[open] .settings-pane[data-screen="general"]');
	await pane.locator('[data-block="hold-agents"]').waitFor();
	await page.locator('#town[data-offered="false"]').waitFor({ state: "attached" });
	assert.equal(await pane.locator('[data-block="town-style"]').count(), 0);
	assert.deepEqual(errors, []);
	await page.close();
});

test("a town built in another style ends at the choice, and its next opening builds the style chosen", async () => {
	const draw = await drawn();
	const chosen = draw === "neon" ? "fjord" : "neon";
	const { page, errors } = await openPage(browser, DESKTOP);
	await page.addInitScript(() => localStorage.setItem("sonar:view", "map"));
	await lightTown(page);
	await page.goto(`${bench.base}/?projet=alpha`);
	await page.locator("#viewport .agent-card").first().waitFor({ timeout: 30_000 });
	const icon = page.locator(".town-toggle.town-map");
	await icon.click();
	await page.locator(`#town[data-style="${draw}"]`).waitFor({ state: "attached", timeout: 60_000 });
	// The town arrived: the page's head is whole again, and its "Réglages" can be reached.
	await page.locator("#town .world-layer.shown").waitFor({ state: "attached", timeout: 90_000 });
	assert.equal(await page.evaluate(() => document.body.classList.contains("town")), true);

	await page
		.getByRole("button", { name: /Réglages/ })
		.first()
		.click();
	await page
		.locator(".settings-item", { hasText: /^Général$/ })
		.first()
		.click();
	const block = page.locator('dialog.settings[open] [data-block="town-style"]');
	await block.locator("> summary").click();
	await tile(block, chosen).click();
	assert.equal(
		await settle(
			() => page.evaluate(() => document.body.classList.contains("town")),
			(town) => !town,
		),
		false,
	);
	assert.equal(await icon.getAttribute("aria-pressed"), "false");
	await page.keyboard.press("Escape");
	await page.locator("dialog.settings[open]").waitFor({ state: "detached" });
	await icon.click();
	await page.locator(`#town[data-style="${chosen}"]`).waitFor({ state: "attached", timeout: 60_000 });
	// The bench goes back to Sonar's draw for the files that share it.
	await choose("automatic");
	assert.deepEqual(errors, []);
	await page.close();
});
