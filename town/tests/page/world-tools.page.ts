// An inhabitant at work holds what its agent's last tool does (src/page/people/tools.ts): a book while it reads, a
// hammer while it writes, a console while it runs a command, its crate with any other tool. The tool is the one the
// server says of its session, and what it does is what the agent's catalog says. Before, every inhabitant at work
// carried a crate. What each change draws, size by size, is src/page/people/live.test.ts's.

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

// How many agents the town shows, and how many of those at work hold a crate, a book, a hammer and a console
// (src/page/signs/sign-again.ts).
type Shown = { agents: number; held: number[] };
const shownOf = (page: Page): Promise<Shown> =>
	page.evaluate(() => {
		const said = document.querySelector<HTMLElement>("#town .world-layer")?.dataset;
		return { agents: Number(said?.["agents"] ?? -1), held: (said?.["held"] ?? "").split(" ").map(Number) };
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

test("computer: one at work holds what its agent's last tool does, and takes the next thing when the tool changes", async () => {
	const order: string[] = [];
	let model: Told | null = null;
	const { page, errors, say } = await told(
		browser,
		DESKTOP,
		(agent) => {
			// A whole agent, not a patch of one: the model of the sessions that open.
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
	await page.emulateMedia({ colorScheme: "light", reducedMotion: "no-preference" });
	await page.waitForFunction(() => document.documentElement.dataset["motion"] !== "reduced", undefined, { polling: 100, timeout: 30_000 });
	// Sessions at work on the town's subject, each with its last tool, as the server says them. `gone`: those closed.
	const tell = (tools: Record<string, string | null>, gone: string[] = []): void => {
		for (const handle of Object.keys(tools)) if (!order.includes(handle)) order.push(handle);
		for (const handle of gone) order.splice(order.indexOf(handle), 1);
		const changed: object[] = [];
		for (const [handle, tool] of Object.entries(tools))
			changed.push({ ...model, handle, id: handle, name: `At work ${handle}`, busy: true, tool, prs: [], children: [], decision: null });
		say({ type: "fleet-changes", changed, removed: gone, order });
	};
	// What the fleet said while the town came is there at once at its next telling (src/page/sonar/toggle.ts):
	// told once here, as it is, so that the test's own telling is played.
	say({ type: "fleet-changes", changed: [], removed: [], order: null });
	await pass(page, 1);
	const first = await shownOf(page);
	const more = (shown: Shown): number[] => shown.held.map((count, at) => count - (first.held[at] ?? 0));

	// A session opens at work, writing: its inhabitant is born with a hammer.
	tell({ "s-tool-0": "Edit" });
	const writes = await until(page, first.agents + 1);
	assert.deepEqual([writes.agents - first.agents, more(writes)], [1, [0, 0, 1, 0]], `one that writes holds a hammer (${JSON.stringify([first, writes])})`);

	// Its birth ends: a figure takes no other step meanwhile (src/page/people/live-steps.ts).
	await pass(page, 4);
	// It runs a command now. The town says its people again when one comes: another session opens, searching the web.
	tell({ "s-tool-0": "Bash", "s-tool-1": "WebSearch" });
	const runs = await until(page, first.agents + 2);
	assert.deepEqual(
		[runs.agents - first.agents, more(runs)],
		[2, [0, 1, 0, 1]],
		`a console took the hammer's place, and one that searches holds a book (${JSON.stringify(runs)})`,
	);

	// A tool that neither reads, writes nor runs a command: its crate, as before.
	tell({ "s-tool-0": "Agent" }, ["s-tool-1"]);
	const other = await until(page, first.agents + 1);
	assert.deepEqual([other.agents - first.agents, more(other)], [1, [1, 0, 0, 0]], `with any other tool, its crate (${JSON.stringify(other)})`);

	assert.deepEqual(errors, []);
	await page.close();
});
