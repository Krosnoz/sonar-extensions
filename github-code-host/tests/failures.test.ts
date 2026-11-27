// When a call cannot answer: no key or no repository for the project, a token GitHub refuses (told apart,
// `refused`), GitHub out of reach, and an answer that cannot be read.

import { expect, test } from "bun:test";
import { type CodeHostProvider, isOff, isRefused } from "@sonar/extension";
import { badCredentials, data } from "./fake-github";
import { folderWith } from "./folders";
import { failureOf, started } from "./support";

type Call = (host: CodeHostProvider, project: string, folder: string) => Promise<unknown>;

// The calls about a project's repository.
const repositoryCalls: Call[] = [
	(host, project) => host.issues(project, "sonar"),
	(host, project) => host.openPull(project, { base: "main", head: "topic", title: "T", body: "B" }),
	(host, project) => host.pullState(project, 1),
	(host, project) => host.merged(project, "ada", "2026-09-07"),
	(host, project) => host.tracked(project, ["main"], 0),
];
// Every call that asks GitHub.
const calls: Call[] = [
	...repositoryCalls,
	(host, project) => host.account(project),
	(host, project) => host.pullByUrl(project, "https://github.com/acme/shop/pull/1"),
	(host, project, folder) => host.pullOfBranch(project, folder, "topic"),
];

// Each call that asks GitHub, rejected with the error given back.
async function failures(answer: () => Response | Promise<Response>) {
	const { host, github } = await started();
	github.answer = answer;
	const folder = folderWith("https://github.com/acme/shop.git");
	return Promise.all(calls.map((call) => failureOf(call(host, "shop", folder))));
}

// A failure that is neither a refused key nor the port off: Sonar says GitHub is out of reach.
const expectUnreachable = (errors: Error[], message: string) => {
	expect(errors.map((error) => [error.message, isRefused(error), isOff(error)])).toEqual(calls.map(() => [message, false, false]));
};

test("a call for a project without a key rejects, says which, and asks GitHub nothing", async () => {
	const { host, github } = await started();
	const folder = folderWith("https://github.com/acme/shop.git");
	for (const call of calls) {
		const error = await failureOf(call(host, "keyless", folder));
		expect(error.message).toBe("GitHub: the project keyless has no key");
		expect(isRefused(error)).toBe(false);
	}
	expect(github.asked).toEqual([]);
});

test("a call about the repository of a project without one rejects, and asks GitHub nothing", async () => {
	const { host, github } = await started();
	for (const call of repositoryCalls) expect((await failureOf(call(host, "bare", ""))).message).toBe("GitHub: the project bare has no repository");
	expect(github.asked).toEqual([]);
});

test("a token GitHub refuses (401): every call rejects with GitHub's reason, refused", async () => {
	const errors = await failures(badCredentials);
	expect(errors.map((error) => [error.message, isRefused(error)])).toEqual(calls.map(() => ["GitHub 401: Bad credentials", true]));
});

test("another status is not a refused key: 403, and a proxy's page, cut at 200 characters", async () => {
	expectUnreachable(await failures(() => Response.json({ message: "API rate limit exceeded" }, { status: 403 })), "GitHub 403: API rate limit exceeded");
	expectUnreachable(await failures(() => new Response("x".repeat(300), { status: 502 })), `GitHub 502: ${"x".repeat(200)}`);
});

test("an error GitHub answers in its data is said in its words", async () => {
	expectUnreachable(await failures(() => Response.json({ data: null, errors: [{ message: "Something went wrong" }] })), "GitHub: Something went wrong");
});

test("an answer that is no JSON rejects", async () => {
	expectUnreachable(await failures(() => new Response("<html>")), "GitHub: unreadable answer");
});

test("a network failure rejects with its own words, not refused", async () => {
	expectUnreachable(await failures(() => Promise.reject(new TypeError("fetch failed"))), "fetch failed");
});

test("an answer without what was asked: the account rejects, a pull request is none", async () => {
	const { host, github } = await started();
	github.answer = () => data({ viewer: null });
	expect((await failureOf(host.account("shop"))).message).toBe("GitHub: unreadable account");
	expect(await host.pullByUrl("shop", "https://github.com/acme/shop/pull/1")).toBeNull();
});

test("an unreadable list of issues rejects", async () => {
	const { host, github } = await started();
	for (const answer of [null, { repository: { issues: null } }, { repository: { issues: { nodes: [{ number: 1 }] } } }]) {
		github.answer = () => data(answer);
		expect((await failureOf(host.issues("shop", "sonar"))).message).toBe("GitHub: unreadable issues");
	}
});

test("no failure says the token", async () => {
	for (const answer of [badCredentials, () => new Response("down", { status: 500 }), () => new Response("<html>")])
		for (const error of await failures(answer)) expect(error.message).not.toContain("example-token");
});
