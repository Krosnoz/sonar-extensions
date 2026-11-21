// What the tests share: the extension started on the contract's kit, against a fake TypeSafe, with a clock they set.

import { readFileSync } from "node:fs";
import type { Json, JudgeProvider } from "@sonar/extension";
import { type Bench, fakeServer } from "@sonar/extension/testing";
import { startJev } from "../src/server";
import type { FakeTypeSafe } from "./fake-typesafe";

export const card = JSON.parse(readFileSync(new URL("../extension.json", import.meta.url), "utf8"));

export type Pose = {
	// TypeSafe's key; null: none given.
	readonly key?: string | null;
	readonly settings?: Json;
	readonly dataDir?: string;
	readonly now?: number;
	readonly language?: "en" | "fr";
};

export type Started = { readonly bench: Bench; readonly judge: JudgeProvider; readonly clock: { now: number }; readonly stop: () => void };

// A new bench, its key "test-key" unless `pose` says otherwise, the user named "alex".
export async function started(typesafe: FakeTypeSafe, pose: Pose = {}): Promise<Started> {
	const bench = fakeServer({
		card,
		userName: "alex",
		...(pose.settings === undefined ? {} : { settings: pose.settings }),
		...(pose.dataDir === undefined ? {} : { dataDir: pose.dataDir }),
		...(pose.language === undefined ? {} : { language: pose.language }),
	});
	if (pose.key !== null) bench.setKey("typesafe", pose.key ?? "test-key");
	const clock = { now: pose.now ?? Date.now() };
	const stop = await bench.start((api) => startJev(api, { url: typesafe.url, now: () => clock.now }));
	const judge = bench.judge();
	if (!judge || !stop) throw new Error("The extension filled no judge, or returned no stop.");
	return { bench, judge, clock, stop };
}

// Noon of a day of the month `month` months from now's, local time.
export const noon = (month: number, day: number) => {
	const now = new Date();
	return new Date(now.getFullYear(), now.getMonth() + month, day, 12).getTime();
};
