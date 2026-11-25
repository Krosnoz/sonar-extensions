// The page leaves along one edge as the town comes (src/edge.ts, cover.ts), from left to right, and a
// card leaves with the ground round it, at the same instant: a card kept whole while the page round it left, or that
// left a moment after it, read as a card that does not dissolve (18/11). Nothing of the page is copied, moved, masked or
// cut: a cover hides it behind the edge. A mask image on its things, or a shape cut in the map, made the browser draw
// the page again at each change, and the page flickered (17/11). The way back runs it backwards, and the page ends whole.

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

// What the page did since the last reading. `broken`: the frames that showed the page half gone. `ahead`: the least, in
// those frames, by which the left third of the screen was more gone than its right third. `apart`: the most, in those
// frames, between the share of a card that was gone and the share of the ground round it. `touched`: the most things of
// the map, the map itself too, that carried a mask image or a cut shape in a frame. `copies`: the most copies of a
// thing of the map the town held in a frame.
type Seen = { broken: number; ahead: number; apart: number; touched: number; copies: number };

// Every frame is read in the page: the test's own pace, on a busy machine, misses none.
const watch = (page: Page): Promise<void> =>
	page.evaluate(() => {
		const seen = { broken: 0, ahead: 1, apart: 0, touched: 0, copies: 0 };
		Object.assign(window, { seen });
		// How far a card's surroundings go round it, in pixels.
		const ROUND = 32;
		const step = (): void => {
			requestAnimationFrame(step);
			const touched = [...document.querySelectorAll<HTMLElement>("#viewport, #viewport *")].filter((node) => node.style.maskImage || node.style.clipPath);
			seen.touched = Math.max(seen.touched, touched.length);
			seen.copies = Math.max(seen.copies, document.querySelectorAll("#town .world, #town .island, #town .agent-card").length);
			const cover = document.querySelector<HTMLCanvasElement>("#town .town-cover");
			if (cover?.dataset["page"] !== "broken") return;
			seen.broken++;
			const box = cover.getBoundingClientRect();
			const { data } = cover.getContext("2d")!.getImageData(0, 0, cover.width, cover.height);
			const [kx, ky] = [cover.width / box.width, cover.height / box.height];
			// The cases of the cover under a box of the screen: how many, and how many are painted.
			const under = (left: number, top: number, right: number, bottom: number): [number, number] => {
				const [i0, i1] = [Math.max(0, Math.floor((left - box.left) * kx)), Math.min(cover.width, Math.ceil((right - box.left) * kx))];
				const [j0, j1] = [Math.max(0, Math.floor((top - box.top) * ky)), Math.min(cover.height, Math.ceil((bottom - box.top) * ky))];
				let painted = 0;
				for (let j = j0; j < j1; j++) for (let i = i0; i < i1; i++) if (data[(j * cover.width + i) * 4 + 3]! > 0) painted++;
				return [Math.max(0, i1 - i0) * Math.max(0, j1 - j0), painted];
			};
			const share = ([cases, painted]: [number, number]): number => painted / Math.max(1, cases);
			const third = box.width / 3;
			seen.ahead = Math.min(
				seen.ahead,
				share(under(box.left, box.top, box.left + third, box.bottom)) - share(under(box.right - third, box.top, box.right, box.bottom)),
			);
			for (const card of document.querySelectorAll("#viewport .agent-card")) {
				const { left, top, right, bottom } = card.getBoundingClientRect();
				const [inner, outer] = [under(left, top, right, bottom), under(left - ROUND, top - ROUND, right + ROUND, bottom + ROUND)];
				if (!inner[0] || outer[0] === inner[0]) continue;
				seen.apart = Math.max(seen.apart, Math.abs(share(inner) - share([outer[0] - inner[0], outer[1] - inner[1]])));
			}
		};
		requestAnimationFrame(step);
	});

// The readings since the last one.
const read = (page: Page): Promise<Seen> =>
	page.evaluate(() => {
		const seen = (window as unknown as { seen: Seen }).seen;
		const out = { ...seen };
		Object.assign(seen, { broken: 0, ahead: 1, apart: 0, touched: 0, copies: 0 });
		return out;
	});

// What the page shows of itself behind its edge ("whole", "broken", "gone").
const state = (page: Page): Promise<string | undefined> => page.evaluate(() => document.querySelector<HTMLElement>("#town .town-cover")?.dataset["page"]);

// The town's time is the test's. While the page is half gone, a fifth of a second for each drawing: on its own time,
// the test browser stopped for seconds to read the town's picture back; the town then counted a drawing for its whole
// time (src/morph.ts), and the page left between two drawings. Else a second for each drawing: the test
// browser takes seconds to draw the town, whatever it shows.
async function draw(page: Page, done: () => Promise<boolean>): Promise<void> {
	const limit = Date.now() + 240_000;
	while (!(await done())) {
		assert.ok(Date.now() < limit, "the town ends its move");
		await page.clock.fastForward((await state(page)) === "broken" ? 200 : 1000);
	}
}

test("computer: the page leaves along one edge as the town comes, a card with the ground round it, and comes back whole", async () => {
	const { page, errors } = await openPage(browser, DESKTOP);
	await page.addInitScript(() => localStorage.setItem("sonar:view", "map"));
	await lightTown(page);
	// The opening's time limit runs on the page's clock, which the test steps while the town is prepared: set out of reach.
	await page.addInitScript(() => localStorage.setItem("sonar:town-limit", "86400000"));
	await page.goto(`${bench.base}/?projet=alpha`);
	await page.locator("#viewport .agent-card").first().waitFor({ timeout: 30_000 });
	const icon = page.locator(".zoom .town-toggle");
	await icon.waitFor({ timeout: 30_000 });
	await watch(page);
	await held(page);
	await icon.click();
	await draw(page, async () => (await page.locator("#town .world-layer.shown").count()) > 0);

	// While the town came: the page was seen half gone, its left before its right, and no card stood whole in ground
	// already gone, nor left before it. Nothing of the map was masked, cut or copied.
	const coming = await read(page);
	assert.ok(coming.broken >= 3, `the page is seen half gone as the town comes (${coming.broken} frames)`);
	assert.ok(coming.ahead >= 0, `the page leaves from left to right (${coming.ahead})`);
	assert.ok(coming.apart < 0.5, `a card leaves with the ground round it (${coming.apart})`);
	assert.deepEqual({ touched: coming.touched, copies: coming.copies }, { touched: 0, copies: 0 });
	// The town there: nothing of the page shows.
	assert.equal(await state(page), "gone");

	// The way back: the page comes back along the same edge, and ends whole.
	await icon.click();
	await draw(page, async () => (await page.locator("body.town").count()) === 0);
	const going = await read(page);
	assert.ok(going.broken >= 3, `the page is seen half back as the town leaves (${going.broken} frames)`);
	assert.ok(going.ahead >= 0, `the page comes back from right to left (${going.ahead})`);
	assert.ok(going.apart < 0.5, `a card comes back with the ground round it (${going.apart})`);
	assert.deepEqual({ touched: going.touched, copies: going.copies }, { touched: 0, copies: 0 });
	assert.equal(await page.locator(".town-cover").count(), 0);
	assert.deepEqual(errors, []);
	await page.close();
});
