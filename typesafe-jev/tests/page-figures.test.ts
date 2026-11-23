// What the page shows of Jev's usage (src/page/figures.ts), from GET /usage as the server answers it: the tile's amount
// and its calls and tokens, the mention "estimated" when a day was, and the chart by day, as Sonar's plugin draws them
// (its usage/jev.ts): no chart for today alone, nor when every day rounds to nothing.

import { expect, test } from "bun:test";
import type { UsageReport } from "../src/cost";
import { figuresOf } from "../src/page/figures";
import { kitOf } from "../src/page/kit";

const day = (date: string, usd: number, calls = 10, tokens = 1000, estimated = false) => ({ day: date, calls, tokens, usd, estimated });
const report = (days: UsageReport["days"]): UsageReport => ({ days, month: { usd: 0, monthlyUsd: 2 } });
// 2026-11-15 is a Sunday, 2026-11-21 a Saturday.
const week = report([
	day("2026-11-15", 0),
	day("2026-11-16", 0.0126, 300, 297_619),
	day("2026-11-17", 0.5, 4000, 11_904_762),
	day("2026-11-18", 0),
	day("2026-11-19", 0.25, 2000, 5_952_381, true),
	day("2026-11-20", 0.001),
	day("2026-11-21", 0.75, 6000, 17_857_143),
]);

test("the tile sums the period: its amount, its calls and tokens, partly estimated when one day was", () => {
	const { value, hint } = figuresOf(week, kitOf("en"));
	expect(value).toBe("$1.51");
	expect(hint).toBe("12,330 calls · 36M tokens · partly estimated");
	const plain = figuresOf(report([day("2026-11-21", 0.0421, 412, 1_002_381)]), kitOf("en"));
	expect([plain.value, plain.hint]).toEqual(["$0.042", "412 calls · 1M tokens"]);
});

test("in French, the same words as Sonar's plugin", () => {
	const { value, hint, chart } = figuresOf(week, kitOf("fr"));
	expect(value.replace(/\s/gu, " ")).toBe("1,51 $");
	expect(hint.replace(/\s/gu, " ")).toBe("12 330 appels · 36 M tokens · en partie estimé");
	expect(chart?.title.replace(/\s/gu, " ")).toBe("Par jour · max 0,750 $");
	expect(chart?.bars.map((bar) => bar.tick)).toEqual(["dim", "lun", "mar", "mer", "jeu", "ven", "sam"]);
	expect(chart?.bars[6]?.label).toBe("samedi 21 novembre");
});

test("in French, thousands are parted by a space that is seen, as Sonar's page writes them", () => {
	// The narrow space (U+202F) is drawn about a pixel wide at the page's small sizes: "12 330" read "12330".
	const kit = kitOf("fr");
	expect(figuresOf(week, kit).hint).toStartWith("12 330 appels");
	expect([kit.whole(1_002_381), kit.paid(1234.5), kit.cap(1500)]).toEqual(["1 002 381", "1 234,50 $", "1 500 $"]);
	expect(kitOf("en").whole(1_002_381)).toBe("1,002,381");
});

test("over 7 days, a bar a day: its weekday under it, its share of the highest, today read at rest", () => {
	const chart = figuresOf(week, kitOf("en")).chart;
	expect(chart?.title).toBe("Per day · max $0.750");
	expect(chart?.bars.map((bar) => bar.tick)).toEqual(["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]);
	expect(chart?.bars.map((bar) => bar.label)).toContain("Saturday, November 21");
	// A day that cost something shows at least a sliver; a day of nothing, no bar.
	expect(chart?.bars.map((bar) => bar.share)).toEqual([0, 0.03, 0.5 / 0.75, 0, 0.25 / 0.75, 0.03, 1]);
	expect(chart?.bars[2]?.amount).toBe("$0.500");
	expect(chart?.rest).toBe(6);
	expect(chart?.said).toBe(
		"Sunday, November 15: $0.000, Monday, November 16: $0.013, Tuesday, November 17: $0.500, Wednesday, November 18: $0.000, Thursday, November 19: $0.250, Friday, November 20: $0.001, Saturday, November 21: $0.750",
	);
});

test("over 30 days, a bar's tick is its day of the month every 5 days", () => {
	const month = report(Array.from({ length: 30 }, (_, at) => day(`2026-11-${String(at + 1).padStart(2, "0")}`, at === 29 ? 0.2 : 0)));
	expect(figuresOf(month, kitOf("en")).chart?.bars.map((bar) => bar.tick)).toEqual(
		Array.from({ length: 30 }, (_, at) => ((at + 1) % 5 === 0 ? String(at + 1) : "")),
	);
});

test("no chart for today alone, nor when no day shows a cost", () => {
	expect(figuresOf(report([day("2026-11-21", 0.4)]), kitOf("en")).chart).toBeNull();
	const flat = report(Array.from({ length: 7 }, (_, at) => day(`2026-11-${15 + at}`, 0.0004)));
	expect(figuresOf(flat, kitOf("en")).chart).toBeNull();
	expect(figuresOf(report(Array.from({ length: 7 }, (_, at) => day(`2026-11-${15 + at}`, 0))), kitOf("en")).value).toBe("$0.000");
});
