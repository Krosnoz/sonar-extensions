// The measure of the inhabitants' names: one layout per form, whatever the number of inhabitants. Reading a size after
// changing a class makes the browser lay the page out again: one name after the other, 10 000 inhabitants made 20 000
// of them, and the page crashed.
import { expect, test } from "bun:test";
import { NAME_GAP, measureNames } from "./sign-names.ts";

// A simulated page: a change of class dirties the layout, reading a dirty size lays it out again.
function page(widths: [number, number][]) {
	const layout = { dirty: false, count: 0 };
	const nodes = widths.map(([whole, cut]) => {
		const classes = new Set<string>();
		const read = (value: number): number => {
			if (layout.dirty) [layout.dirty, layout.count] = [false, layout.count + 1];
			return value;
		};
		const classList = {
			add: (name: string) => void (classes.add(name), (layout.dirty = true)),
			remove: (name: string) => void (classes.delete(name), (layout.dirty = true)),
			toggle: (name: string, on?: boolean) => {
				const wanted = on ?? !classes.has(name);
				if (wanted) classes.add(name);
				else classes.delete(name);
				layout.dirty = true;
				return wanted;
			},
			contains: (name: string) => classes.has(name),
		};
		return {
			classList,
			get offsetWidth() {
				return read(classes.has("world-cut") ? cut : whole);
			},
			get offsetHeight() {
				return read(16);
			},
		} as unknown as HTMLElement;
	});
	return { nodes, layout, classes: (at: number) => nodes[at]!.classList.contains("world-cut") };
}

test("the names of 2 000 inhabitants are measured in two layouts at most", () => {
	const { nodes, layout } = page(Array.from({ length: 2000 }, (_, at) => [80 + (at % 7), 50]));
	measureNames(nodes);
	expect(layout.count).toBeLessThanOrEqual(2);
});

test("a name that takes no place in the page yet is measured, then loses it again", () => {
	const { nodes } = page([[80, 50]]);
	nodes[0]!.classList.add("world-unplaced");
	const seen: boolean[] = [];
	const node = nodes[0]!;
	// The getter is called on its own node (`call` below).
	// oxlint-disable-next-line typescript/unbound-method
	const width = Object.getOwnPropertyDescriptor(node, "offsetWidth")!.get!;
	Object.defineProperty(node, "offsetWidth", { get: () => (seen.push(node.classList.contains("world-unplaced")), width.call(node)) });
	measureNames(nodes);
	expect(seen.every((unplaced) => !unplaced)).toBe(true);
	expect(node.classList.contains("world-unplaced")).toBe(true);
});

test("each name keeps its whole size, then its cut one when the cut gains room", () => {
	const { nodes, classes } = page([
		[120, 70],
		[60, 60],
	]);
	const room = 2 * NAME_GAP;
	expect(measureNames(nodes)).toEqual([
		[
			[120 + room, 16 + room],
			[70 + room, 16 + room],
		],
		[[60 + room, 16 + room]],
	]);
	expect([classes(0), classes(1)]).toEqual([false, false]);
});
