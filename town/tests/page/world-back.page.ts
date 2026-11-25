// The town while it comes and while it goes back to the map (src/toggle.ts). It takes no gesture then:
// a drag turned it under the cubes still flying. And the map draws no card again while the town covers it: a card drawn
// again under the town, or a new session's, carried no mask, and showed whole as soon as the way back started, long
// before its bricks flew back (15/11).

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { after, before, test, type TestContext } from "node:test";
import type { Browser, Page } from "playwright-core";
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

// A frame of the page: the town there, arrived (its signs show), turned (its compass shows); the map shown under it, and
// what the page shows of itself behind its edge (`page`, src/cover.ts): "whole", "broken" once the edge
// has taken a part of it, "gone" once it has taken it all, nothing without the cover.
type Frame = { town: boolean; arrived: boolean; turned: boolean; shown: boolean; page: string };

// Every frame is read in the page: the test's own pace, on a busy machine, misses none.
const watch = (page: Page): Promise<void> =>
	page.evaluate(() => {
		const frames: { town: boolean; arrived: boolean; turned: boolean; shown: boolean; page: string }[] = [];
		Object.assign(window, { frames });
		const step = (): void => {
			frames.push({
				town: document.body.classList.contains("town"),
				arrived: document.querySelector("#town .world-layer.shown") !== null,
				turned: document.querySelector("#town .world-compass.turned") !== null,
				shown: document.querySelector<HTMLElement>("#viewport")?.style.opacity !== "0",
				page: document.querySelector<HTMLElement>("#town .town-cover")?.dataset["page"] ?? "",
			});
			requestAnimationFrame(step);
		};
		requestAnimationFrame(step);
	});
// The frames since the last reading.
const read = (page: Page): Promise<Frame[]> => page.evaluate(() => (window as unknown as { frames: Frame[] }).frames.splice(0));

// What the dissolve left: the page's cover, a mask or a cut shape on the map or a thing of it.
const left = (page: Page): Promise<number> =>
	page.evaluate(
		() =>
			document.querySelectorAll(".town-cover").length +
			[...document.querySelectorAll<HTMLElement>("#viewport, #viewport *")].filter((node) => node.style.maskImage || node.style.clipPath).length,
	);
// What the page shows of itself behind its edge.
const shows = (page: Page): Promise<string | undefined> => page.evaluate(() => document.querySelector<HTMLElement>("#town .town-cover")?.dataset["page"]);

// A drag across the town with the main button, which turns it.
async function drag(page: Page): Promise<void> {
	await page.mouse.move(400, 500);
	await page.mouse.down();
	await page.mouse.move(900, 520, { steps: 2 });
	await page.mouse.up();
}

// A zone in the bench's plan around a topic; the plan is as it was once the test ends, red or green: a zone left there
// made the next test red too.
async function zoned(context: TestContext, topic: string): Promise<void> {
	context.after(() => post(`${bench.base}/api/map/plan`, { project: "alpha", zones: { Billing: null }, zoneOf: { [topic]: null } }));
	await post(`${bench.base}/api/map/plan`, { project: "alpha", zones: { Billing: {} }, zoneOf: { [topic]: "Billing" } });
}

// The project's plan, read again under the town, laid the map out again as a card did: a zone drawn there carried no
// mask, and stood whole behind the town.
test("computer: the town takes no gesture while it comes or goes, and the map's cards come back with their bricks", async (context) => {
	const { page, errors } = await openPage(browser, DESKTOP);
	await page.addInitScript(() => {
		localStorage.setItem("sonar:view", "map");
		// The opening's time limit is not what is tested here: a busy machine opens the town in more than its 60 s.
		localStorage.setItem("sonar:town-limit", "300000");
	});
	await lightTown(page);
	// What the server tells the page: the new session is known to the page once its handle came.
	const told: string[] = [];
	page.on("websocket", (socket) => socket.on("framereceived", ({ payload }) => told.push(String(payload))));
	await page.goto(`${bench.base}/?projet=alpha`);
	await page.locator("#viewport .agent-card").first().waitFor({ timeout: 30_000 });
	const topic = await page.locator("#viewport .island").first().getAttribute("data-topic");
	assert.ok(topic, "the map shows a topic");
	const icon = page.locator(".zoom .town-toggle");
	await watch(page);
	await icon.click();

	// While the town comes, drag after drag: none turns it.
	const arrived = page.locator("#town .world-layer.shown");
	while ((await arrived.count()) === 0 && (await page.locator("body.town").count()) === 1) await drag(page);
	await arrived.waitFor({ state: "attached", timeout: 90_000 });
	const coming = (await read(page)).filter((frame) => !frame.arrived && frame.turned).length;
	// Once it is there, the same drag turns it; N brings it back straight.
	const compass = page.locator("#town .world-compass.turned");
	await drag(page);
	await compass.waitFor({ state: "attached", timeout: 30_000 });
	await page.keyboard.press("n");
	await compass.waitFor({ state: "detached", timeout: 30_000 });
	// The town there, an island left the page whole. Its ground under each card stayed: once the card's bricks had flown, a
	// pale block stood in its place behind the town, until the page was hidden, and again when the way back started (16/11).
	assert.equal(await shows(page), "gone", "nothing of the page shows once the town is there");

	// Under the town: a session at rest takes a turn, and a new session opens.
	const resting = await page.evaluate(
		() =>
			[...document.querySelectorAll<HTMLElement>("#viewport .agent-card")].find((card) => !card.classList.contains("work") && !card.classList.contains("wait"))
				?.dataset["handle"],
	);
	assert.ok(resting, "the project shows a session at rest");
	const host = readFileSync(`${bench.home}/.sonar/host.port`, "utf8").trim();
	await post(`http://127.0.0.1:${host}/send`, { handle: resting, text: "[agent turn] [reply] Done." });
	const opened = await post(`${bench.base}/api/session/open`, {
		cwd: `${bench.home}/projects/alpha`,
		name: "Opened under the town",
		text: "[agent turn] [reply] Opened.",
	});
	const handle = String(opened["handle"]);
	await settle(
		() => Promise.resolve(told.some((message) => message.includes(handle) && message.includes("Opened under the town"))),
		(known) => known,
	);
	// Under the town too, the plan takes a zone: the page reads it again.
	const reread = page.waitForResponse((response) => response.url().includes("/api/map/plan") && response.request().method() === "GET");
	await zoned(context, topic);
	await reread;
	await page.evaluate(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))));
	const under = await page.locator("#viewport .zone").count();

	// The way back, drag after drag.
	await read(page);
	await icon.click();
	while ((await page.locator("body.town").count()) === 1) await drag(page);
	const going = (await read(page)).filter((frame) => frame.town);
	const first = going.find((frame) => frame.shown);
	assert.ok(first, "the map shows again on the way back");
	// No drag turned the town while it came or went (the frames that show it turned), the page is not whole when the way
	// back starts, and no zone was drawn under the town.
	assert.deepEqual(
		{
			turnedComing: coming,
			turnedGoing: going.filter((frame) => frame.turned).length,
			wholeAtFirst: first.page !== "gone" && first.page !== "broken",
			zonesUnder: under,
		},
		{ turnedComing: 0, turnedGoing: 0, wholeAtFirst: false, zonesUnder: 0 },
	);

	// The page whole again: the map draws what changed under the town.
	await page.locator(`#viewport .agent-card[data-handle="${handle}"]`).waitFor({ timeout: 30_000 });
	await page.locator("#viewport .zone").waitFor({ state: "attached", timeout: 30_000 });
	assert.equal(await left(page), 0);
	assert.deepEqual(errors, []);
	await page.close();
});

// A zone's frame took no mask: its mask was written without `url()`, which the browser refuses. The zone stayed whole
// while the town came, and showed whole behind the town as soon as the way back started. And seen from far, an island
// shows its summary and hides its cards: the town still cut each hidden card on its own, and kept the island whole where
// they stand. Those blocks stayed on the page, behind the town, as it came and went (15/11).
test("computer, from far: a zone and its island leave the page whole with the ground, and come back with it", async (context) => {
	const { page, errors } = await openPage(browser, DESKTOP);
	await page.addInitScript(() => {
		localStorage.setItem("sonar:view", "map");
		// The opening's time limit is not what is tested here: a busy machine opens the town in more than its 60 s.
		localStorage.setItem("sonar:town-limit", "300000");
	});
	await lightTown(page);
	await page.goto(`${bench.base}/?projet=alpha`);
	await page.locator("#viewport .agent-card").first().waitFor({ timeout: 30_000 });
	const topic = await page.locator("#viewport .island").first().getAttribute("data-topic");
	assert.ok(topic, "the map shows a topic");
	// A plan with a zone lets the map go as far as its islands' summaries.
	await zoned(context, topic);
	await page.locator("#viewport .zone").waitFor({ state: "attached", timeout: 30_000 });
	const icon = page.locator(".zoom .town-toggle");
	await icon.waitFor({ timeout: 30_000 });
	// The wheel, notch after notch, until the island's cards are hidden.
	await page.mouse.move(700, 450);
	await settle(
		async () => {
			await page.mouse.wheel(0, 240);
			return page.evaluate(() => document.querySelector<HTMLElement>("#viewport .island .members")?.style.visibility);
		},
		(visibility) => visibility === "hidden",
	);
	await watch(page);
	await icon.click();
	await page.locator("#town .world-layer.shown").waitFor({ state: "attached", timeout: 90_000 });
	const coming = (await read(page)).filter((frame) => frame.town && !frame.arrived);

	// Under the town, nothing of the page shows: the zone and its island went with the ground.
	const under = await shows(page);
	await icon.click();
	await page.locator("body.town").waitFor({ state: "detached", timeout: 60_000 });
	const first = (await read(page)).find((frame) => frame.town && frame.shown);
	assert.ok(first, "the map shows again on the way back");
	// While the town comes, the zone goes with the ground; when the way back starts, it is still gone.
	assert.deepEqual(
		{
			goneComing: coming.some((frame) => frame.page === "broken" || frame.page === "gone"),
			under,
			wholeAtFirst: first.page !== "gone" && first.page !== "broken",
		},
		{ goneComing: true, under: "gone", wholeAtFirst: false },
	);
	// The page whole again: nothing of the dissolve is left, and the zone shows.
	assert.equal(await left(page), 0);
	assert.equal(await page.locator("#viewport .zone").isVisible(), true);
	assert.deepEqual(errors, []);
	await page.close();
});
