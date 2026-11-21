// The routes the page calls under /api/ext/typesafe-jev: Jev's settings (the switch, the key's end, the monthly cap) and
// what it cost by day. A change the extension cannot read is refused with a 400.

import { afterAll, expect, test } from "bun:test";
import type { Json } from "@sonar/extension";
import { fakeServer } from "@sonar/extension/testing";
import { start } from "../src/server";
import { fakeTypeSafe } from "./fake-typesafe";
import { card, started } from "./support";

const typesafe = fakeTypeSafe();
afterAll(() => typesafe.stop());

test("on by default, $2 a month; only the key's end comes back, none without a key", async () => {
	expect((await (await started(typesafe)).bench.get("/settings")).body).toEqual({ on: true, key: "…-key", monthlyUsd: 2 });
	expect((await (await started(typesafe, { key: "ts-new-secret-1234" })).bench.get("/settings")).body).toEqual({ on: true, key: "…1234", monthlyUsd: 2 });
	expect((await (await started(typesafe, { key: null })).bench.get("/settings")).body).toEqual({ on: true, key: null, monthlyUsd: 2 });
});

test("a change keeps what it does not name; a setting saved by hand that cannot be read takes its default", async () => {
	const { bench } = await started(typesafe, { settings: { on: "maybe", monthlyUsd: -3 } });
	expect((await bench.get("/settings")).body).toEqual({ on: true, key: "…-key", monthlyUsd: 2 });
	expect((await bench.post("/settings", { monthlyUsd: 5 })).body).toEqual({ on: true, key: "…-key", monthlyUsd: 5 });
	expect((await bench.post("/settings", { on: false })).body).toEqual({ on: false, key: "…-key", monthlyUsd: 5 });
	expect(await bench.api.settings.read()).toEqual({ on: false, monthlyUsd: 5 });
	expect((await bench.post("/settings", {})).body).toEqual({ on: false, key: "…-key", monthlyUsd: 5 });
});

test("a change it cannot read is refused with a 400, and changes nothing", async () => {
	const { bench } = await started(typesafe);
	const refused: Json[] = [null, [], { on: "yes" }, { monthlyUsd: -1 }, { monthlyUsd: "2" }];
	for (const body of refused)
		expect(await bench.post("/settings", body)).toEqual({ status: 400, body: { error: "Send { on?: boolean, monthlyUsd?: a number from 0 }." } });
	expect(await bench.api.settings.read()).toBeNull();
});

test("the usage: the last days, today last, 30 by default; days it cannot read refused with a 400", async () => {
	const { bench } = await started(typesafe);
	const { status, body } = await bench.get("/usage");
	expect(status).toBe(200);
	const report = body as { days: unknown[]; month: unknown };
	expect(report.days).toHaveLength(30);
	expect(report.days[0]).toEqual({ day: expect.any(String), calls: 0, tokens: 0, usd: 0, estimated: false });
	expect(report.month).toEqual({ usd: 0, monthlyUsd: 2 });
	for (const days of ["0", "367", "2.5", "many"])
		expect(await bench.get("/usage", { days })).toEqual({ status: 400, body: { error: "Name the days: ?days=<1 to 366>." } });
});

test("the entry Sonar runs fills the judge during its start, and returns what writes its usage when the server stops", async () => {
	const bench = fakeServer({ card });
	const stop = await bench.start(start);
	expect(typeof bench.judge()?.judge).toBe("function");
	expect(typeof stop).toBe("function");
	// Once its start ended, the port is filled no more.
	expect(() => start(bench.api)).toThrow();
});
