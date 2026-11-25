// What Jev costs and how it stops itself: its usage counted by day in its data folder, the month's spending its cap is
// checked against (the tokens TypeSafe gave, this month only), the switch turned off at the cap or at the first refusal
// for lack of credits, and the usage an older Sonar counted, taken once. As Sonar's tests/jev-budget.test.ts and
// tests/judgments.test.ts. The clock is the test's.

import { afterAll, beforeEach, expect, test } from "bun:test";
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { dayOf } from "../src/shared/calendar";
import { JEV_PER_MTOK } from "../src/shared/cost";
import { answering, fakeTypeSafe, neutral, outOfCredits } from "./fake-typesafe";
import { noon, started } from "./support";

const typesafe = fakeTypeSafe();
afterAll(() => typesafe.stop());
beforeEach(() => {
	typesafe.asked.length = 0;
	typesafe.answer = neutral;
});

const folder = () => mkdtempSync(join(tmpdir(), "typesafe-jev-"));
const usd = (tokens: number) => (tokens * JEV_PER_MTOK) / 1e6;
type Report = { days: { day: string; calls: number; tokens: number; usd: number; estimated: boolean }[]; month: { usd: number; monthlyUsd: number | null } };

// This month's tokens cost 4 127 210 × 0.042 / 10⁶ ≈ 0.173 $; last month's, 34 000 000 tokens, 1.43 $.
const NOW = noon(0, 15);
const SPENT = usd(4_127_210);
const COUNTED = {
	[dayOf(noon(-1, 28))]: { calls: 31_281, tokens: 34_000_000, metered: 2_993 },
	[dayOf(NOW)]: { calls: 2_099, tokens: 4_127_210, metered: 1_308 },
};

test("the month's billed tokens only: failed calls and last month stay out of the cap; at the cap, Jev stops before any call", async () => {
	const dataDir = folder();
	writeFileSync(join(dataDir, "usage.json"), JSON.stringify(COUNTED));
	const { bench, judge, clock } = await started(typesafe, { dataDir, now: NOW, settings: { on: true, monthlyUsd: SPENT + 0.005 } });
	// Under the cap with this month's billed tokens: last month's would pass it, and so would the failed calls.
	expect(await judge.isCorrection("a", "b")).toBe(0);
	expect(typesafe.asked).toHaveLength(1);
	await bench.post("/settings", { monthlyUsd: SPENT - 0.005 });
	await expect(judge.judge("A", "Le menu est prêt.")).rejects.toMatchObject({ off: true, message: "Jev reached its monthly cap" });
	expect(typesafe.asked).toHaveLength(1);
	expect(await bench.api.settings.read()).toEqual({ on: false, monthlyUsd: SPENT - 0.005 });
	expect(bench.live).toEqual([{ kind: "cap", usd: SPENT - 0.005 }]);
	expect(bench.log.at(-1)).toBe(`Jev is off: it cost $${SPENT - 0.005} this month, its cap. Turn it on again in its settings, or raise its cap.`);
	// Off now: no second message.
	await expect(judge.judge("A", "Le menu est prêt.")).rejects.toMatchObject({ off: true, message: "Jev is off in its settings" });
	expect(bench.live).toHaveLength(1);
	// The usage page estimates the calls without tokens: more than the cap counts.
	const report = (await bench.get("/usage", { days: "1" })).body as Report;
	expect(report.days[0]).toMatchObject({ day: dayOf(NOW), calls: 2_100, tokens: 4_127_220, estimated: true });
	expect(report.days[0]?.usd).toBeGreaterThan(SPENT);
	expect(report.month.usd).toBeCloseTo(usd(4_127_220), 12);
	// A new month starts from zero: on again, Jev judges.
	clock.now = noon(1, 1);
	await bench.post("/settings", { on: true });
	expect(await judge.isCorrection("a", "b")).toBe(0);
	expect(typesafe.asked).toHaveLength(2);
});

test("without a cap, Jev is never cut for its spending, however much the month cost", async () => {
	const dataDir = folder();
	writeFileSync(join(dataDir, "usage.json"), JSON.stringify(COUNTED));
	const { bench, judge } = await started(typesafe, { dataDir, now: NOW, settings: { on: true, monthlyUsd: null } });
	expect(await judge.isCorrection("a", "b")).toBe(0);
	expect(await judge.judge("A", "Le menu est prêt.")).toMatchObject({ urgency: expect.any(Number) });
	expect(typesafe.asked).toHaveLength(2);
	expect(await bench.api.settings.read()).toEqual({ on: true, monthlyUsd: null });
	expect(bench.live).toEqual([]);
	expect(((await bench.get("/usage", { days: "1" })).body as Report).month).toEqual({ usd: expect.any(Number), monthlyUsd: null });
	// A cap given again cuts Jev at its next call.
	await bench.post("/settings", { monthlyUsd: 0 });
	await expect(judge.isCorrection("a", "b")).rejects.toMatchObject({ off: true, message: "Jev reached its monthly cap" });
});

// On 28/09/2026, TypeSafe out of credits was asked 31 281 times in a day.
test("at the first refusal for lack of credits, Jev stops and says so once; nothing is asked again", async () => {
	const { bench, judge } = await started(typesafe, { language: "fr" });
	typesafe.answer = outOfCredits;
	const both = await Promise.all([judge.isCorrection("a", "b").catch((error: unknown) => error), judge.isCorrection("c", "d").catch((error: unknown) => error)]);
	for (const failure of both) expect(failure).toMatchObject({ off: true });
	expect(typesafe.asked).toHaveLength(2);
	expect(await bench.api.settings.read()).toEqual({ on: false, monthlyUsd: 2 });
	expect(bench.live).toEqual([{ kind: "credits" }]);
	expect(bench.log.filter((line) => line.startsWith("Jev est coupé"))).toEqual(["Jev est coupé : TypeSafe n'a plus de crédits. Rallume-le après la recharge."]);
	await expect(judge.route("montre A", ["A"], null)).rejects.toMatchObject({ off: true });
	expect(typesafe.asked).toHaveLength(2);
	// Both calls were counted, without tokens: TypeSafe billed none.
	expect(((await bench.get("/usage", { days: "1" })).body as Report).days[0]).toMatchObject({ calls: 2, tokens: 0, estimated: true });
});

test("each call counted on its day: its tokens when TypeSafe says them, the others estimated at the average; written on stop", async () => {
	const dataDir = folder();
	const first = await started(typesafe, { dataDir, now: noon(0, 10) });
	await first.judge.isCorrection("a", "b");
	await first.judge.isCorrection("a", "b");
	typesafe.answer = answering(() => ({ correction: { noul: 0.5 } }), null);
	await first.judge.isCorrection("a", "b");
	typesafe.answer = () => new Response("down", { status: 500 });
	await first.judge.isCorrection("a", "b").catch(() => undefined);
	first.clock.now = noon(0, 11);
	typesafe.answer = neutral;
	await first.judge.judge("A", "Fini.");
	const expected = {
		days: [
			{ day: dayOf(noon(0, 10)), calls: 4, tokens: 20, usd: usd(20 + 2 * 10), estimated: true },
			{ day: dayOf(noon(0, 11)), calls: 1, tokens: 10, usd: usd(10), estimated: false },
		],
		// Summed day by day, as it is computed.
		month: { usd: usd(20) + usd(10), monthlyUsd: 2 },
	};
	expect((await first.bench.get("/usage", { days: "2" })).body).toEqual(expected);
	first.stop();
	expect(JSON.parse(readFileSync(join(dataDir, "usage.json"), "utf8"))).toEqual({
		[dayOf(noon(0, 10))]: { calls: 4, tokens: 20, metered: 2 },
		[dayOf(noon(0, 11))]: { calls: 1, tokens: 10, metered: 1 },
	});
	// The next start reads them back.
	const again = await started(typesafe, { dataDir, now: noon(0, 11) });
	expect((await again.bench.get("/usage", { days: "2" })).body).toEqual(expected);
});

test("a usage file missing or unreadable counts zero; a field it cannot read too", async () => {
	const dataDir = folder();
	writeFileSync(join(dataDir, "usage.json"), "{ not json");
	const unreadable = await started(typesafe, { dataDir, now: NOW });
	expect(((await unreadable.bench.get("/usage", { days: "1" })).body as Report).month.usd).toBe(0);
	writeFileSync(join(dataDir, "usage.json"), JSON.stringify({ [dayOf(NOW)]: { calls: "3", tokens: 1000, metered: -1 }, someday: { calls: 1 } }));
	const partly = await started(typesafe, { dataDir, now: NOW });
	expect(((await partly.bench.get("/usage", { days: "1" })).body as Report).days).toEqual([
		{ day: dayOf(NOW), calls: 0, tokens: 1000, usd: usd(1000), estimated: false },
	]);
});

test("the usage an older Sonar counted is added once, so that the month's cap does not start again from zero", async () => {
	const dataDir = folder();
	writeFileSync(join(dataDir, "usage.json"), JSON.stringify({ [dayOf(NOW)]: { calls: 1, tokens: 10, metered: 1 } }));
	writeFileSync(join(dataDir, "former-usage.json"), JSON.stringify(COUNTED));
	const first = await started(typesafe, { dataDir, now: NOW });
	const month = async (bench: typeof first.bench) => ((await bench.get("/usage", { days: "1" })).body as Report).month.usd;
	expect(await month(first.bench)).toBeCloseTo(usd(4_127_220), 12);
	expect(first.bench.log).toContain("Jev added the usage Sonar counted before it, 2 days.");
	expect(existsSync(join(dataDir, "former-usage.json"))).toBe(false);
	expect(existsSync(join(dataDir, "former-usage.taken.json"))).toBe(true);
	first.stop();
	const again = await started(typesafe, { dataDir, now: NOW });
	expect(await month(again.bench)).toBeCloseTo(usd(4_127_220), 12);
	expect(again.bench.log).toEqual([]);
});
