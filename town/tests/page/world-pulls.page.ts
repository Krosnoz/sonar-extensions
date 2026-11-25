// A subject's open pull requests show in the town: scaffolding on its building (src/scaffolds.ts) and a
// bar each on its sign, filled as its checks end (src/sign-nodes.ts). A check that fails turns both red;
// the pull request merged, both go; one that opens under the open town brings them. Before, the town said nothing of a
// subject's pull requests. What each change draws, piece by piece, is src/scaffolds.test.ts's.

import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import type { Browser, Page } from "playwright-core";
import { french as texts } from "../../src/i18n-fr.ts";
import { type Bench, DESKTOP, startBenchAndBrowser } from "../sonar/tests/page/support/bench.ts";
import { drawnOver } from "../sonar/tests/page/support/phone-finish-audit.ts";
import { told } from "../sonar/tests/page/support/told.ts";
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

// The pixels of the building's place that change from a drawing to the next one, at most, on a held clock:
// scaffolding that comes, goes or turns red changes four times as many.
const FEW = 60;

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

const NUMBER = 412;
type Check = "SUCCESS" | "FAILURE" | "IN_PROGRESS";
const pull = (state: "OPEN" | "MERGED", ci: "passed" | "failed" | "pending", checks: Check[]) => ({
	number: NUMBER,
	url: `https://github.com/acme/app/pull/${NUMBER}`,
	title: "Export des factures",
	state,
	draft: false,
	ci,
	checks: checks.map((each, index) => ({ name: `check ${index}`, state: each })),
	failing: ci === "failed" ? ["check 2"] : [],
});

// What the sign under work says: its bars (their tone and how full they are) and its name for a screen reader.
// `x`, `y`: where its roof's dot stands, which follows the camera.
type Sign = { bars: [string, string][]; label: string; x: number; y: number } | null;
const signOf = (page: Page): Promise<Sign> =>
	page.evaluate(() => {
		const gauge = document.querySelector<HTMLElement>("#town .world-sign .world-pulls");
		const sign = gauge?.closest<HTMLElement>(".world-sign");
		if (!gauge || !sign) return null;
		const box = (sign.previousElementSibling ?? sign).getBoundingClientRect();
		return {
			bars: [...gauge.querySelectorAll<HTMLElement>("i")].map((bar) => [bar.className, bar.style.getPropertyValue("--done")] as [string, string]),
			label: sign.getAttribute("aria-label") ?? "",
			x: box.x + box.width / 2,
			y: box.y + box.height / 2,
		};
	});

test("computer: a subject's pull request shows on its building and its sign, turns red, goes when merged, and comes back", async () => {
	const handle = bench.sessions.done;
	let prs = [pull("OPEN", "pending", ["SUCCESS", "SUCCESS", "IN_PROGRESS", "IN_PROGRESS", "IN_PROGRESS"])];
	const { page, errors, say } = await told(browser, DESKTOP, (agent) => (agent.handle === handle ? { ...agent, prs } : agent), "light");
	await page.addInitScript(() => {
		localStorage.setItem("sonar:view", "map");
		localStorage.setItem("sonar:town-limit", "300000");
	});
	await lightTown(page);
	await page.goto(`${bench.base}/?projet=alpha`);
	await page.locator(`#viewport .agent-card[data-handle="${handle}"]`).waitFor({ timeout: 30_000 });
	await page.locator(".zoom .town-toggle").click();
	await page.locator("#town .world-layer.shown").waitFor({ state: "attached", timeout: 300_000 });
	await page.locator("#town:not(.moving)").waitFor({ state: "attached", timeout: 90_000 });

	// The town's time is the test's from here: nothing moves between two readings, and each jump is one drawing.
	await held(page);
	const pass = async (seconds: number): Promise<void> => {
		await page.clock.fastForward(seconds * 1000);
		await page.clock.fastForward(100);
	};
	// The sign once it says `holds`: what the server tells reaches the fleet, then the town, a few drawings later.
	const shows = async (holds: (sign: Sign) => boolean): Promise<Sign> => {
		let sign = await signOf(page);
		for (let drawing = 0; drawing < 100 && !holds(sign); drawing++) {
			await page.clock.fastForward(100);
			sign = await signOf(page);
		}
		return sign;
	};
	const tell = (next: typeof prs): void => {
		prs = next;
		say({ type: "fleet-changes", changed: [], removed: [], order: null, patched: [[handle, { keys: [["prs", { set: next }]] }]] });
	};

	// As the town opens: the pull request's bar on its subject's sign, two checks of five ended, and its scaffolding up.
	const open = await shows((sign) => sign !== null);
	assert.ok(open, "the sign of a subject with an open pull request has its gauge");
	assert.deepEqual(open.bars, [["tone-wait", "0.4"]]);
	assert.ok(open.label.includes(texts.pull(NUMBER, 2, 5)), `the sign says the pull request to a screen reader (${open.label})`);
	assert.deepEqual(await drawnOver(page, "#town .world-sign:has(.world-pulls)"), []);
	// The camera ends its way to the town before the building's place is read: its roof's dot holds still.
	let roof: Sign = open;
	for (let same = 0, drawing = 0; same < 3 && drawing < 80; drawing++) {
		await pass(0.5);
		const now = await signOf(page);
		same = now && roof && Math.abs(now.x - roof.x) + Math.abs(now.y - roof.y) < 0.5 ? same + 1 : 0;
		roof = now;
	}
	assert.ok(roof, "the sign keeps its gauge while the camera settles");
	const clip = { x: Math.round(roof.x - 90), y: Math.round(roof.y - 20), width: 180, height: 150 };
	const read = (): Promise<Buffer> => page.screenshot({ clip });
	const built = await read();
	const still = await differing(page, built, await read());
	assert.ok(still <= FEW, `the building's place holds still on a held clock (${still} pixels differ)`);

	// A check fails: the bar and the scaffolding's planks turn red.
	tell([pull("OPEN", "failed", ["SUCCESS", "SUCCESS", "FAILURE", "SUCCESS", "IN_PROGRESS"])]);
	const failed = await shows((sign) => sign?.bars[0]?.[0] === "tone-urgent");
	assert.deepEqual(failed?.bars, [["tone-urgent", "0.8"]]);
	assert.ok(failed?.label.includes(texts.pullFails(NUMBER)), `the sign says the failure (${failed?.label})`);
	await pass(3);
	const red = await read();
	const reddened = await differing(page, built, red);
	assert.ok(reddened > FEW * 4, `the scaffolding has turned red (${reddened} pixels differ, ${still} when nothing happens)`);

	// The pull request is merged: no bar, no scaffolding.
	tell([pull("MERGED", "passed", ["SUCCESS", "SUCCESS", "SUCCESS", "SUCCESS", "SUCCESS"])]);
	assert.equal(await shows((sign) => sign === null), null, "a merged pull request leaves no gauge");
	await pass(4);
	const bare = await read();
	const left = await differing(page, red, bare);
	assert.ok(left > FEW * 4, `the scaffolding has gone (${left} pixels differ)`);

	// Another opens under the open town, its checks ended: its bar is full, and scaffolding comes.
	tell([pull("OPEN", "passed", ["SUCCESS", "SUCCESS", "SUCCESS", "SUCCESS", "SUCCESS"])]);
	const passed = await shows((sign) => sign !== null);
	assert.deepEqual(passed?.bars, [["tone-done", "1"]]);
	await pass(4);
	const again = await differing(page, bare, await read());
	assert.ok(again > FEW * 4, `scaffolding is on the building again (${again} pixels differ from the bare one)`);

	assert.deepEqual(errors, []);
	await page.close();
});
