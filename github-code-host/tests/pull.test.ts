// A pull request read by its address, in Sonar's words: each check's verdict, whether it merges, its base, its reviews
// and comments, and the bounds Sonar sets.

import { expect, test } from "bun:test";
import { checkRun, commits, data, pullNode } from "./fake-github";
import { started, TOKEN } from "./support";

const URL = "https://github.com/acme/shop/pull/12";
const at = (minute: number) => `2026-10-05T10:0${minute}:00.000Z`;

async function readingOf(node: object, language: "en" | "fr" = "en") {
	const { host, github } = await started(language);
	github.answer = () => data({ resource: node });
	return host.pullByUrl("shop", URL);
}

test("the pull request at the address, asked with the project's token", async () => {
	const { host, github } = await started();
	github.answer = () => data({ resource: pullNode(12, "OPEN", { isDraft: true }) });
	expect(await host.pullByUrl("shop", URL)).toEqual({
		pull: { number: 12, url: URL, title: "Pull 12", state: "OPEN", draft: true, checks: [], head: "4f9c2a1" },
		mergeable: "clean",
		base: "main",
		activity: [],
	});
	expect(github.asked.map((each) => [each.token, each.variables])).toEqual([[TOKEN, { url: URL }]]);
	expect(github.asked[0]?.query).toContain("headRefOid");
});

test("one GitHub does not show, and an address that is no pull request, are none", async () => {
	expect(await readingOf(null as never)).toBeNull();
	expect(await readingOf({})).toBeNull();
});

test("each check has GitHub's word and its verdict: failed, pending, passed, or skipped when it tells nothing", async () => {
	const read = await readingOf(
		pullNode(12, "OPEN", {
			commits: commits(
				checkRun("test", "FAILURE"),
				checkRun("slow", "TIMED_OUT"),
				checkRun("lint", "CANCELLED"),
				checkRun("deploy", "SKIPPED"),
				checkRun("build", "SUCCESS"),
				checkRun("note", "NEUTRAL"),
				checkRun("e2e", null, "IN_PROGRESS"),
				{ kind: "StatusContext", context: "review", state: "ERROR" },
				{ kind: "StatusContext", context: "preview", state: "EXPECTED" },
			),
		}),
	);
	expect(read?.pull.checks.map(({ name, state, verdict }) => [name, state, verdict])).toEqual([
		["test", "FAILURE", "failed"],
		["slow", "TIMED_OUT", "failed"],
		["lint", "CANCELLED", "skipped"],
		["deploy", "SKIPPED", "skipped"],
		["build", "SUCCESS", "passed"],
		["note", "NEUTRAL", "passed"],
		["e2e", "IN_PROGRESS", "pending"],
		["review", "ERROR", "failed"],
		["preview", "EXPECTED", "pending"],
	]);
});

test("a check GitHub gives no name is named in the user's language", async () => {
	const node = pullNode(12, "OPEN", { commits: commits({ kind: "CheckRun", status: "QUEUED" }) });
	expect((await readingOf(node, "en"))?.pull.checks[0]?.name).toBe("check");
	expect((await readingOf(node, "fr"))?.pull.checks[0]?.name).toBe("vérification");
});

test("a commit without CI, or a pull request without commit, has no check", async () => {
	expect((await readingOf(pullNode(12, "OPEN", { commits: { nodes: [{ commit: { statusCheckRollup: null } }] } })))?.pull.checks).toEqual([]);
	expect((await readingOf(pullNode(12, "OPEN", { commits: { nodes: [] } })))?.pull.checks).toEqual([]);
});

test("whether it merges: a conflict, clean, or not known yet", async () => {
	const words = ["CONFLICTING", "MERGEABLE", "UNKNOWN"];
	const read = await Promise.all(words.map(async (mergeable) => (await readingOf(pullNode(12, "OPEN", { mergeable })))?.mergeable));
	expect(read).toEqual(["conflict", "clean", "unknown"]);
});

test("its reviews and comments, oldest first, a review still being written left out, a deleted author unnamed", async () => {
	const read = await readingOf(
		pullNode(12, "OPEN", {
			reviews: {
				nodes: [
					{ author: { login: "grace" }, state: "CHANGES_REQUESTED", body: "Rename it.", submittedAt: at(2) },
					{ author: { login: "ada" }, state: "PENDING", body: "draft", submittedAt: at(1) },
					{ author: { login: "ada" }, state: "PENDING", body: "unsent", submittedAt: null },
				],
			},
			comments: {
				nodes: [
					{ author: { login: "alan" }, body: "First.", createdAt: at(0) },
					{ author: null, body: "Any news?", createdAt: at(3) },
				],
			},
		}),
	);
	expect(read?.activity).toEqual([
		{ kind: "comment", author: "alan", state: "", body: "First.", at: at(0) },
		{ kind: "review", author: "grace", state: "CHANGES_REQUESTED", body: "Rename it.", at: at(2) },
		{ kind: "comment", author: "?", state: "", body: "Any news?", at: at(3) },
	]);
});

test("a pull request without last commit's head has none", async () => {
	expect((await readingOf(pullNode(12, "MERGED", { headRefOid: undefined })))?.pull).not.toHaveProperty("head");
});

test("texts longer than Sonar takes are cut, so that the reading is not refused", async () => {
	const read = await readingOf(
		pullNode(12, "OPEN", {
			title: "t".repeat(600),
			comments: { nodes: [{ author: { login: "a".repeat(300) }, body: "b".repeat(70_000), createdAt: at(0) }] },
			commits: commits(checkRun("n".repeat(300), "SUCCESS")),
		}),
	);
	expect(read?.pull.title).toHaveLength(500);
	expect(read?.pull.checks[0]?.name).toHaveLength(200);
	expect([read?.activity[0]?.author.length, read?.activity[0]?.body.length]).toEqual([200, 65_536]);
});

test("an answer that cannot be read as a pull request is none", async () => {
	const unreadable = [
		pullNode(12, "OPEN", { number: "12" }),
		pullNode(12, "DRAFTED"),
		pullNode(12, "OPEN", { isDraft: "no" }),
		pullNode(12, "OPEN", { commits: { nodes: [{}] } }),
		pullNode(12, "OPEN", { commits: commits({ kind: "CheckRun", name: 3 }) }),
		pullNode(12, "OPEN", { reviews: { nodes: [{ state: 4 }] } }),
	];
	for (const node of unreadable) expect(await readingOf(node)).toBeNull();
});
