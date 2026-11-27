// The branches a project follows, read in one request: the open pull requests toward each, the merges since a moment,
// and the commits to promote.

import { expect, test } from "bun:test";
import { checkRun, commits, data } from "./fake-github";
import { failureOf, started } from "./support";

const SINCE = Date.parse("2026-10-20T00:00:00Z");

const node = (more: object = {}) => ({
	number: 5,
	url: "https://github.com/acme/shop/pull/5",
	title: "Add translations",
	isDraft: false,
	createdAt: "2026-10-18T09:00:00Z",
	mergeable: "MERGEABLE",
	mergeStateStatus: "CLEAN",
	headRefName: "feat/import",
	author: { login: "grace" },
	labels: { nodes: [{ name: "checked" }] },
	commits: commits(checkRun("build", "SUCCESS")),
	...more,
});

async function read(repository: unknown, branches: string[]) {
	const { host, github } = await started();
	github.answer = () => data({ repository });
	return { lines: await host.tracked("shop", branches, SINCE), github };
}

test("one request, an alias per branch, each compared with the branch before it, and nothing written", async () => {
	const { github } = await read({}, ["dev", "stage", "main"]);
	expect(github.asked).toHaveLength(1);
	const { query, variables } = github.asked[0] ?? { query: "", variables: {} };
	expect(query).toContain("query($owner: String!, $name: String!, $b0: String!, $b1: String!, $r1: String!, $b2: String!, $r2: String!)");
	expect(query).toContain("open0: pullRequests(baseRefName: $b0, states: OPEN");
	expect(query).toContain("merged2: pullRequests(baseRefName: $b2, states: MERGED");
	expect(query).toContain("ref2: ref(qualifiedName: $r2) { compare(headRef: $b1) { aheadBy } }");
	expect(query).not.toContain("ref0:");
	expect(query).not.toContain("mutation");
	expect(variables).toEqual({
		owner: "acme",
		name: "shop",
		b0: "dev",
		b1: "stage",
		r1: "refs/heads/stage",
		b2: "main",
		r2: "refs/heads/main",
	});
});

test("each branch's open pull requests, its merges since the moment, and its commits to promote", async () => {
	const { lines } = await read(
		{
			open0: { nodes: [node()] },
			merged0: { nodes: [{ mergedAt: "2026-10-20T08:00:00Z" }, { mergedAt: "2026-10-19T22:00:00Z" }, { mergedAt: null }] },
			ref0: { compare: { aheadBy: 3 } },
			open1: { nodes: [] },
			merged1: { nodes: [] },
			ref1: { compare: { aheadBy: 96 } },
			open2: { nodes: [] },
			merged2: { nodes: [] },
			// A branch GitHub does not have.
			ref2: null,
		},
		["dev", "stage", "main"],
	);
	expect(lines.map((line) => [line.name, line.pulls.length, line.mergedSince, line.ahead])).toEqual([
		["dev", 1, 1, null],
		["stage", 0, 0, 96],
		["main", 0, 0, null],
	]);
	expect(lines[0]?.pulls[0]).toEqual({
		number: 5,
		url: "https://github.com/acme/shop/pull/5",
		title: "Add translations",
		author: "grace",
		createdAt: "2026-10-18T09:00:00Z",
		draft: false,
		labels: ["checked"],
		mergeable: "clean",
		head: "feat/import",
		checks: [{ name: "build", state: "SUCCESS", verdict: "passed" }],
	});
});

test("a pull request GitHub says little of: no author, label, check nor state of its merge", async () => {
	const bare = node({ author: null, labels: null, commits: null, mergeStateStatus: undefined });
	const { lines } = await read({ open0: { nodes: [bare] } }, ["main"]);
	expect(lines[0]?.pulls[0]).toMatchObject({ author: "?", labels: [], checks: [], mergeable: "unknown" });
});

test("how a pull request merges: ready, behind its base, in conflict, held by GitHub's rules, or not known yet", async () => {
	const words = ["CLEAN", "HAS_HOOKS", "UNSTABLE", "BEHIND", "DIRTY", "BLOCKED", "DRAFT", "UNKNOWN"];
	const nodes = [...words.map((mergeStateStatus) => node({ mergeStateStatus })), node({ mergeable: "CONFLICTING" })];
	const { lines } = await read({ open0: { nodes } }, ["main"]);
	expect(lines[0]?.pulls.map((each) => each.mergeable)).toEqual([
		"clean",
		"clean",
		"clean",
		"behind",
		"conflict",
		"blocked",
		"blocked",
		"unknown",
		"conflict",
	]);
});

test("each branch links to GitHub's page of the pull requests open toward it", async () => {
	const { lines } = await read({}, ["dev", "release/2.0"]);
	expect(lines.map((line) => line.url)).toEqual([
		"https://github.com/acme/shop/pulls?q=is%3Apr%20is%3Aopen%20base%3Adev",
		"https://github.com/acme/shop/pulls?q=is%3Apr%20is%3Aopen%20base%3Arelease%2F2.0",
	]);
});

test("a branch whose list cannot be read shows no pull request, the others do", async () => {
	const { lines } = await read({ open0: { nodes: [{ number: "5" }] }, open1: { nodes: [node()] } }, ["dev", "main"]);
	expect(lines.map((line) => line.pulls.length)).toEqual([0, 1]);
});

test("texts longer than Sonar takes are cut", async () => {
	const long = node({ title: "t".repeat(600), labels: { nodes: [{ name: "l".repeat(300) }] } });
	const { lines } = await read({ open0: { nodes: [long] } }, ["main"]);
	expect([lines[0]?.pulls[0]?.title.length, lines[0]?.pulls[0]?.labels[0]?.length]).toEqual([500, 200]);
});

test("a repository GitHub does not show, or an unreadable answer, rejects with its name", async () => {
	const { host, github } = await started();
	for (const answer of [{ repository: null }, null]) {
		github.answer = () => data(answer);
		expect((await failureOf(host.tracked("shop", ["main"], SINCE))).message).toBe("GitHub: acme/shop not found");
	}
});
