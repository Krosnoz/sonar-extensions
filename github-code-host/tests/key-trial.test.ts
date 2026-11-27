// The trial of a key, as Sonar asks it while the user types one: the account the token opens, the projects it reaches
// and those without a repository, a token GitHub refuses told apart (`refused`), and a Sonar older than the trial.

import { expect, test } from "bun:test";
import { isRefused } from "@sonar/extension";
import { fakeServer } from "@sonar/extension/testing";
import { startGitHub } from "../src/server";
import { type Asked, badCredentials, data, fakeGitHub, viewer } from "./fake-github";
import { folderWith } from "./folders";
import { card, failureOf, started } from "./support";

// The account ada, who sees every repository but those named in `hidden`: GitHub answers an error for one it hides.
const seeing =
	(...hidden: string[]) =>
	({ query, variables }: Asked): Response => {
		if (query.includes("viewer")) return viewer();
		return hidden.includes(String(variables["name"]))
			? Response.json({ data: { repository: null }, errors: [{ message: "Could not resolve to a Repository" }] })
			: data({ repository: { id: "R_1" } });
	};

// The trial the extension gave, as the kit calls it: an answer Sonar would refuse fails the test.
async function tried() {
	const { bench, github } = await started();
	const run = bench.keyTrial("token");
	if (!run) throw new Error("The extension gave no trial for its key.");
	return { bench, github, run };
}

test("a token GitHub knows: its account, asked with the token typed, not the one saved", async () => {
	const { run, github } = await tried();
	expect(await run("typed-token")).toEqual({ account: "ada", reaches: [], outside: [] });
	expect(github.asked.map((each) => each.token)).toEqual(["typed-token"]);
});

test("the projects it reaches, whose repository it sees, and those that have none", async () => {
	const { run, github } = await tried();
	github.answer = seeing("keyless");
	expect(await run("typed-token", ["shop", "bare", "keyless", "unknown"])).toEqual({
		account: "ada",
		reaches: ["shop"],
		outside: ["bare", "unknown"],
	});
	expect(github.asked.slice(1).map((each) => [each.token, each.variables["name"]])).toEqual(
		expect.arrayContaining([
			["typed-token", "shop"],
			["typed-token", "keyless"],
		]),
	);
	expect(github.asked).toHaveLength(3);
});

test("the repository tried is the setting's when Sonar hands it over", async () => {
	const { bench, run, github } = await tried();
	bench.left.push({ project: "bare", field: "github", value: "acme/named" });
	github.answer = seeing();
	expect((await run("typed-token", ["bare"])).reaches).toEqual(["bare"]);
	expect(github.asked[1]?.variables).toEqual({ owner: "acme", name: "named" });
});

test("a repository GitHub does not answer for is not reached, the account kept", async () => {
	const { bench, run, github } = await tried();
	bench.projects.push({ name: "other", folder: folderWith("https://github.com/acme/other.git") });
	github.answer = ({ query, variables }) => {
		if (query.includes("viewer")) return viewer();
		if (variables["name"] === "other") throw new TypeError("fetch failed");
		return new Response("down", { status: 500 });
	};
	expect(await run("typed-token", ["shop", "other"])).toEqual({ account: "ada", reaches: [], outside: [] });
});

test("a token GitHub refuses: the trial rejects with GitHub's reason, refused, and asks no repository", async () => {
	const { run, github } = await tried();
	github.answer = badCredentials;
	const error = await failureOf(run("typed-token", ["shop"]));
	expect(error.message).toBe("GitHub 401: Bad credentials");
	expect(isRefused(error)).toBe(true);
	expect(github.asked).toHaveLength(1);
});

test("GitHub out of reach, in failure, or unreadable: the trial rejects, not refused", async () => {
	const { run, github } = await tried();
	const failures: [() => Response | Promise<Response>, string][] = [
		[() => Promise.reject(new TypeError("fetch failed")), "fetch failed"],
		[() => new Response("down", { status: 500 }), "GitHub 500: down"],
		[() => data({ viewer: null }), "GitHub: unreadable account"],
	];
	for (const [answer, message] of failures) {
		github.answer = answer;
		const error = await failureOf(run("typed-token"));
		expect(error.message).toBe(message);
		expect(isRefused(error)).toBe(false);
	}
});

test("a Sonar older than the trial of a key: the extension starts, and fills the port", async () => {
	const bench = fakeServer({ card });
	await bench.start((api) => startGitHub({ ...api, keys: { read: api.keys.read } }, fakeGitHub().send));
	expect(bench.codeHost()).not.toBeNull();
	expect(bench.keyTrial("token")).toBeNull();
});
