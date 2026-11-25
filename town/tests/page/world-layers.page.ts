// An agent's figure goes and is born in layers (src/layers.ts) when the page says so, by the event
// "town-life" on the town. Its name goes with it and comes back with it; where it stood, the town's drawing shows the
// ground, then the figure again.

import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import type { Browser, Page } from "playwright-core";
import { type Bench, DESKTOP, openPage, startBenchAndBrowser } from "../sonar/tests/page/support/bench.ts";
import { inTownMode } from "./support/town.ts";
import { held } from "./support/town-clock.ts";
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

// The pixels of the figure's place that change from a drawing to the next one, at most, on a held clock: a figure
// that goes or comes changes four times as many.
const FEW = 40;

// The pixels that differ between two pictures of the same size.
const differing = (page: Page, one: Buffer, other: Buffer): Promise<number> =>
	page.evaluate(
		async (pictures) => {
			const pixels: number[][] = [];
			for (const data of pictures) {
				const image = new Image();
				image.src = `data:image/png;base64,${data}`;
				// oxlint-disable-next-line no-await-in-loop
				await image.decode();
				const context = new OffscreenCanvas(image.width, image.height).getContext("2d");
				context?.drawImage(image, 0, 0);
				pixels.push([...(context?.getImageData(0, 0, image.width, image.height).data ?? [])]);
			}
			const [a = [], b = []] = pixels;
			let count = 0;
			for (let at = 0; at < a.length; at += 4)
				if (Math.abs(a[at]! - b[at]!) + Math.abs(a[at + 1]! - b[at + 1]!) + Math.abs(a[at + 2]! - b[at + 2]!) > 90) count++;
			return count;
		},
		[one.toString("base64"), other.toString("base64")],
	);

// Where the name of the agent `title` stands, and whether it shows.
const nameOf = (page: Page, title: string): Promise<{ shown: boolean; x: number; bottom: number } | null> =>
	page.evaluate((text) => {
		const node = [...document.querySelectorAll<HTMLElement>("#town .world-name")].find((each) => each.textContent?.includes(text));
		if (!node) return null;
		const box = node.getBoundingClientRect();
		const shown = box.width > 0 && !node.classList.contains("world-off") && getComputedStyle(node).opacity === "1";
		return { shown, x: box.x + box.width / 2, bottom: box.bottom };
	}, title);

// The name once it shows, or not, as `shown` says: its fade runs on the browser's own time, ten seconds at most.
async function shownName(page: Page, title: string, shown: boolean): ReturnType<typeof nameOf> {
	let name = await nameOf(page, title);
	for (const started = Date.now(); (name?.shown ?? false) !== shown && Date.now() - started < 10_000;) name = await nameOf(page, title);
	return name;
}

const tell = (page: Page, handle: string, born: boolean): Promise<boolean> =>
	page.evaluate(
		([who, comes]) => document.querySelector("#town")!.dispatchEvent(new CustomEvent("town-life", { detail: { handle: who, child: null, born: comes } })),
		[handle, born] as const,
	);

test("computer: an agent's figure goes in layers when the page says so, its name with it, and is born again", async () => {
	const { page, errors } = await openPage(browser, DESKTOP);
	await page.addInitScript(() => localStorage.setItem("sonar:view", "map"));
	await lightTown(page);
	await page.goto(`${bench.base}/?projet=alpha`);
	// An agent that waits stands still: where it stands is read before and after.
	const card = page.locator("#viewport .agent-card.wait[data-handle]").first();
	await card.waitFor({ timeout: 30_000 });
	const handle = (await card.getAttribute("data-handle"))!;
	const title = ((await card.locator(".head .name").textContent()) ?? "").trim();
	await page.locator(".zoom .town-toggle").click();
	await page.locator("#town .world-layer.shown").waitFor({ state: "attached", timeout: 90_000 });
	await page.locator("#town .world-name").first().waitFor({ state: "attached", timeout: 30_000 });

	// The town's time is the test's from here: nothing moves between two readings. The time passes by jumps, one
	// drawing for each: the processor draws the town slowly, and the layers only read the town's seconds.
	await held(page);
	const pass = async (seconds: number): Promise<void> => {
		await page.clock.fastForward(seconds * 1000);
		await page.clock.fastForward(100);
	};
	// Towards the figure, as near as the town goes: the zoom stays anchored where the pointer is. The camera eases by a
	// tenth of a second at most for each drawing.
	const far = await nameOf(page, title);
	assert.ok(far, `the town has the name of "${title}"`);
	await page.mouse.move(far.x, far.bottom + 20);
	for (let notch = 0; notch < 14; notch++) {
		await page.mouse.wheel(0, -200);
		await page.clock.fastForward(100);
	}
	for (let drawing = 0; drawing < 20; drawing++) await page.clock.fastForward(100);
	const name = await shownName(page, title, true);
	assert.equal(name?.shown, true, `the name of "${title}" shows at the nearest level`);
	const clip = { x: Math.round(name!.x - 22), y: Math.round(name!.bottom + 35), width: 44, height: 65 };
	const read = (): Promise<Buffer> => page.screenshot({ clip });
	const there = await read();
	const still = await differing(page, there, await read());
	assert.ok(still <= FEW, `the figure's place holds still on a held clock (${still} pixels differ)`);

	assert.equal(await tell(page, handle, false), true);
	await pass(3);
	const away = await read();
	const gone = await differing(page, there, away);
	assert.ok(gone > FEW * 4, `the figure has left its place (${gone} pixels differ, ${still} when nothing happens)`);
	assert.equal((await shownName(page, title, false))?.shown ?? false, false, "its name has gone with it");

	assert.equal(await tell(page, handle, true), true);
	await pass(3.5);
	const back = await differing(page, away, await read());
	assert.ok(back > FEW * 4, `the figure is in its place again (${back} pixels differ from the empty place)`);
	assert.equal((await shownName(page, title, true))?.shown, true, "its name is back with it");

	// A figure the town does not have changes nothing, and breaks nothing.
	await tell(page, "s-unknown", false);
	await pass(0.5);
	assert.deepEqual(errors, []);
	await page.close();
});
