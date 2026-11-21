// Jev on or off, with or without its key: off by its switch or without a key, each judgment rejects with `off: true`
// (Sonar's judge then does without it) and nothing is asked. The end-of-turn check's yes or no keeps the switch, and
// judges with a key another Sonar lent. The key lent to a linked computer. As Sonar's tests/server-jev.test.ts.

import { afterAll, beforeEach, expect, test } from "bun:test";
import type { JudgeProvider } from "@sonar/extension";
import { answering, fakeTypeSafe, neutral } from "./fake-typesafe";
import { started } from "./support";

const typesafe = fakeTypeSafe();
afterAll(() => typesafe.stop());
beforeEach(() => {
	typesafe.asked.length = 0;
	typesafe.answer = neutral;
});

const QUESTION = { instructions: "Did the agent end its work?", criteria: { true: "It did", false: "It did not" } };

// Each of the judge's calls, made one after the other.
const calls = (judge: JudgeProvider): (() => Promise<unknown>)[] => [
	() => judge.judge("A", "Done."),
	() => judge.stillRelevant("yes", "Merge?", "Merged."),
	() => judge.isCorrection("a", "b"),
	() => judge.relatedPairs([[{ name: "A", summary: "x" }, { name: "B", summary: "y" }]]),
	() => judge.chooseTopic({ name: "A", branch: "b", brief: "c", ask: null, summary: "d" }, { T: "t" }),
	() => judge.route("show A", ["A"], null),
	() => judge.yesOrNo("Done.", "ended", QUESTION),
];

test("switched off: every call rejects as off, and TypeSafe is asked nothing; nor is a key lent", async () => {
	const { judge } = await started(typesafe, { settings: { on: false } });
	for (const call of calls(judge)) await expect(call()).rejects.toMatchObject({ off: true, message: "Jev is off in its settings" });
	await expect(judge.yesOrNo("Done.", "ended", QUESTION, "lent-key")).rejects.toMatchObject({ off: true });
	expect(typesafe.asked).toEqual([]);
	expect(await judge.lend?.()).toBeNull();
});

test("without a key: Jev counts as off, nothing asked nor counted; the switch keeps its setting", async () => {
	const { bench, judge } = await started(typesafe, { key: null });
	for (const call of calls(judge)) await expect(call()).rejects.toMatchObject({ off: true, message: "Jev has no TypeSafe key" });
	expect(typesafe.asked).toEqual([]);
	expect(await bench.api.settings.read()).toBeNull();
	expect((await bench.get("/usage", { days: "1" })).body).toMatchObject({ days: [{ calls: 0, tokens: 0 }] });
	expect(await judge.lend?.()).toBeNull();
});

test("the yes or no: one noul question on the message, its probability; 0 when TypeSafe refuses, even for credits", async () => {
	const { bench, judge } = await started(typesafe);
	typesafe.answer = answering(() => ({ ended: { noul: 0.83 } }));
	expect(await judge.yesOrNo("All tests pass.", "ended", QUESTION)).toBe(0.83);
	expect(typesafe.asked[0]).toEqual({
		authorization: "Bearer test-key",
		model: "jev-latest",
		state: { message: "All tests pass." },
		questions: { ended: { type: "noul", ...QUESTION } },
	});
	typesafe.answer = answering(() => ({ other: { noul: 0.9 } }));
	expect(await judge.yesOrNo("All tests pass.", "ended", QUESTION)).toBe(0);
	typesafe.answer = () => new Response("down", { status: 503 });
	expect(await judge.yesOrNo("All tests pass.", "ended", QUESTION)).toBe(0);
	typesafe.answer = () => Response.json({}, { status: 402 });
	expect(await judge.yesOrNo("All tests pass.", "ended", QUESTION)).toBe(0);
	// Neither counted nor capped, and a refusal does not switch Jev off, as in Sonar's plugin.
	expect((await bench.get("/usage", { days: "1" })).body).toMatchObject({ days: [{ calls: 0 }] });
	expect(await bench.api.settings.read()).toBeNull();
});

test("a key another Sonar lent serves the yes or no, with or without a key here", async () => {
	const { judge } = await started(typesafe, { key: null });
	typesafe.answer = answering(() => ({ ended: { noul: 0.6 } }));
	expect(await judge.yesOrNo("Done.", "ended", QUESTION, "lent-key")).toBe(0.6);
	const here = await started(typesafe);
	await here.judge.yesOrNo("Done.", "ended", QUESTION, "lent-key");
	expect(typesafe.asked.map((each) => each.authorization)).toEqual(["Bearer lent-key", "Bearer lent-key"]);
});

test("the key lent to a linked computer: the one here while Jev is on", async () => {
	const { bench, judge } = await started(typesafe, { key: " ts-secret-1234 " });
	expect(await judge.lend?.()).toBe("ts-secret-1234");
	await bench.post("/settings", { on: false });
	expect(await judge.lend?.()).toBeNull();
});

test("the key is lent under TypeSafe's name; a key Sonar would not lend lends nothing", async () => {
	const { judge } = await started(typesafe);
	expect(judge.lentAs).toBe("typesafe");
	for (const key of ["ts secret", "x".repeat(513)]) expect(await (await started(typesafe, { key })).judge.lend?.()).toBeNull();
	expect(await (await started(typesafe, { key: "x".repeat(512) })).judge.lend?.()).toBe("x".repeat(512));
});

test("on again, Jev judges again", async () => {
	const { bench, judge } = await started(typesafe, { settings: { on: false } });
	await expect(judge.isCorrection("a", "b")).rejects.toMatchObject({ off: true });
	await bench.post("/settings", { on: true });
	expect(await judge.isCorrection("a", "b")).toBe(0);
	expect(typesafe.asked).toHaveLength(1);
});
