// A session of a subject the town has no building for, told while the town is open, builds its building on the block
// the town holds for it (src/plot.ts): its sign joins the page once the building is built, then its
// inhabitant is born. With motion reduced, the building is there at once. A session not filed yet takes no block: the
// subject it is then filed under does. A second new subject waits for the town's next opening. Before, a new subject showed at the town's next opening only. What each step draws, piece by piece,
// is src/plot.test.ts's.

import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import type { Browser, Page } from "playwright-core";
import { type Bench, DESKTOP, startBenchAndBrowser } from "../sonar/tests/page/support/bench.ts";
import { UNFILED } from "../sonar/tests/page/support/map-levels-fleet.ts";
import { told, type Told } from "../sonar/tests/page/support/told.ts";
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

// The subjects whose sign is in the page, and how many agents the town shows (src/sign-again.ts).
type Shown = { signs: string[]; agents: number };
const shownOf = (page: Page): Promise<Shown> =>
	page.evaluate(() => ({
		signs: [...document.querySelectorAll<HTMLElement>("#town .world-sign")].map((sign) => sign.title),
		agents: Number(document.querySelector<HTMLElement>("#town .world-layer")?.dataset["agents"] ?? -1),
	}));

// The clock goes on, a drawing at a time, until the town shows what `done` asks, `most` seconds at most.
async function until(page: Page, done: (shown: Shown) => boolean, most: number): Promise<Shown> {
	let shown = await shownOf(page);
	for (let half = 0; half < most * 2 && !done(shown); half++) {
		// oxlint-disable-next-line no-await-in-loop
		await pass(page, 0.5);
		// oxlint-disable-next-line no-await-in-loop
		shown = await shownOf(page);
	}
	return shown;
}

// The town of project alpha, its clock held. `come`: a session opens on the subject `topic`, as the server says it.
async function townOf() {
	const order: string[] = [];
	let model: Told | null = null;
	const { page, errors, say } = await told(
		browser,
		DESKTOP,
		(agent) => {
			// A whole agent, not a patch of one: the model of the session that opens.
			if (agent.handle && agent.name) {
				model ??= agent;
				if (!order.includes(agent.handle)) order.push(agent.handle);
			}
			return agent;
		},
		"light",
	);
	// Opened with motion reduced: the camera is on the town at once, without its way there.
	await page.emulateMedia({ colorScheme: "light", reducedMotion: "reduce" });
	await openedTown(page, bench);
	// `handle`: a session already told, which the page now files under `topic`.
	const come = (topic: string, handle = `s-new-${order.length}`): string => {
		if (!order.includes(handle)) order.push(handle);
		say({
			type: "fleet-changes",
			changed: [{ ...model, handle, id: handle, name: `Site of ${topic}`, topic, state: "work", prs: [], children: [], decision: null }],
			removed: [],
			order,
		});
		return handle;
	};
	// What the fleet said while the town came is there at once at its next telling (src/toggle.ts):
	// told once here, as it is, so that the test's own telling is played.
	say({ type: "fleet-changes", changed: [], removed: [], order: null });
	await pass(page, 1);
	return { page, errors, come, first: await shownOf(page) };
}

test("computer: a session of a new subject told under the open town builds its building, then its sign and its inhabitant show; with motion reduced, at once", async () => {
	// Both towns open at once: an opening is most of the test's time.
	const [town, reduced] = await Promise.all([townOf(), townOf()]);
	assert.equal(town.first.signs.length, 1, `the bench's town has one subject, and the block it holds has no sign (${JSON.stringify(town.first)})`);

	// A new session is unfiled at first, as the server says every one. The bench's town has the building of the unfiled
	// sessions: the session joins it, and the block stays held for the subject the session gets.
	const opened = reduced.come(UNFILED);
	const unfiled = await until(reduced.page, (shown) => shown.agents === reduced.first.agents + 1, 4);
	assert.deepEqual(unfiled, { signs: reduced.first.signs, agents: reduced.first.agents + 1 }, "a session not filed yet joins the unfiled sessions' building");
	// Filed under a new subject. With motion reduced, the building is there at once: its sign, then its inhabitant,
	// within the town's next tellings.
	reduced.come("Merge log", opened);
	const quick = await until(reduced.page, (shown) => shown.signs.includes("Merge log") && shown.agents === reduced.first.agents + 1, 4);
	assert.deepEqual(
		[quick.signs.includes("Merge log"), quick.agents],
		[true, reduced.first.agents + 1],
		`with motion reduced, the subject is there at once (${JSON.stringify(quick)})`,
	);
	// The town holds one block: a second new subject waits for its next opening.
	reduced.come("Search");
	await pass(reduced.page, 4);
	const second = await shownOf(reduced.page);
	assert.deepEqual([second.signs.length, second.agents], [2, quick.agents], `a second new subject waits for the next opening (${JSON.stringify(second)})`);
	assert.deepEqual(reduced.errors, []);
	await reduced.page.close();

	await town.page.emulateMedia({ colorScheme: "light", reducedMotion: "no-preference" });
	// The page hears the system's setting change a moment later (Sonar's apps/web/src/appearance/preference.ts): a session told
	// before would be there at once, as with motion reduced.
	await town.page.waitForFunction(() => document.documentElement.dataset["motion"] !== "reduced", undefined, { polling: 100, timeout: 30_000 });
	town.come("Merge log");
	// What stood on the block leaves and the building goes up first: no sign, no inhabitant yet.
	await pass(town.page, 3);
	const early = await shownOf(town.page);
	assert.deepEqual(early, town.first, `the sign waits for the building (${JSON.stringify([town.first, early])})`);
	const built = await until(town.page, (shown) => shown.signs.includes("Merge log"), 20);
	assert.ok(built.signs.includes("Merge log"), `the sign joins the page once the building is built (${JSON.stringify(built)})`);
	const born = await until(town.page, (shown) => shown.agents === town.first.agents + 1, 20);
	assert.equal(born.agents, town.first.agents + 1, `its inhabitant is born once the building is built (${JSON.stringify(born)})`);
	assert.deepEqual(town.errors, []);
	await town.page.close();
});
