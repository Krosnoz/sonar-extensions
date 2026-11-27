// The project's key: whether the project reaches GitHub, the account the key opens, and the access it gives the
// sessions' git.

import { expect, test } from "bun:test";
import { started, TOKEN } from "./support";

test("a project with a key is ready, whether or not it has a repository; one without is not; GitHub is not asked", async () => {
	const { host, github } = await started();
	expect(await Promise.all(["shop", "bare", "keyless"].map((project) => host.ready(project)))).toEqual([true, true, false]);
	expect(github.asked).toEqual([]);
});

test("the account is the login of the project's token, posted to GitHub's GraphQL API; no repository is needed", async () => {
	const { host, github } = await started();
	expect(await host.account("bare")).toBe("ada");
	expect(github.asked).toEqual([
		{ url: "https://api.github.com/graphql", method: "POST", token: TOKEN, query: "query { viewer { login } }", variables: {} },
	]);
});

test("the git access is the project's token for github.com, under the user name x-access-token", async () => {
	const { host, github } = await started();
	const access = { host: "github.com", username: "x-access-token", password: TOKEN };
	expect(await host.gitAccess("shop")).toEqual(access);
	expect(await host.gitAccess("bare")).toEqual(access);
	expect(github.asked).toEqual([]);
});

test("without a key, no git access: the sessions keep the machine's own", async () => {
	const { host } = await started();
	expect(await host.gitAccess("keyless")).toBeNull();
});

test("a key saved counts at once", async () => {
	const { bench, host } = await started();
	bench.setKey("token", "another-token", "keyless");
	expect(await host.ready("keyless")).toBe(true);
	expect((await host.gitAccess("keyless"))?.password).toBe("another-token");
});
