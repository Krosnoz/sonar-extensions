// A town opened over the bench's map, its clock held: its time is the test's from there, each jump one drawing (see
// ../world-pulls.page.ts).

import type { Page } from "playwright-core";
import { animationsEnded, type Bench, lastReading } from "../../sonar/tests/page/support/bench.ts";
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
// The frame the town asked for before the hold is the browser's own, not the held clock's: on a busy machine it comes
// seconds late, and until it has come no jump of the clock draws the town. A test that stepped the clock then read
// the same picture at each step: it took a camera still flying for one at rest (the roof 59 to 103 px aside, 22 to
// 24/11). The hold ends once the town has drawn again: its next frame is the held clock's. That frame came 1 to 9 s
// late on a calm machine (36 openings, 25/11), and a town opens eight times slower beside the merge queue's full
// pass. A town whose frame is already the held clock's draws with a jump, and not always with the first: measured once
// in 60 openings, its frame came with the second only (25/11), and a hold that jumped once waited two minutes for nothing.
// The clock jumps before each reading, a frame's time and little more. The hold waits two minutes at most, then
// lets the test go on as it did before.
export async function held(page: Page): Promise<void> {
	await page.clock.install();
	for (let attempt = 0; ; attempt++) {
		try {
			// oxlint-disable-next-line no-await-in-loop
			await page.clock.pauseAt((await page.evaluate(() => Date.now())) + 10_000);
			break;
		} catch (error) {
			if (attempt === 4 || !String(error).includes("to the past")) throw error;
		}
	}
	const before = await drawings(page);
	// No town on the page: nothing to wait for.
	if (before < 0) return;
	await lastReading(
		async () => {
			// The clock held, a frame of its own comes only with a jump: 16 ms at most ahead.
			await page.clock.fastForward(20);
			return drawings(page);
		},
		(count) => count > before,
		120_000,
	);
}

// How many times the town has drawn since this was first asked: each drawing writes its level on its layer
// (src/view-frames.ts#loop). -1 without a town.
function drawings(page: Page): Promise<number> {
	return page.evaluate(() => {
		const layer = document.querySelector("#town .world-layer");
		const kept = window as unknown as { townDrawings?: number };
		if (!layer) return -1;
		if (kept.townDrawings === undefined) {
			kept.townDrawings = 0;
			new MutationObserver((records) => (kept.townDrawings = (kept.townDrawings ?? 0) + records.length)).observe(layer, {
				attributes: true,
				attributeFilter: ["data-level"],
			});
		}
		return kept.townDrawings;
	});
}

// The town's clock goes on by half seconds, one drawing each: a site's own step is no longer
// (src/sites.ts), and a drawing costs the test's browser more than a second.
export async function pass(page: Page, seconds: number): Promise<void> {
	// oxlint-disable-next-line no-await-in-loop
	for (let half = 0; half < Math.round(seconds * 2); half++) await page.clock.fastForward(500);
}
