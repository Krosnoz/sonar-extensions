// A merge told while the town is open is laid on its subject's building (src/sites.ts): a crane and a
// truck come first, then the roof goes up with the storey, and the town that followed shows the roof where a town
// opened after the merge has it. With motion reduced, the roof is up at once. Before, the town read its subjects'
// merges when it opened, and a merge showed at its next opening. What each step draws, piece by piece, is
// src/sites.test.ts's.

import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import type { Browser, Page } from "playwright-core";
import { type Bench, DESKTOP, startBenchAndBrowser } from "../sonar/tests/page/support/bench.ts";
import { told } from "../sonar/tests/page/support/told.ts";
import { inTownMode } from "./support/town.ts";
import { openedTown, pass } from "./support/town-clock.ts";

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

// Where the subject's roof stands on the screen: the dot of its sign, which follows the camera. The bench sorts its
// sessions in one subject: no other sign moves this one to another corner of its roof.
type Roof = { x: number; y: number };
const roofOf = (page: Page): Promise<Roof | null> =>
	page.evaluate(() => {
		const signs = [...document.querySelectorAll<HTMLElement>("#town .world-sign")];
		const box = signs.length === 1 ? signs[0]!.previousElementSibling?.getBoundingClientRect() : undefined;
		return box ? { x: box.x + box.width / 2, y: box.y + box.height / 2 } : null;
	});
// A storey on the screen is some 40 pixels high: the roof is up when its sign stands this much higher.
const UP = 10;
const raised = (from: Roof, to: Roof | null): boolean => to !== null && from.y - to.y > UP;

// The clock goes on, a drawing at a time, until the roof is up from `from`, `most` seconds at most. Returns the roof.
async function risen(page: Page, from: Roof, most: number): Promise<Roof | null> {
	let roof = await roofOf(page);
	for (let half = 0; half < most * 2 && !raised(from, roof); half++) {
		// oxlint-disable-next-line no-await-in-loop
		await pass(page, 0.5);
		// oxlint-disable-next-line no-await-in-loop
		roof = await roofOf(page);
	}
	return roof;
}

// Where the roof stands once the town's camera rests.
async function rested(page: Page): Promise<Roof> {
	let roof = await roofOf(page);
	let same = 0;
	for (let drawing = 0; same < 3 && drawing < 120; drawing++) {
		// oxlint-disable-next-line no-await-in-loop
		await pass(page, 0.5);
		// A second drawing, a tenth of a second later: what eases by the frame (the camera, a sign) takes a short one.
		// oxlint-disable-next-line no-await-in-loop
		await page.clock.fastForward(100);
		// oxlint-disable-next-line no-await-in-loop
		const next = await roofOf(page);
		same = next && roof && Math.abs(next.x - roof.x) + Math.abs(next.y - roof.y) < 0.5 ? same + 1 : 0;
		roof = next;
	}
	assert.ok(roof && same === 3, `the town shows its subject's sign, and its camera rests (${JSON.stringify(roof)})`);
	return roof;
}

// The town of project alpha, its subject with `merges` merges, its clock held once its camera rests. `tell`: its
// subject's merges become `merges`, as the server says them on each of its sessions.
async function townOf(merges: number) {
	const handles = new Set<string>();
	let now = merges;
	const { page, errors, say } = await told(
		browser,
		DESKTOP,
		(agent) => {
			if (agent.handle) handles.add(agent.handle);
			return { ...agent, topicMerges: now };
		},
		"light",
	);
	// Opened with motion reduced: the camera is on the town at once, without its way there.
	await page.emulateMedia({ colorScheme: "light", reducedMotion: "reduce" });
	await openedTown(page, bench);
	const roof = await rested(page);
	const tell = (next: number): void => {
		now = next;
		say({
			type: "fleet-changes",
			changed: [],
			removed: [],
			order: null,
			patched: [...handles].map((handle) => [handle, { keys: [["topicMerges", { set: next }]] }]),
		});
	};
	// What the fleet said while the town came is there at once at its next telling (src/toggle.ts):
	// told once here, as it is, so that the test's own telling is played.
	tell(merges);
	await pass(page, 1);
	return { page, errors, roof, tell };
}

test("computer: a merge told under the open town is laid on its building as in a town opened anew; with motion reduced, the next one is there at once", async () => {
	// Both towns open at once: an opening is most of the test's time.
	const [anew, town] = await Promise.all([townOf(1), townOf(0)]);
	assert.deepEqual(anew.errors, []);
	await anew.page.close();
	assert.ok(raised(town.roof, anew.roof), `a town opened on one merge has a storey more (${JSON.stringify([town.roof, anew.roof])})`);
	await town.page.emulateMedia({ colorScheme: "light", reducedMotion: "no-preference" });
	// The page hears the system's setting change a moment later (Sonar's apps/web/src/appearance/preference.ts): a merge told
	// before would be there at once, as with motion reduced.
	await town.page.waitForFunction(() => document.documentElement.dataset["motion"] !== "reduced", undefined, { polling: 100, timeout: 30_000 });
	town.tell(1);
	// A crane is born by the building and a truck comes first: the roof waits for the pallet.
	await pass(town.page, 5);
	const early = await roofOf(town.page);
	assert.ok(early && Math.abs(early.y - town.roof.y) < 1.5, `the roof waits for the pallet (${JSON.stringify([town.roof, early])})`);
	// The crane lifts the pallet to the storey to come: the roof goes up, as in the town opened on that merge.
	const rising = await risen(town.page, town.roof, 40);
	assert.ok(raised(town.roof, rising), `the roof goes up with its storey (${JSON.stringify([town.roof, rising])})`);
	// Its sign follows it up: read once it rests.
	const laid = await rested(town.page);
	const said = JSON.stringify({ before: town.roof, laid, anew: anew.roof });
	assert.ok(Math.abs(laid.x - anew.roof.x) < 1.5 && Math.abs(laid.y - anew.roof.y) < 1.5, `the roof stands where a town opened on that merge has it (${said})`);
	// With motion reduced, the next merge begins a storey at once: the town tells a change within two seconds
	// (src/live.ts), and no crane nor truck comes first.
	await town.page.emulateMedia({ colorScheme: "light", reducedMotion: "reduce" });
	town.tell(2);
	const next = await risen(town.page, laid, 3);
	assert.ok(raised(laid, next), `with motion reduced, the roof is up at once (${JSON.stringify([laid, next])})`);
	assert.deepEqual(town.errors, []);
	await town.page.close();
});
