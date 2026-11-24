// A subject's building takes its height from its merges (./merge-floors.ts): a storey each time they double. Before,
// its height followed how many agents the subject had now: a subject with much work merged and one agent at rest stood
// as low as a new one.

import { expect, test } from "bun:test";
import { floorsBy, raisedBy } from "./merge-floors";

const floors = (merges: number, least = 1, most = 9): number => floorsBy(merges, least, most);

test("merge floors:one storey, then one more each time the merges double", () => {
	expect([0, 1, 2, 3, 6, 7, 14, 15, 30, 31, 62, 63].map((merges) => floors(merges))).toEqual([1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7]);
});

test("merge floors:a building never passes the most the town draws, however many merges", () => {
	expect([255, 256, 10_000, 1e9].map((merges) => floors(merges))).toEqual([9, 9, 9, 9]);
});

// In a city the subjects' buildings stand above their neighbours (seven storeys): its merges cannot lower one.
test("merge floors:a building never stands under the fewest its town asks", () => {
	expect([0, 3, 63, 127].map((merges) => floors(merges, 7, 7))).toEqual([7, 7, 7, 7]);
	expect([0, 1, 3].map((merges) => floors(merges, 2))).toEqual([2, 2, 3]);
});

// Between two doublings each merge lays its share of the storey to come: 3 merges give 3 storeys, the fourth takes 4
// more, so 4, 5 and 6 merges lay a quarter, a half and three quarters of it.
test("merge floors:each merge lays its share of the storey to come, none at a doubling", () => {
	expect([0, 1, 2, 3, 4, 5, 6, 7, 12, 40].map((merges) => raisedBy(merges, 1, 9).share)).toEqual([0, 0, 0.5, 0, 0.25, 0.5, 0.75, 0, 0.625, 0.28125]);
});

test("merge floors:no storey is to come over the most, nor on a building its town holds higher", () => {
	expect([255, 300, 510].map((merges) => raisedBy(merges, 1, 9))).toEqual(Array.from({ length: 3 }, () => ({ floors: 9, share: 0 })));
	expect([0, 5, 100].map((merges) => raisedBy(merges, 7, 7).share)).toEqual([0, 0, 0]);
	expect(raisedBy(0, 2, 9)).toEqual({ floors: 2, share: 0 });
});

test("merge floors:a count that is no whole number of merges builds as none", () => {
	expect([-3, Number.NaN, 2.9].map((merges) => floors(merges))).toEqual([1, 1, 2]);
});
