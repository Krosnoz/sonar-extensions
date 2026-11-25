// The server entry: Sonar calls start(api) when it starts, with the extension switched on. It fills Sonar's judge with
// Jev (./server/judge.ts), and answers the page under /api/ext/<id>: its settings (GET and POST /settings) and what it cost
// (GET /usage?days=N). It imports nothing of Sonar when it runs: the contract gives types only.

import type { ServerApi } from "@sonar/extension";
import { usageReport } from "./shared/cost";
import { type JevOptions, jevJudge, TYPESAFE_KEY } from "./server/judge";
import { changeSettings, type JevSettings, readSettings } from "./server/settings";
import { TYPESAFE_URL } from "./server/typesafe";
import { usageIn } from "./shared/usage";

const DAYS_MOST = 366;

const daysOf = (query: Readonly<Record<string, string>>): number => {
	const days = Number(query["days"] ?? 30);
	if (!Number.isInteger(days) || days < 1 || days > DAYS_MOST)
		throw Object.assign(new Error(`Name the days: ?days=<1 to ${DAYS_MOST}>.`), { status: 400 });
	return days;
};

// The page sees only the key's end.
async function settingsView(api: ServerApi, settings: JevSettings) {
	const key = (await api.keys.read(TYPESAFE_KEY))?.trim();
	return { on: settings.on, key: key ? `…${key.slice(-4)}` : null, monthlyUsd: settings.monthlyUsd };
}

// `options`: TypeSafe's address and the clock, which the tests give.
export function startJev(api: ServerApi, options: JevOptions) {
	const usage = usageIn(api.dataDir, options.now, api.log);
	api.provide.judge(jevJudge(api, options, usage));
	api.routes.get("/settings", async () => settingsView(api, await readSettings(api)));
	api.routes.post("/settings", async ({ body }) => settingsView(api, await changeSettings(api, body)));
	api.routes.get("/usage", async ({ query }) => usageReport(usage.days(), options.now(), daysOf(query), (await readSettings(api)).monthlyUsd));
	return usage.flush;
}

export function start(api: ServerApi) {
	return startJev(api, { url: TYPESAFE_URL, now: Date.now });
}
