// What the tests share: the extension started on the contract's kit, the weeks' dates, and lines of what Sonar measures.

import { readFileSync } from "node:fs";
import type { UsageLine } from "@sonar/extension";
import { type Bench, fakeServer } from "@sonar/extension/testing";
import { dayOf } from "../src/server/calendar";
import { start } from "../src/server";

export const card = JSON.parse(readFileSync(new URL("../extension.json", import.meta.url), "utf8"));

// A new bench, posed by `pose` before the extension starts: each test reads its own first computation.
export function started(pose: (bench: Bench) => void = () => {}): Bench {
	const bench = fakeServer({ card });
	pose(bench);
	start(bench.api);
	return bench;
}

// Noon of a day, local time: `week` 8 is this week and 0 the earliest of the nine, `day` counts from its Monday.
const monday = new Date();
monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
export const at = (week: number, day: number, hours = 12) =>
	new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + (week - 8) * 7 + day, hours).getTime();
export const startOf = (week: number) => dayOf(at(week, 0));

export const usageLine = (fields: Partial<UsageLine> & Pick<UsageLine, "day" | "sessionId">): UsageLine => ({
	folder: null,
	project: null,
	cost: 0,
	messages: 0,
	activeMs: 0,
	lastAt: 0,
	ends: 0,
	sentBack: 0,
	repliesMs: [],
	...fields,
});

type Body = { readonly [key: string]: unknown };
export const bodyOf = async (bench: Bench, path: string, query?: Record<string, string>): Promise<Body> => {
	const { status, body } = await bench.get(path, query);
	if (status !== 200) throw new Error(`${path} answered ${status}: ${JSON.stringify(body)}`);
	return body as Body;
};

export type Week = { readonly start: string } & { readonly [key: string]: number | string | null };
export const weekStarting = (body: Body, week: number): Week => {
	const found = (body["weeks"] as Week[]).find((each) => each.start === startOf(week));
	if (!found) throw new Error(`no week starts on ${startOf(week)}`);
	return found;
};
