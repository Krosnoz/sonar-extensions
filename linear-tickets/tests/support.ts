// What the tests share: the extension started on the contract's kit, against a fake Linear, with a key for the
// project "acme" alone.

import { readFileSync } from "node:fs";
import { fakeServer } from "@sonar/extension/testing";
import { startLinear } from "../src/server";
import type { FakeLinear } from "./fake-linear";

export const card = JSON.parse(readFileSync(new URL("../extension.json", import.meta.url), "utf8"));

// A new bench and the tracker it filled. `tickets` is the kit's, called as Sonar calls it: an answer Sonar would refuse
// fails the test.
export async function started(linear: FakeLinear) {
	const bench = fakeServer({ card });
	bench.setKey("key", "example-key", "acme");
	await bench.start((api) => startLinear(api, linear.url));
	const tickets = bench.tickets();
	if (!tickets) throw new Error("The extension filled no tickets provider.");
	return { bench, tickets };
}
