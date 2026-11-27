// The pull request of a folder's branch: the repository of that folder's origin, the open pull request, else the
// latest.

import { expect, test } from "bun:test";
import { data, pullNode } from "./fake-github";
import { folderWith } from "./folders";
import { started, TOKEN } from "./support";

const nodes = (...found: object[]) => data({ repository: { pullRequests: { nodes: found } } });

test("the repository is the folder's, not the project's; the project's token asks about the branch", async () => {
	const { host, github } = await started();
	github.answer = () => nodes(pullNode(31));
	const folder = folderWith("https://github.com/acme/worktree.git");
	expect((await host.pullOfBranch("shop", folder, "feat/cart"))?.pull.number).toBe(31);
	expect(github.asked.map((each) => [each.token, each.variables])).toEqual([[TOKEN, { owner: "acme", name: "worktree", branch: "feat/cart" }]]);
});

test("the open one, else the latest, else none", async () => {
	const { host, github } = await started();
	const found: Record<string, object[]> = {
		reopened: [pullNode(31, "MERGED"), pullNode(30, "OPEN")],
		done: [pullNode(33, "CLOSED"), pullNode(32, "MERGED")],
		fresh: [],
	};
	github.answer = ({ variables }) => nodes(...(found[String(variables["branch"])] ?? []));
	const folder = folderWith("git@github.com:acme/shop.git");
	const numberOf = async (branch: string) => (await host.pullOfBranch("shop", folder, branch))?.pull.number ?? null;
	expect([await numberOf("reopened"), await numberOf("done"), await numberOf("fresh")]).toEqual([30, 33, null]);
});

test("a folder without a GitHub repository has none, and GitHub is not asked, key or not", async () => {
	const { host, github } = await started();
	const folders = [folderWith(), folderWith("https://git.example.com/acme/shop.git")];
	for (const folder of folders) {
		expect(await host.pullOfBranch("shop", folder, "main")).toBeNull();
		expect(await host.pullOfBranch("keyless", folder, "main")).toBeNull();
	}
	expect(github.asked).toEqual([]);
});

test("a node that cannot be read is passed over; an unreadable answer is none", async () => {
	const { host, github } = await started();
	const folder = folderWith("https://github.com/acme/shop.git");
	github.answer = () => nodes({ number: "1" }, pullNode(2, "MERGED"));
	expect((await host.pullOfBranch("shop", folder, "topic"))?.pull.number).toBe(2);
	for (const answer of [null, { repository: null }, { repository: { pullRequests: { nodes: "none" } } }]) {
		github.answer = () => data(answer);
		expect(await host.pullOfBranch("shop", folder, "topic")).toBeNull();
	}
});
