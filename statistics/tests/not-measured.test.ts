// While the user does not want their activity measured (Sonar's setting `metrics` off), the contract gives no
// velocity, no reply delays and no touches: these figures read "not measured" (README, "What differs when activity is
// not measured").

import { expect, test } from "bun:test";
import { bodyOf, startOf, started, usageLine, weekStarting } from "./support";

const NOW = Date.now();

const unmeasured = () =>
	started((each) => {
		// usage.velocity() null, as before Sonar's first computation.
		each.measures.usage.push(
			usageLine({ day: startOf(8), sessionId: "a", folder: "/work/sonar", project: "sonar", cost: 1, messages: 2, lastAt: NOW, repliesMs: null }),
		);
		each.measures.timelines.push({ sessionId: "a", name: null, segments: [{ kind: "work", from: NOW - 2000, to: NOW - 1000 }], touches: null });
	});

test("no reply delays: the wait reads 'not measured' in every week, and no PR, no commit is counted", async () => {
	const body = await bodyOf(unmeasured(), "/global");
	for (const week of [0, 8]) expect(weekStarting(body, week)).toMatchObject({ waitedMs: null, prs: 0, commits: 0, reply: null, parallel: null });
	expect(weekStarting(body, 8)).toMatchObject({ cost: 1, interventions: 2 });
	const sonar = (body["projects"] as { weeks: never[] }[])[0];
	expect(sonar && weekStarting(sonar, 8).waitedMs).toBeNull();
	expect(weekStarting(await bodyOf(unmeasured(), "/project", { project: "sonar" }), 8).waitedMs).toBeNull();
});

test("no touches: a strip has its work, its messages and their count 'not measured'", async () => {
	const [strip] = (await bodyOf(unmeasured(), "/tasks", { project: "sonar" })) as unknown as Record<string, unknown>[];
	expect(strip).toMatchObject({ session: "a", agentMs: 1000, interventions: null, touches: null });
});
