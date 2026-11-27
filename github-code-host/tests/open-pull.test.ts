// The pull request opened for a branch already on GitHub, and its state later.

import { expect, test } from "bun:test";
import { type Asked, data } from "./fake-github";
import { failureOf, started } from "./support";

const asked = { base: "main", head: "topic", title: "A title", body: "Fixes #4" };
const pull = { number: 8, url: "https://github.com/acme/shop/pull/8" };

const repository =
	(open: object[], created: unknown = { createPullRequest: { pullRequest: pull } }) =>
	({ query }: Asked): Response =>
		query.startsWith("mutation") ? data(created) : data({ repository: { id: "R_1", pullRequests: { nodes: open } } });

test("the one already open for the branch is answered, and none is created", async () => {
	const { host, github } = await started();
	github.answer = repository([pull]);
	expect(await host.openPull("shop", asked)).toEqual(pull);
	expect(github.asked.map((each) => each.variables)).toEqual([{ owner: "acme", name: "shop", head: "topic" }]);
	expect(github.asked[0]?.query).toContain("states: OPEN");
});

test("without one, it is created in the repository, with its base, head, title and body", async () => {
	const { host, github } = await started();
	github.answer = repository([]);
	expect(await host.openPull("shop", asked)).toEqual(pull);
	expect(github.asked[1]?.query).toStartWith("mutation");
	expect(github.asked[1]?.variables).toEqual({ repository: "R_1", ...asked });
});

test("a repository the token does not see, or an answer that cannot be read: it rejects, and creates nothing", async () => {
	const { host, github } = await started();
	for (const answer of [{ repository: null }, { repository: { id: "R_1" } }, null]) {
		github.answer = () => data(answer);
		expect((await failureOf(host.openPull("shop", asked))).message).toBe("GitHub: acme/shop is not seen");
	}
	expect(github.asked.filter((each) => each.query.startsWith("mutation"))).toEqual([]);
});

test("a creation that answers no pull request rejects", async () => {
	const { host, github } = await started();
	github.answer = repository([], { createPullRequest: null });
	expect((await failureOf(host.openPull("shop", asked))).message).toBe("GitHub: unreadable pull request");
});

test("GitHub's refusal of the creation is said in its words", async () => {
	const { host, github } = await started();
	github.answer = ({ query }) =>
		query.startsWith("mutation")
			? Response.json({ data: { createPullRequest: null }, errors: [{ message: "No commits between main and topic" }] })
			: data({ repository: { id: "R_1", pullRequests: { nodes: [] } } });
	expect((await failureOf(host.openPull("shop", asked))).message).toBe("GitHub: No commits between main and topic");
});

test("its state: open, merged or closed", async () => {
	const { host, github } = await started();
	for (const state of ["OPEN", "MERGED", "CLOSED"] as const) {
		github.answer = () => data({ repository: { pullRequest: { state } } });
		expect(await host.pullState("shop", 8)).toBe(state);
	}
	expect(github.asked[0]?.variables).toEqual({ owner: "acme", name: "shop", number: 8 });
});

test("a pull request not seen, or a state that cannot be read: it rejects, naming the number", async () => {
	const { host, github } = await started();
	for (const answer of [{ repository: null }, { repository: { pullRequest: null } }, { repository: { pullRequest: { state: "ODD" } } }]) {
		github.answer = () => data(answer);
		expect((await failureOf(host.pullState("shop", 8))).message).toBe("GitHub: pull request #8 is not seen");
	}
});
