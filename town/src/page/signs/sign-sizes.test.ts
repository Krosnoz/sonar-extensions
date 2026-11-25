// The figures' names are measured once the nearest level shows them, and kept from level to level: read at every change
// of level, the 10 000 names of a big town laid the page out twice each time, and froze the zoom for half a second.
import { expect, test } from "bun:test";

const page = globalThis as Record<string, unknown>;
page["ResizeObserver"] = class {
	observe(): void {}
};
page["getComputedStyle"] = () => ({ paddingTop: "0", getPropertyValue: () => "16" });
page["document"] = { fonts: { addEventListener() {} }, querySelectorAll: () => [], documentElement: { dataset: {} } };
const { signSizes } = await import("./sign-sizes.ts");

test("the names are read once, at the first frame of the nearest level, whatever the levels after", () => {
	const reads = { count: 0 };
	const node = (): HTMLElement =>
		({
			classList: { toggle() {}, remove() {}, add() {}, contains: () => false },
			get offsetWidth() {
				reads.count++;
				return 50;
			},
			offsetHeight: 16,
		}) as unknown as HTMLElement;
	const layer = { parentElement: null, clientWidth: 1440, clientHeight: 900, getBoundingClientRect: () => ({ left: 0, top: 0 }) } as unknown as HTMLElement;
	const names = Array.from({ length: 1000 }, () => ({ node: node() }));
	const sizesAt = signSizes(layer, [], names);
	for (const level of [0, 1, 0, 1]) expect(sizesAt(level).named).toEqual([]);
	expect(reads.count).toBe(0);
	const near = sizesAt(2).named;
	expect(near.length).toBe(1000);
	const once = reads.count;
	expect(once).toBeGreaterThan(0);
	for (const level of [1, 0, 2, 1, 2]) sizesAt(level);
	expect(reads.count).toBe(once);
	expect(sizesAt(2).named).toBe(near);
});
