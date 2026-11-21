// What Jev cost, counted by the extension day by day in its data folder (usage.json): the calls, the input tokens
// TypeSafe billed, and the calls whose tokens it said. Kept in memory, written a few seconds after the last count, and
// when the server stops. A file Sonar wrote when Jev moved from its plugin to this extension (former-usage.json, the
// same form) is added once to the count, so that the month's cap does not start again from zero.

import { readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { dayOf } from "./calendar";

export type DayCount = { calls: number; tokens: number; metered: number };
export type Days = Record<string, DayCount>;

export const USAGE_FILE = "usage.json";
export const FORMER_FILE = "former-usage.json";
// Once added, the former file is renamed so: never added twice.
export const FORMER_TAKEN = "former-usage.taken.json";
const WRITE_AFTER_MS = 5_000;

const count = (value: unknown): number => (typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : 0);

// A file missing or unreadable is zero; a day or a field that cannot be read too.
export function readDays(file: string): Days {
	let saved: unknown;
	try {
		saved = JSON.parse(readFileSync(file, "utf8"));
	} catch {
		return {};
	}
	if (typeof saved !== "object" || saved === null || Array.isArray(saved)) return {};
	const days: Days = {};
	for (const [day, value] of Object.entries(saved)) {
		if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || typeof value !== "object" || value === null) continue;
		const fields = value as { readonly [key: string]: unknown };
		days[day] = { calls: count(fields["calls"]), tokens: count(fields["tokens"]), metered: count(fields["metered"]) };
	}
	return days;
}

// Written beside, then renamed: a reader never sees half a file.
function writeAtomic(file: string, days: Days): void {
	const beside = `${file}.${process.pid}.tmp`;
	writeFileSync(beside, JSON.stringify(days));
	renameSync(beside, file);
}

export type Usage = {
	readonly days: () => Readonly<Days>;
	readonly call: () => void;
	// A call's billed tokens, as TypeSafe gives them (nothing when it did not say).
	readonly tokens: (count: number | undefined) => void;
	readonly flush: () => void;
};

export function usageIn(dataDir: string, now: () => number, log: (message: string) => void): Usage {
	const file = join(dataDir, USAGE_FILE);
	const days = readDays(file);
	let timer: ReturnType<typeof setTimeout> | null = null;

	const flush = () => {
		if (timer) clearTimeout(timer);
		timer = null;
		try {
			writeAtomic(file, days);
		} catch (error) {
			log(`Jev could not write its usage: ${error instanceof Error ? error.message : String(error)}`);
		}
	};
	const add = (day: string, field: keyof DayCount, amount: number) => {
		const counted = (days[day] ??= { calls: 0, tokens: 0, metered: 0 });
		counted[field] += amount;
	};
	const counted = (field: keyof DayCount, amount: number) => {
		add(dayOf(now()), field, amount);
		timer ??= setTimeout(flush, WRITE_AFTER_MS);
		// The server stops without waiting for it: it is written then by `flush`.
		timer.unref?.();
	};

	// Written first, renamed after: a stop between both counts the former days twice, which cuts Jev earlier, never later.
	const former = readDays(join(dataDir, FORMER_FILE));
	if (Object.keys(former).length) {
		for (const [day, each] of Object.entries(former)) for (const field of ["calls", "tokens", "metered"] as const) add(day, field, each[field]);
		flush();
		renameSync(join(dataDir, FORMER_FILE), join(dataDir, FORMER_TAKEN));
		log(`Jev added the usage Sonar counted before it, ${Object.keys(former).length} days.`);
	}

	return {
		days: () => days,
		call: () => counted("calls", 1),
		tokens: (tokens) => {
			if (tokens === undefined) return;
			counted("tokens", tokens);
			counted("metered", 1);
		},
		flush,
	};
}
