// The trial of a key, as Sonar asks it while the user types one: the workspace the key opens, a key Linear refuses
// told apart (`refused`), a Linear that cannot be asked, and a Sonar older than the trial.

import { afterAll, beforeEach, expect, test } from "bun:test";
import { isRefused } from "@sonar/extension";
import { fakeServer } from "@sonar/extension/testing";
import { startLinear } from "../src/server";
import { fakeLinear, unauthorized, workspace } from "./fake-linear";
import { card, started } from "./support";

const linear = fakeLinear();
afterAll(() => linear.stop());
beforeEach(() => {
	linear.asked.length = 0;
	linear.answer = workspace;
});

// The trial the extension gave, as the kit calls it: an answer Sonar would refuse fails the test.
async function trial() {
	const { bench } = await started(linear);
	const run = bench.keyTrial("key");
	if (!run) throw new Error("The extension gave no trial for its key.");
	return run;
}

const failureOf = (call: Promise<unknown>): Promise<Error> =>
	call.then(
		() => {
			throw new Error("The trial answered.");
		},
		(error: Error) => error,
	);

test("a key Linear knows: the trial answers its workspace, asked with the key typed, not the one saved", async () => {
	const run = await trial();
	expect(await run("typed-key")).toEqual({ account: "ACME" });
	expect(linear.asked.map((each) => each.authorization)).toEqual(["typed-key"]);
});

test("a key Linear refuses (401, 403): the trial rejects with Linear's message, refused", async () => {
	const run = await trial();
	for (const status of [401, 403]) {
		linear.answer = () => unauthorized(status);
		const error = await failureOf(run("typed-key"));
		expect(error.message).toBe("Authentication required, not authenticated");
		expect(isRefused(error)).toBe(true);
	}
});

test("Linear answers 500, or what cannot be read: the trial rejects, not refused", async () => {
	const run = await trial();
	linear.answer = () => new Response("down", { status: 500 });
	const down = await failureOf(run("typed-key"));
	expect(down.message).toBe("Linear answered 500");
	expect(isRefused(down)).toBe(false);
	linear.answer = () => Response.json({ data: { organization: null } });
	const unreadable = await failureOf(run("typed-key"));
	expect(unreadable.message).toBe("Linear's answer is unreadable");
	expect(isRefused(unreadable)).toBe(false);
});

test("a Sonar older than the trial of a key: the extension starts, and fills the port", async () => {
	const bench = fakeServer({ card });
	await bench.start((api) => startLinear({ ...api, keys: { read: api.keys.read } }, linear.url));
	expect(bench.tickets()).not.toBeNull();
	expect(bench.keyTrial("key")).toBeNull();
});
