// The author's pull requests merged since a day, read from GitHub's search, page after page.

import { expect, test } from "bun:test";
import { data } from "./fake-github";
import { failureOf, started } from "./support";

const merged = { createdAt: "2026-09-08T10:00:00Z", mergedAt: "2026-09-09T10:00:00Z", baseRefName: "main" };
const page = (nodes: object[], next: string | null) => data({ search: { pageInfo: { hasNextPage: next !== null, endCursor: next }, nodes } });

test("the search names the repository, the author and the day; each one with its base", async () => {
	const { host, github } = await started();
	github.answer = () => page([merged], null);
	expect(await host.merged("shop", "ada", "2026-09-07")).toEqual([{ createdAt: merged.createdAt, mergedAt: merged.mergedAt, base: "main" }]);
	expect(github.asked.map((each) => each.variables)).toEqual([{ q: "repo:acme/shop author:ada is:pr is:merged merged:>=2026-09-07", after: null }]);
});

test("the pages follow one another, each after the cursor of the one before", async () => {
	const { host, github } = await started();
	github.answer = ({ variables }) => page([{ ...merged, baseRefName: String(variables["after"] ?? "first") }], variables["after"] ? null : "c1");
	expect((await host.merged("shop", "ada", "2026-09-07")).map((each) => each.base)).toEqual(["first", "c1"]);
});

test("5 pages at most", async () => {
	const { host, github } = await started();
	github.answer = () => page([merged], "more");
	expect(await host.merged("shop", "ada", "2026-09-07")).toHaveLength(5);
	expect(github.asked).toHaveLength(5);
});

test("a page that cannot be read rejects the whole call", async () => {
	const { host, github } = await started();
	for (const answer of [null, { search: null }, { search: { pageInfo: { hasNextPage: false, endCursor: null }, nodes: [{ createdAt: "x" }] } }]) {
		github.answer = () => data(answer);
		expect((await failureOf(host.merged("shop", "ada", "2026-09-07"))).message).toBe("GitHub: unreadable search");
	}
});
