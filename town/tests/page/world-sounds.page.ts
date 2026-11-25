// The open town plays a short sound for each event it plays where the screen shows it (src/town-sound.ts):
// here, the tests of a pull request that fail, its scaffolding turning red. The sound files the page asks for are
// counted: a sound is asked for its file when it plays. What stood as the town opened is not heard; the same event is
// not heard once its line or all the sounds are cut. Which note each event plays, and every rule of the ear, is
// src/town-sound.test.ts's.

import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import type { Browser, Page } from "playwright-core";
import { type Bench, DESKTOP, settle, startBenchAndBrowser } from "../sonar/tests/page/support/bench.ts";
import { told } from "../sonar/tests/page/support/told.ts";
import { inTownMode, soundFileOf } from "./support/town.ts";
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

// The files of the town's sounds (copies of Sonar's own in assets/sounds/, played lower and tuned).
const TOWN = new Set(["wood-tap.mp3", "pluck.mp3", "bubble.mp3"]);
// A file the test asks for itself: the requests come in the order they were made, so once it is seen, any sound asked
// before it is seen too.
const BARRIER = "barrier.mp3";

// The sound files the page asks for.
function soundsAsked(page: Page): string[] {
	const asked: string[] = [];
	page.on("request", (request) => {
		const file = soundFileOf(new URL(request.url()).pathname);
		if (file) asked.push(file);
	});
	return asked;
}

// The town's sound files asked for so far.
async function townFiles(page: Page, asked: string[]): Promise<string[]> {
	const barriers = asked.filter((file) => file === BARRIER).length;
	await page.evaluate((file) => void fetch(`/sounds/${file}`).catch(() => undefined), BARRIER);
	await settle(
		async () => asked.filter((file) => file === BARRIER).length,
		(seen) => seen > barriers,
	);
	return asked.filter((file) => TOWN.has(file));
}

const NUMBER = 412;
const pull = (ci: "pending" | "failed") => ({
	number: NUMBER,
	url: `https://github.com/acme/app/pull/${NUMBER}`,
	title: "Export des factures",
	state: "OPEN",
	draft: false,
	ci,
	checks: ["SUCCESS", ci === "failed" ? "FAILURE" : "IN_PROGRESS"].map((state, index) => ({ name: `check ${index}`, state })),
	failing: ci === "failed" ? ["check 1"] : [],
});

// The town of project alpha, opened on a pull request whose checks run, the sounds set as `sounds` keeps them on this
// device. Its clock is held, and goes on a drawing at a time. Returns the town's sound files asked for once the town is
// open, then once the pull request's checks failed under it.
async function heard(sounds: object | null): Promise<{ opened: string[]; failed: string[] }> {
	const handle = bench.sessions.done;
	let prs = [pull("pending")];
	const { page, errors, say } = await told(browser, DESKTOP, (agent) => (agent.handle === handle ? { ...agent, prs } : agent), "light");
	await page.addInitScript(
		(kept) => {
			localStorage.setItem("sonar:view", "map");
			localStorage.setItem("sonar:town-limit", "300000");
			if (kept) localStorage.setItem("sonar:sounds", kept);
		},
		sounds && JSON.stringify(sounds),
	);
	await lightTown(page);
	const asked = soundsAsked(page);
	await page.goto(`${bench.base}/?projet=alpha`);
	await page.locator(`#viewport .agent-card[data-handle="${handle}"]`).waitFor({ timeout: 30_000 });
	await page.locator(".zoom .town-toggle").click();
	await page.locator("#town .world-layer.shown").waitFor({ state: "attached", timeout: 300_000 });
	await page.locator("#town:not(.moving)").waitFor({ state: "attached", timeout: 90_000 });
	// The page plays the sounds: its audio runs, and it holds the tabs' lock (Sonar's apps/web/src/tabs/sound-holder.ts).
	const holds = (): Promise<boolean> =>
		page.evaluate(() => navigator.locks.query().then(({ held: locks = [] }) => locks.some((lock) => lock.name === "sonar:sound")));
	assert.equal(await settle(holds, Boolean), true, "the page holds the sounds");
	await held(page);
	// The town drawn, a drawing at a time, until its sign says `bar` (100 drawings at most), then 20 more.
	const drawn = async (bar: string): Promise<void> => {
		const said = page.locator(`#town .world-sign .world-pulls i.${bar}`);
		// oxlint-disable-next-line no-await-in-loop
		for (let drawing = 0; drawing < 100 && !(await said.count()); drawing++) await page.clock.fastForward(100);
		assert.equal(await said.count(), 1, `the sign says the pull request (${bar})`);
		// oxlint-disable-next-line no-await-in-loop
		for (let drawing = 0; drawing < 20; drawing++) await page.clock.fastForward(100);
	};
	// The sign says the pull request, its scaffolding stands: the town shows what it opened on.
	await drawn("tone-wait");
	const opened = await townFiles(page, asked);
	// The checks fail: the scaffolding shakes, red.
	prs = [pull("failed")];
	say({ type: "fleet-changes", changed: [], removed: [], order: null, patched: [[handle, { keys: [["prs", { set: prs }]] }]] });
	await drawn("tone-urgent");
	const failed = await townFiles(page, asked);
	assert.deepEqual(errors, []);
	await page.close();
	return { opened, failed };
}

test("computer: the open town is heard as a pull request's checks fail under it; not what stood as it opened, nor a cut line, nor with the sounds off", async () => {
	// The three towns open at once: an opening is most of the test's time.
	const [played, lineCut, allOff] = await Promise.all([heard(null), heard({ off: ["town-pulls"] }), heard({ on: false })]);
	assert.deepEqual(played.opened, [], "the scaffolding the town opened on is not heard");
	assert.deepEqual(played.failed, ["wood-tap.mp3"], "the checks that fail under the open town are heard");
	assert.deepEqual(lineCut, { opened: [], failed: [] }, "the line « Une PR en test » cut, nothing is heard");
	assert.deepEqual(allOff, { opened: [], failed: [] }, "the sounds off, nothing is heard");
});
