// A subject's building takes its height from its merges, which the server says on each of its sessions (the contract's
// topicMerges, Sonar's apps/server/src/fleet/merged.ts): a storey more each time they double (src/page/sites/merge-floors.ts).
// Before, its height followed how many agents the subject had now. The same fleet is opened with 0, 1 then 3 merges:
// its roof rises by one then two storeys; with 2, the roof already stands over the storey to come. The rule itself,
// merge by merge, is src/page/sites/merge-floors.test.ts's.

import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import type { Browser, Page } from "playwright-core";
import { animationsEnded, type Bench, DESKTOP, startBenchAndBrowser } from "../sonar/tests/page/support/bench.ts";
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

// Where the subject's roof stands on the screen: the dot of its sign, which follows the camera. The bench sorts its
// sessions in one subject: no other sign moves this one to another corner of its roof.
type Roof = { x: number; y: number } | null;
const roofOf = (page: Page): Promise<Roof> =>
	page.evaluate(() => {
		const signs = [...document.querySelectorAll<HTMLElement>("#town .world-sign")];
		const box = signs.length === 1 ? signs[0]!.previousElementSibling?.getBoundingClientRect() : undefined;
		return box ? { x: box.x + box.width / 2, y: box.y + box.height / 2 } : null;
	});

// The building's place on the screen, by its merges, as each town showed it once its camera rested.
const pictures = new Map<number, Buffer>();

// Where two pictures of the building's place differ, the pixels of the first that are a site's net (its green cloth
// and its mesh), and the others. `rows`: the first and the last row read, the storey to come's: over it a car passes
// in the street behind the roof, under it the building's inhabitants walk, and neither is where it was in the other
// picture. `tall`: how many rows of net a column of the picture shows (the median of the columns that show some).
type Net = { net: number; rest: number; tall: number };
async function netOver(one: Buffer, other: Buffer, rows: [number, number]): Promise<Net> {
	const page = await browser.newPage();
	const counted = await page.evaluate(
		async ([given, [from, to]]) => {
			const pixels: number[][] = [];
			let width = 0;
			for (const data of given) {
				const image = new Image();
				image.src = `data:image/png;base64,${data}`;
				// oxlint-disable-next-line no-await-in-loop
				await image.decode();
				const context = new OffscreenCanvas(image.width, image.height).getContext("2d");
				context?.drawImage(image, 0, 0);
				pixels.push([...(context?.getImageData(0, from, image.width, to - from).data ?? [])]);
				({ width } = image);
			}
			const [a = [], b = []] = pixels;
			const columns = Array.from({ length: width }, () => 0);
			let [net, rest] = [0, 0];
			for (let at = 0; at < a.length; at += 4) {
				const [red, green, blue] = [a[at]!, a[at + 1]!, a[at + 2]!];
				if (Math.abs(red - b[at]!) + Math.abs(green - b[at + 1]!) + Math.abs(blue - b[at + 2]!) <= 90) continue;
				if (green > red + 20 && green > blue + 8) {
					net++;
					columns[(at / 4) % width]!++;
				} else rest++;
			}
			// A few pixels alone are a drawing's noise, not the net.
			const shown = columns.filter((count) => count > 2).toSorted((x, y) => x - y);
			return { net, rest, tall: shown[Math.floor(shown.length / 2)] ?? 0 };
		},
		[[one.toString("base64"), other.toString("base64")], rows] as const,
	);
	await page.close();
	return counted;
}

// The town of project alpha, its subject with `merges` merges, read once its camera rests. `framed`: the roof its
// picture is taken from, another town's for two pictures that compare pixel by pixel (its own by default). `late`: the
// frame the town has asked for when its clock is held comes that many ms late, as on a machine short of processor.
async function townOf(merges: number, { framed, late = 0 }: { framed?: { x: number; y: number }; late?: number } = {}): Promise<{ x: number; y: number }> {
	const { page, errors } = await told(browser, DESKTOP, (agent) => ({ ...agent, topicMerges: merges }), "light");
	if (late)
		await page.addInitScript(() => {
			// The page's own frames and timers, taken before the held clock replaces them.
			const [frame, later] = [window.requestAnimationFrame.bind(window), window.setTimeout.bind(window)];
			window.requestAnimationFrame = (callback) =>
				frame((at) => {
					const ms = (window as unknown as { lateFrame?: number }).lateFrame ?? 0;
					if (ms) later(() => callback(performance.now()), ms);
					else callback(at);
				});
		});
	await page.addInitScript(() => {
		localStorage.setItem("sonar:view", "map");
		localStorage.setItem("sonar:town-limit", "300000");
	});
	await lightTown(page);
	await page.goto(`${bench.base}/?projet=alpha`);
	await page.locator("#viewport .agent-card[data-handle]").first().waitFor({ timeout: 30_000 });
	// The map holds still before the town opens: the camera starts from the size its subject's zone has on the page
	// (src/page/camera/framing.ts), and a zone still growing opened the town 59 px aside.
	await animationsEnded(page);
	await page.waitForFunction(
		() => {
			const read = JSON.stringify([...document.querySelectorAll("#viewport .island")].map((island) => Object.values(island.getBoundingClientRect().toJSON())));
			const kept = document.body.dataset["islandsRead"];
			document.body.dataset["islandsRead"] = read;
			return read === kept;
		},
		undefined,
		// A loaded machine draws the map slowly: its zones took more than 30 s to rest beside two other page files.
		{ polling: 250, timeout: 120_000 },
	);
	await page.locator(".zoom .town-toggle").click();
	await page.locator("#town .world-layer.shown").waitFor({ state: "attached", timeout: 300_000 });
	await page.locator("#town:not(.moving)").waitFor({ state: "attached", timeout: 90_000 });
	if (late) await page.evaluate((ms) => void ((window as unknown as { lateFrame?: number }).lateFrame = ms), late);
	// The town's time is the test's from here: each jump is one drawing (see ./world-pulls.page.ts).
	await held(page);
	let roof = await roofOf(page);
	let same = 0;
	for (let drawing = 0; same < 3 && drawing < 120; drawing++) {
		await page.clock.fastForward(500);
		await page.clock.fastForward(100);
		const now = await roofOf(page);
		same = now && roof && Math.abs(now.x - roof.x) + Math.abs(now.y - roof.y) < 0.5 ? same + 1 : 0;
		roof = now;
	}
	assert.ok(roof && same === 3, `the town shows its subject's sign, and its camera rests (${JSON.stringify(roof)})`);
	assert.deepEqual(await drawnOver(page, "#town .world-sign"), []);
	const from = framed ?? roof;
	// The picture comes after the drawings the rest asked for, seconds each in the test's browser: beside the merge
	// queue's full pass it took more than Playwright's 30 s (25/11). The limit is the one the town has to open.
	const clip = { x: Math.round(from.x - 90), y: Math.round(from.y - 20), width: 180, height: 150 };
	pictures.set(merges, await page.screenshot({ clip, timeout: 300_000 }));
	assert.deepEqual(errors, []);
	await page.close();
	return roof;
}

// No merge, 1 then 3: one, two then three storeys. Low buildings: from four storeys up the camera moves back to show
// its town whole (4 px aside and a storey 2 px smaller at four, measured 21/11), and the roofs no longer compare.
test("computer: a subject's building rises a storey each time its merges double", async () => {
	const none = await townOf(0);
	// This town draws 3 s late when its clock is held, as beside other page files: its camera still flies then, and the
	// test must wait for its rest. Before, it read the same frame three times, took the flight for a rest, and found
	// the roof 59 to 103 px aside (22 to 24/11).
	const one = await townOf(1, { late: 3000 });
	const three = await townOf(3);
	const said = JSON.stringify([none, one, three]);
	assert.ok(Math.abs(one.x - none.x) < 1 && Math.abs(three.x - none.x) < 1, `the building stands where it stood (${said})`);
	const [storey, two] = [none.y - one.y, none.y - three.y];
	assert.ok(storey > 10, `a first merge raises the roof a storey (${said})`);
	assert.ok(Math.abs(two / storey - 2) < 0.1, `3 merges raise it two storeys (${said})`);
	// Between two doublings, the roof stands over the storey to come, of which each merge lays its share: with 2 merges
	// it is as high as with 3, which finish that storey.
	const between = await townOf(2, { framed: three });
	assert.ok(
		Math.abs(between.y - three.y) < 1.5 && Math.abs(between.x - three.x) < 1.5,
		`2 merges lift the roof over the storey to come (${JSON.stringify(between)}, ${said})`,
	);
	// What is left to lay of that storey is under a site's net (src/page/sites/site-net.ts): where the building
	// with 2 merges differs from the one with 3, it shows the net. Before, the storey was laid in small scattered cubes,
	// with holes and lines in the user's accent between them: from afar it read as a broken display.
	// The picture starts 20 px over the sign's dot, which stands a storey and a quarter over the roof's foot: the storey
	// to come shows from under half a storey to over three storeys under the dot, its near corner the lowest (measured
	// 24/11: rows 32 to 97 for a storey of 25 px).
	const rows: [number, number] = [Math.round(20 + storey * 0.4), Math.round(20 + storey * 3.2)];
	const { net, rest, tall } = await netOver(pictures.get(2)!, pictures.get(3)!, rows);
	assert.ok(net > 200 && rest < net / 4, `what is left to lay of the storey is under a net (${net} pixels of net, ${rest} others)`);
	// 2 merges lay half the storey: the net covers the other half only, not the storey whole (measured 24/11: 10 rows
	// of net for a storey of 25 px).
	assert.ok(tall > storey * 0.25 && tall < storey * 0.65, `the net covers what is left to lay only (${tall} rows of net, a storey of ${storey} px)`);
});
