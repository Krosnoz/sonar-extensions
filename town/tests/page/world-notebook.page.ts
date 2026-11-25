// An inhabitant's card and notebook (src/notebook.ts): while the pointer rests on an inhabitant, a card
// says what its session is doing; a click pins it as its notebook, with what happened to it lately and a button that
// opens its session. Before, the town said nothing of an inhabitant but its name. Who stands under a point is
// src/note-under.test.ts's.

import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import type { Browser, Page } from "playwright-core";
import { animationsEnded, type Bench, DESKTOP, startBenchAndBrowser } from "../sonar/tests/page/support/bench.ts";
import { blendedCards } from "../sonar/tests/page/support/blended-cards.ts";
import { outOfReach } from "../sonar/tests/page/support/out-of-reach-audit.ts";
import { drawnOver } from "../sonar/tests/page/support/phone-finish-audit.ts";
import { told, type Told } from "../sonar/tests/page/support/told.ts";
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

// What happened to each session that waits, the latest last, as the server says it: four things, one more than a
// notebook shows.
const PAST = [
	{ at: Date.UTC(2026, 0, 5, 9, 1), kind: "merged", text: "398" },
	{ at: Date.UTC(2026, 0, 5, 9, 20), kind: "tasks-done", text: "2/2" },
	{ at: Date.UTC(2026, 0, 5, 9, 41), kind: "ci-failed", text: "1" },
	{ at: Date.UTC(2026, 0, 5, 9, 58), kind: "ended", text: "The menu opens at a click." },
];

// What the town's card shows now.
// `kept`: its button is the one the test marked. `focused`: the keyboard is on something in it.
type Card = {
	shown: boolean;
	pinned: boolean;
	name: string;
	said: string;
	past: string[];
	open: boolean;
	cross: boolean;
	kept: boolean;
	inert: boolean;
	focused: string;
};
const cardOf = (page: Page): Promise<Card> =>
	page.evaluate(() => {
		// The town has its card from its opening.
		const card = document.querySelector<HTMLElement>("#town .world-card")!;
		const text = (selector: string): string => card.querySelector(`.world-card-body > :not(.world-card-ghost) ${selector}`)?.textContent?.trim() ?? "";
		const open = card.querySelector<HTMLElement>("button.world-card-open");
		const focus = document.activeElement;
		return {
			shown: card.classList.contains("shown"),
			pinned: card.classList.contains("world-pinned"),
			name: text(".world-card-head strong"),
			said: text(".world-card-say"),
			past: [...card.querySelectorAll(".world-card-past li span")].map((line) => line.textContent ?? ""),
			open: !!open,
			cross: !!card.querySelector("button.world-card-close"),
			kept: open?.dataset["kept"] === "1",
			inert: card.inert,
			focused: focus && card.contains(focus) ? focus.className : "",
		};
	});

// The town's time goes on by `ms`, in two drawings: the town reads who is under the pointer at one drawing, and shows
// its card at a later one.
async function pass(page: Page, ms: number): Promise<void> {
	await page.clock.fastForward(100);
	await page.clock.fastForward(ms);
}

// Where the name of the session `handle` stands in the town, and whether it shows.
const nameOf = (page: Page, handle: string): Promise<{ shown: boolean; carded: boolean; x: number; bottom: number } | null> =>
	page.evaluate((wanted) => {
		const node = document.querySelector<HTMLElement>(`#town .world-name[data-handle="${wanted}"]`);
		if (!node) return null;
		const box = node.getBoundingClientRect();
		return {
			shown: box.width > 0 && !node.classList.contains("world-off"),
			carded: node.classList.contains("world-carded"),
			x: box.x + box.width / 2,
			bottom: box.bottom,
		};
	}, handle);

// Whether the town shows a hand at `x`, `y`: it reads who is under the pointer at each drawing.
async function pointing(page: Page, x: number, y: number): Promise<boolean> {
	await page.mouse.move(x, y);
	await page.clock.fastForward(100);
	return page.evaluate(() => document.querySelector("#town")?.classList.contains("world-pointing") ?? false);
}

// A point of the town near `body` with no inhabitant and no control (a subject's sign, the compass) under it.
async function ground(page: Page, [x, y]: [number, number]): Promise<[number, number]> {
	for (const [aside, down] of [
		[0, 150],
		[160, 60],
		[-160, 60],
		[0, -150],
	] as const) {
		// oxlint-disable-next-line no-await-in-loop
		const free = await page.evaluate(
			([px, py]) => {
				const top = document.elementFromPoint(px, py);
				return !!top?.closest("#town") && !top.closest("button, .world-card");
			},
			[x + aside, y + down] as const,
		);
		// oxlint-disable-next-line no-await-in-loop
		if (free && !(await pointing(page, x + aside, y + down))) return [x + aside, y + down];
	}
	throw new Error("the town has no free ground near the inhabitant");
}

// The pointer leaves the town, long enough for a card to go, then for the next one to wait again: just after a card
// went, the next one comes at once.
async function away(page: Page): Promise<void> {
	await page.mouse.move(720, 20);
	await pass(page, 1000);
	await page.clock.fastForward(500);
}

// The town opened near an inhabitant that waits, its clock held, the pointer away: the session's handle and name, and
// where its body is on the screen.
async function nearby(page: Page): Promise<{ handle: string; title: string; body: [number, number] }> {
	await page.addInitScript(() => {
		localStorage.setItem("sonar:view", "map");
		// The town gives its opening up after a minute (src/toggle.ts): beside another page file it takes longer in the
		// test's browser, and the town left under the test (no card in the page, 25/11).
		localStorage.setItem("sonar:town-limit", "300000");
	});
	await lightTown(page);
	await page.goto(`${bench.base}/?projet=alpha`);
	// An agent that waits stands still: the pointer finds it where it was read.
	const waiting = page.locator("#viewport .agent-card.wait[data-handle]").first();
	await waiting.waitFor({ timeout: 30_000 });
	const handle = (await waiting.getAttribute("data-handle"))!;
	const title = ((await waiting.locator(".head .name").textContent()) ?? "").trim();
	await page.locator(".zoom .town-toggle").click();
	await page.locator("#town .world-layer.shown").waitFor({ state: "attached", timeout: 300_000 });
	await page.locator(`#town .world-name[data-handle="${handle}"]`).waitFor({ state: "attached", timeout: 30_000 });
	await held(page);

	// Towards the inhabitant, as near as the town goes (see ./world-layers.page.ts).
	const far = await nameOf(page, handle);
	assert.ok(far, `the town has the name of "${title}"`);
	await page.mouse.move(far.x, far.bottom + 20);
	for (let notch = 0; notch < 14; notch++) {
		// oxlint-disable-next-line no-await-in-loop
		await page.mouse.wheel(0, -200);
		// oxlint-disable-next-line no-await-in-loop
		await page.clock.fastForward(100);
	}
	// oxlint-disable-next-line no-await-in-loop
	for (let drawing = 0; drawing < 20; drawing++) await page.clock.fastForward(100);
	await away(page);
	assert.equal((await cardOf(page)).shown, false, "no card while the pointer is on nobody");
	const name = await nameOf(page, handle);
	assert.ok(name?.shown, `the name of "${title}" shows at the nearest level`);

	// The inhabitant stands under its name: the town says so by the pointer it shows there.
	let body: [number, number] | null = null;
	for (let under = 24; under <= 130 && !body; under += 6) {
		// oxlint-disable-next-line no-await-in-loop
		if (await pointing(page, name.x, name.bottom + under)) body = [name.x, name.bottom + under + 6];
	}
	assert.ok(body, `the town shows a hand over the inhabitant "${title}"`);
	await away(page);
	return { handle, title, body };
}

// The notebook's layout and controls hold in each theme, and it is seen on the town.
async function finished(page: Page): Promise<void> {
	await animationsEnded(page);
	for (const theme of ["light", "dark"] as const) {
		// oxlint-disable-next-line no-await-in-loop
		await page.emulateMedia({ colorScheme: theme });
		// oxlint-disable-next-line no-await-in-loop
		assert.deepEqual(await drawnOver(page, "#town .world-card"), [], `the notebook's layout (${theme})`);
		// oxlint-disable-next-line no-await-in-loop
		assert.deepEqual(await outOfReach(page, { within: "#town .world-card" }), [], `the notebook's controls (${theme})`);
		// oxlint-disable-next-line no-await-in-loop
		const blended = (await blendedCards(page)).filter((found) => found.includes("world-card"));
		assert.deepEqual(blended, [], `the notebook is seen on the town (${theme})`);
	}
	await page.emulateMedia({ colorScheme: "light" });
}

// The session of a pinned notebook changes, as often as an agent takes another tool: the notebook says so, and its
// button and its cross stay the nodes they are. Made again, they lost a press under way and the keyboard's place.
async function renewed(page: Page, say: (message: object) => void, agent: Told): Promise<void> {
	await page.evaluate(() => {
		document.querySelector<HTMLElement>("#town .world-card-open")!.dataset["kept"] = "1";
		document.querySelector<HTMLElement>("#town .world-card-close")!.focus();
	});
	const next = {
		...agent,
		decision: { ...agent.decision, action: "Do I ship it now?" },
		happened: [...PAST, { at: Date.UTC(2026, 0, 5, 10, 12), kind: "ended", text: "The tests pass." }],
	};
	say({ type: "fleet-changes", changed: [next], removed: [], order: null });
	await pass(page, 500);
	const card = await cardOf(page);
	assert.deepEqual(
		[card.pinned, card.said, card.past.length],
		[true, "Do I ship it now?", 3],
		`the notebook says what its session became (${JSON.stringify(card)})`,
	);
	assert.match(card.past[0] ?? "", /The tests pass\./, "what just happened comes first");
	assert.equal(card.kept, true, "its button is the same one");
	assert.match(card.focused, /world-card-close/, "the keyboard stays on its cross");
}

// A notebook closes by Escape, by its cross and by a click elsewhere on the town; closed, the keyboard no longer
// finds its button.
async function closes(page: Page, body: [number, number]): Promise<void> {
	await page.keyboard.press("Escape");
	await pass(page, 500);
	const closed = await cardOf(page);
	assert.deepEqual(
		[closed.shown, closed.inert, closed.focused],
		[false, true, ""],
		`Escape closes the notebook, and the keyboard leaves it (${JSON.stringify(closed)})`,
	);
	assert.equal(await page.locator("#town .world-layer.shown").count(), 1, "the town stays");
	await page.mouse.click(...body);
	await pass(page, 100);
	await page.locator("#town .world-card-close").click();
	await away(page);
	assert.equal((await cardOf(page)).shown, false, "the cross closes the notebook");
	const free = await ground(page, body);
	await page.mouse.click(...body);
	await pass(page, 100);
	assert.equal((await cardOf(page)).pinned, true, "pinned again");
	await page.mouse.click(...free);
	await pass(page, 500);
	assert.equal((await cardOf(page)).shown, false, "a click elsewhere on the town closes the notebook");
	await away(page);
}

// With reduced motion, the notebook is in place at once: nothing of it moves, grows or glides.
async function still(page: Page, body: [number, number]): Promise<void> {
	await page.emulateMedia({ colorScheme: "light", reducedMotion: "reduce" });
	await page.waitForFunction(() => document.documentElement.dataset["motion"] === "reduced", undefined, { polling: 100, timeout: 30_000 });
	await page.mouse.click(...body);
	await pass(page, 100);
	const moving = await page.evaluate(() =>
		(document.querySelector("#town .world-card")?.getAnimations({ subtree: true }) ?? [])
			.flatMap((animation) => (animation.effect instanceof KeyframeEffect ? animation.effect.getKeyframes().flatMap((frame) => Object.keys(frame)) : []))
			.filter((property) => ["height", "transform", "scale", "translate"].includes(property)),
	);
	assert.deepEqual(moving, [], "with reduced motion, the notebook neither grows nor moves");
	assert.equal((await cardOf(page)).pinned, true, "the notebook is pinned at once");
}

test("computer: a card comes while the pointer rests on an inhabitant, a click pins its notebook, and its button opens the session", async () => {
	// Each session as the page was first told it, with its past.
	const first = new Map<string, Told>();
	const { page, errors, say } = await told(
		browser,
		DESKTOP,
		(agent) => {
			const next = agent.decision ? { ...agent, happened: PAST } : agent;
			if (agent.handle && agent.name && !first.has(agent.handle)) first.set(agent.handle, next);
			return next;
		},
		"light",
	);
	const { handle, title, body } = await nearby(page);

	// The pointer has just come: no card yet. Once it has rested there, its card, which says what the session asks.
	await page.mouse.move(...body);
	await page.clock.fastForward(100);
	await page.clock.fastForward(100);
	assert.equal((await cardOf(page)).shown, false, "no card before the pointer has rested on the inhabitant");
	await pass(page, 500);
	const hovered = await cardOf(page);
	assert.deepEqual([hovered.shown, hovered.pinned, hovered.name], [true, false, title], `its card shows (${JSON.stringify(hovered)})`);
	assert.ok(hovered.said, "the card says what the session asks");
	assert.deepEqual([hovered.open, hovered.cross, hovered.past], [false, false, []], "a card has no notebook: nothing to click");
	assert.equal((await nameOf(page, handle))?.carded, true, "the card says its name: the name over its head is hidden");
	await animationsEnded(page);
	assert.deepEqual(await drawnOver(page, "#town .world-card"), []);

	// The pointer leaves: the card goes, and the name is back.
	await away(page);
	assert.equal((await cardOf(page)).shown, false, "the card goes with the pointer");
	assert.equal((await nameOf(page, handle))?.carded, false, "its name is back over its head");

	// A drag over the inhabitant slides the town and pins nothing.
	await page.mouse.move(...body);
	await page.mouse.down();
	await page.mouse.move(body[0] + 40, body[1], { steps: 2 });
	await page.mouse.move(...body, { steps: 2 });
	await page.mouse.up();
	await pass(page, 500);
	assert.equal((await cardOf(page)).pinned, false, "a drag is no click: no notebook");
	await away(page);

	// A click pins its notebook: the three last things that happened, the latest first, and the way to its session. It
	// stays when the pointer leaves.
	await page.mouse.click(...body);
	await pass(page, 100);
	await away(page);
	const pinned = await cardOf(page);
	assert.deepEqual([pinned.shown, pinned.pinned, pinned.name], [true, true, title], `its notebook is pinned (${JSON.stringify(pinned)})`);
	assert.deepEqual(
		[pinned.open, pinned.cross, pinned.past.length],
		[true, true, 3],
		`the notebook has its past, its button and its cross (${JSON.stringify(pinned)})`,
	);
	assert.match(pinned.past[0] ?? "", /The menu opens at a click\./, "the latest first");
	assert.ok(!pinned.past.some((line) => line.includes("398")), "the fourth one back is not shown");
	await finished(page);
	await renewed(page, say, first.get(handle)!);
	await closes(page, body);

	// Pinned with reduced motion, its button opens the session.
	await still(page, body);
	await page.locator("#town .world-card-open").click();
	await page.waitForFunction((wanted) => new URL(location.href).searchParams.get("session") === wanted, handle);

	assert.deepEqual(errors, []);
	await page.close();
});
