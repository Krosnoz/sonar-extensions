// The open town follows its agents (src/live.ts): a session that takes a turn, asks, opens or closes
// shows there as it happens, in its inhabitant's name, in its subject's sign and in how many agents the town shows.
// What changes while the town is out of sight is there when it shows again, and on the map once the page is back.
// Before, the town was a picture of the map taken at its opening: a session opened under it showed at the next one.
// What each change draws (who goes, who is born, who glides) is src/live.test.ts's.

import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { after, before, test } from "node:test";
import type { Browser, Page } from "playwright-core";
import { french as texts } from "../../src/i18n-fr.ts";
import { type Bench, DESKTOP, openPage, settle, startBenchAndBrowser } from "../sonar/tests/page/support/bench.ts";
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

const post = async (url: string, body: unknown): Promise<Record<string, unknown>> =>
	(await (await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) })).json()) as Record<string, unknown>;

// What the town says of its people: how many times they changed since it opened, how many agents it shows, its
// subject's sign, and each inhabitant's state by its name.
type Town = { changed: string | null; agents: string | null; sign: string; states: Record<string, string> };
const townOf = (page: Page): Promise<Town> =>
	page.evaluate(() => {
		const layer = document.querySelector<HTMLElement>("#town .world-layer");
		const names = [...document.querySelectorAll<HTMLElement>("#town .world-name")].filter((node) => node.textContent);
		return {
			changed: layer?.dataset["changed"] ?? null,
			agents: layer?.dataset["agents"] ?? null,
			sign: document.querySelector("#town .world-sign")?.getAttribute("aria-label") ?? "",
			states: Object.fromEntries(names.map((node) => [node.textContent, node.querySelector(".ui-dot")?.className.replace("ui-dot ", "") ?? ""])),
		};
	});
// The town once it says `holds`: the fleet reaches the page, then the town, a moment after the session changed.
const shows = (page: Page, holds: (town: Town) => boolean): Promise<Town> => settle(() => townOf(page), holds, 60_000);

test("computer: the open town shows a session that takes a turn, asks, opens and closes, as it happens", async () => {
	const { page, errors } = await openPage(browser, DESKTOP);
	// The town is opened once, with time: an opening longer than a minute is given up (src/toggle.ts,
	// OPENING_LIMIT), and the test browser draws on a processor the other tests share. This file is not about that limit.
	await page.addInitScript(() => {
		localStorage.setItem("sonar:view", "map");
		localStorage.setItem("sonar:town-limit", "300000");
	});
	await lightTown(page);
	await page.goto(`${bench.base}/?projet=alpha`);
	const card = page.locator(`#viewport .agent-card[data-handle="${bench.sessions.done}"]`);
	await card.waitFor({ timeout: 30_000 });
	const title = ((await card.locator(".head .name").textContent()) ?? "").trim();
	const cards = await page.locator("#viewport .island article.agent-card[data-handle]").count();
	await page.locator(".zoom .town-toggle").click();
	await page.locator("#town .world-layer.shown").waitFor({ state: "attached", timeout: 300_000 });
	await page.locator("#town:not(.moving)").waitFor({ state: "attached", timeout: 90_000 });

	// As it arrives, the town shows what the map showed: an agent each, and nothing has changed.
	const arrived = await townOf(page);
	assert.deepEqual([arrived.changed, arrived.agents], [null, String(cards)]);
	assert.equal(arrived.states[title], "tone-done");
	assert.ok(arrived.sign.includes(texts.working(1)) && arrived.sign.includes(texts.reviewing(1)), `the sign counts its agents (${arrived.sign})`);

	// A session takes a turn: its inhabitant is at work, and no other changed.
	const host = readFileSync(`${bench.home}/.sonar/host.port`, "utf8").trim();
	await post(`http://127.0.0.1:${host}/send`, { handle: bench.sessions.done, text: "[hold] [reply] Fini." });
	const working = await shows(page, (town) => town.states[title] === "tone-work");
	assert.ok(working.sign.includes(texts.working(2)) && !working.sign.includes(texts.reviewing(1)), `the sign counts it at work (${working.sign})`);
	const others = (town: Town): string => JSON.stringify(Object.entries(town.states).filter(([name]) => name !== title));
	assert.deepEqual([working.changed, working.agents, others(working)], ["1", String(cards), others(arrived)]);

	// Its turn ends, then it asks: its inhabitant waits for the user.
	writeFileSync(`${bench.home}/.fake-claude-release`, "");
	await shows(page, (town) => town.states[title] !== "tone-work" && town.sign.includes(texts.working(1)));
	await post(`http://127.0.0.1:${host}/send`, { handle: bench.sessions.done, text: "[ask] Puis-je ?" });
	const asking = await shows(page, (town) => town.states[title] === "tone-wait");
	assert.ok(asking.sign.includes(texts.waiting(2)), `the sign counts it as waiting (${asking.sign})`);

	// A session opens under the town: one more inhabitant, with its name; it closes: one fewer.
	const opened = await post(`${bench.base}/api/session/open`, {
		cwd: `${bench.home}/projects/alpha`,
		name: "Ouverte sous la ville",
		text: "[hold] [reply] Ouverte.",
	});
	const more = await shows(page, (town) => town.agents === String(cards + 1) && town.states["Ouverte sous la ville"] === "tone-work");
	assert.ok(more.sign.includes(texts.working(2)), `the sign counts the new one (${more.sign})`);
	await post(`${bench.base}/api/session/close`, { handle: String(opened["handle"]) });
	const fewer = await shows(page, (town) => town.agents === String(cards) && town.sign.includes(texts.working(1)));
	assert.equal(fewer.states[title], "tone-wait");

	// On the Agents tab the town is kept, not drawn: a session that opens then waits, and is there when the Map shows
	// the town again.
	await page.locator('.tabs button[data-view="agents"]').click();
	await page.locator("#town.away").waitFor({ state: "attached", timeout: 30_000 });
	const unseen = await post(`${bench.base}/api/session/open`, {
		cwd: `${bench.home}/projects/alpha`,
		name: "Ouverte hors de vue",
		text: "[hold] [reply] Ouverte.",
	});
	await page.locator(`#agents .agents-row[data-handle="${String(unseen["handle"])}"]`).waitFor({ state: "attached", timeout: 60_000 });
	assert.equal((await townOf(page)).agents, String(cards), "the town out of sight has not changed");
	await page.locator('.tabs button[data-view="map"]').click();
	const back = await shows(page, (town) => town.agents === String(cards + 1));
	assert.equal(back.states["Ouverte hors de vue"], "tone-work");

	// Back to the page: the map, held under the town, draws the session that opened meanwhile.
	await page.locator(".town-toggle:visible").first().click();
	await page.locator("body.town").waitFor({ state: "detached", timeout: 120_000 });
	await page.locator(`#viewport .agent-card[data-handle="${String(unseen["handle"])}"]`).waitFor({ timeout: 30_000 });
	await post(`${bench.base}/api/session/close`, { handle: String(unseen["handle"]) });

	assert.deepEqual(errors, []);
	await page.close();
});
