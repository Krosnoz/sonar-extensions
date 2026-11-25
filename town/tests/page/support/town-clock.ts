// A town opened over the bench's map, its clock held: its time is the test's from there, each jump one drawing (see
// ../world-pulls.page.ts).

import type { Page } from "playwright-core";
import { animationsEnded, type Bench } from "../../sonar/tests/page/support/bench.ts";
import { lightTown } from "./town-draw.ts";

// The town of project alpha opens over its map, and its clock is held.
export async function openedTown(page: Page, bench: Bench): Promise<void> {
	await page.addInitScript(() => {
		localStorage.setItem("sonar:view", "map");
		localStorage.setItem("sonar:town-limit", "300000");
	});
	await lightTown(page);
	await page.goto(`${bench.base}/?projet=alpha`);
	await page.locator("#viewport .agent-card[data-handle]").first().waitFor({ timeout: 30_000 });
	// The map holds still before the town opens (see ../world-merges.page.ts).
	await animationsEnded(page);
	await page.waitForFunction(
		() => {
			const read = JSON.stringify([...document.querySelectorAll("#viewport .island")].map((island) => Object.values(island.getBoundingClientRect().toJSON())));
			const kept = document.body.dataset["islandsRead"];
			document.body.dataset["islandsRead"] = read;
			return read === kept;
		},
		undefined,
		{ polling: 250, timeout: 120_000 },
	);
	await page.locator(".zoom .town-toggle").click();
	await page.locator("#town .world-layer.shown").waitFor({ state: "attached", timeout: 300_000 });
	await page.locator("#town:not(.moving)").waitFor({ state: "attached", timeout: 90_000 });
	await held(page);
}

// The page's clock, held ten seconds ahead: a hold a second ahead was in the page's past once the page had drawn. The
// clock runs until it is held, and a drawing costs the test's browser more than a second: on a busy machine the ten
// seconds pass too between the reading and the hold, which Playwright refuses ("to the past"). The time is read again
// then.
export async function held(page: Page): Promise<void> {
	await page.clock.install();
	for (let attempt = 0; ; attempt++) {
		try {
			// oxlint-disable-next-line no-await-in-loop
			await page.clock.pauseAt((await page.evaluate(() => Date.now())) + 10_000);
			return;
		} catch (error) {
			if (attempt === 4 || !String(error).includes("to the past")) throw error;
		}
	}
}

// The town's clock goes on by half seconds, one drawing each: a site's own step is no longer
// (src/sites.ts), and a drawing costs the test's browser more than a second.
export async function pass(page: Page, seconds: number): Promise<void> {
	// oxlint-disable-next-line no-await-in-loop
	for (let half = 0; half < Math.round(seconds * 2); half++) await page.clock.fastForward(500);
}
