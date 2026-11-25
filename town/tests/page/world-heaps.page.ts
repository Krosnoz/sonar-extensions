// From four agents that wait for the user on a subject's place, their bubbles are one large bubble that says how many
// (src/page/people/heaps.ts); under four, each one keeps its own. Before, twelve bubbles stood in a heap, each over
// the faces of the row behind. What each change draws, bubble by bubble, is src/page/people/heaps.test.ts's.

import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import type { Browser, Page } from "playwright-core";
import { type Bench, DESKTOP, startBenchAndBrowser } from "../sonar/tests/page/support/bench.ts";
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

// How many agents the town shows, and how many wait in each large bubble (src/page/signs/sign-again.ts).
type Shown = { agents: number; heaps: number[] };
const shownOf = (page: Page): Promise<Shown> =>
	page.evaluate(() => {
		const said = document.querySelector<HTMLElement>("#town .world-layer")?.dataset;
		return { agents: Number(said?.["agents"] ?? -1), heaps: (said?.["heaps"] ?? "").split(" ").filter(Boolean).map(Number) };
	});

// The clock goes on, a drawing at a time, until the town shows `agents` agents, 6 seconds at most.
async function until(page: Page, agents: number): Promise<Shown> {
	let shown = await shownOf(page);
	for (let half = 0; half < 12 && shown.agents !== agents; half++) {
		// oxlint-disable-next-line no-await-in-loop
		await pass(page, 0.5);
		// oxlint-disable-next-line no-await-in-loop
		shown = await shownOf(page);
	}
	return shown;
}

test("computer: the bubbles of four agents that wait on a subject become one large bubble with their count, and three take theirs back", async () => {
	const order: string[] = [];
	// A session of the bench that waits for the user: the model of those that open.
	let model: Told | null = null;
	const { page, errors, say } = await told(
		browser,
		DESKTOP,
		(agent) => {
			if (agent.handle && agent.name) {
				if (agent.decision) model ??= agent;
				if (!order.includes(agent.handle)) order.push(agent.handle);
			}
			return agent;
		},
		"light",
	);
	// Opened with motion reduced: the camera is on the town at once, without its way there.
	await page.emulateMedia({ colorScheme: "light", reducedMotion: "reduce" });
	await openedTown(page, bench);
	await page.emulateMedia({ colorScheme: "light", reducedMotion: "no-preference" });
	await page.waitForFunction(() => document.documentElement.dataset["motion"] !== "reduced", undefined, { polling: 100, timeout: 30_000 });
	assert.ok(model, "the bench has a session that waits for the user");
	// One more session waits on the model's subject, or the last one opened closes, as the server says it.
	const opened: string[] = [];
	const opens = (): void => {
		const handle = `s-waits-${opened.length}`;
		opened.push(handle);
		order.push(handle);
		say({ type: "fleet-changes", changed: [{ ...model, handle, id: handle, name: `Waits ${opened.length}`, prs: [], children: [] }], removed: [], order });
	};
	const closes = (): void => {
		const handle = opened.pop()!;
		order.splice(order.indexOf(handle), 1);
		say({ type: "fleet-changes", changed: [], removed: [handle], order });
	};
	// What the fleet said while the town came is there at once at its next telling (src/page/sonar/toggle.ts):
	// told once here, as it is, so that the test's own telling is played.
	say({ type: "fleet-changes", changed: [], removed: [], order: null });
	await pass(page, 1);
	const first = await shownOf(page);
	assert.deepEqual(first.heaps, [], `the bench's own sessions wait under four a subject (${JSON.stringify(first)})`);

	// Sessions open one by one, each born before the next: the large bubble comes with the fourth that waits there, the
	// bench's own included, and says four.
	const seen: number[][] = [];
	for (let more = 1; more <= 4 && !seen.at(-1)?.length; more++) {
		opens();
		// oxlint-disable-next-line no-await-in-loop
		const shown = await until(page, first.agents + more);
		assert.equal(shown.agents, first.agents + more, `the session ${more} has its inhabitant (${JSON.stringify(shown)})`);
		seen.push(shown.heaps);
		// Its birth ends: a figure takes no other step meanwhile (src/page/people/live-steps.ts).
		// oxlint-disable-next-line no-await-in-loop
		await pass(page, 4);
	}
	assert.deepEqual(seen.at(-1), [4], `the large bubble comes with the fourth that waits, and says 4 (${JSON.stringify(seen)})`);
	assert.ok(
		seen.slice(0, -1).every((heaps) => heaps.length === 0),
		`under four, no large bubble (${JSON.stringify(seen)})`,
	);

	// A fifth: the same bubble says five.
	opens();
	const five = await until(page, first.agents + opened.length);
	assert.deepEqual(five.heaps, [5], `one more waits in it (${JSON.stringify(five)})`);
	await pass(page, 4);

	// The user answers two of them, one after the other: three wait, each with its own bubble again.
	closes();
	const four = await until(page, first.agents + opened.length);
	assert.deepEqual(four.heaps, [4], `one less waits in it (${JSON.stringify(four)})`);
	closes();
	const three = await until(page, first.agents + opened.length);
	assert.deepEqual(three.heaps, [], `under four, each one has its bubble again (${JSON.stringify(three)})`);

	assert.deepEqual(errors, []);
	await page.close();
});
