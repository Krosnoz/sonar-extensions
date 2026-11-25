// A subject's building keeps its design while its merges raise it (./designs.ts). Before, a building's storeys counted
// among the traits that tell two buildings apart: one more storey, and the town opened anew gave a subject another
// wall's tint, another roof or another ground floor, while the town that had followed the merge kept the old ones.

import { expect, test } from "bun:test";
import { designsOf } from "./designs";
import { looksOf } from "./looks";

const looks = looksOf(Array.from({ length: 12 }, (_, at) => ({ name: `Subject ${at}` })));
const heights = [
	[1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
	[1, 2, 3, 4, 5, 6, 7, 8, 9, 1, 2, 3],
	[9, 1, 1, 4, 1, 1, 2, 1, 6, 3, 3, 1],
	[2, 2, 5, 1, 3, 3, 1, 4, 1, 1, 7, 2],
];

test("designs:outside a city, a building keeps its design whatever its storeys", () => {
	const [first, ...others] = heights.map((floors) => designsOf(looks, floors, false));
	for (const other of others) expect(other).toEqual(first!);
});

test("designs:in a city, the storeys a design adds still tell two buildings apart", () => {
	const designs = designsOf(
		looks,
		looks.map(() => 7),
		true,
	);
	expect(designs.some((design) => design.extra > 0)).toBe(true);
	expect(new Set(designs.map((design) => JSON.stringify(design))).size).toBe(designs.length);
});
