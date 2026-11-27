// A project's repository: the "origin" remote of its main folder, or the field `github` of its settings when Sonar
// hands it over (a Sonar that no longer knows that field).

import { expect, test } from "bun:test";
import { fakeServer } from "@sonar/extension/testing";
import { startGitHub } from "../src/server";
import { fakeGitHub } from "./fake-github";
import { folderWith, setOrigin } from "./folders";
import { card, started } from "./support";

test("the repository is the origin of the project's folder, in https or ssh form, with or without .git; no key needed", async () => {
	const { bench, host, github } = await started();
	bench.projects.push(
		{ name: "plain", folder: folderWith("https://github.com/acme/plain/") },
		{ name: "ssh", folder: folderWith("ssh://git@github.com/acme/dotted.name.git") },
		{ name: "port", folder: folderWith("ssh://git@ssh.github.com:443/acme/over-https.git") },
		{ name: "capitals", folder: folderWith("https://GitHub.com/acme/capitals") },
	);
	const names = await Promise.all(["shop", "keyless", "plain", "ssh", "port", "capitals"].map((project) => host.repository(project)));
	expect(names).toEqual(["acme/shop", "acme/keyless", "acme/plain", "acme/dotted.name", "acme/over-https", "acme/capitals"]);
	expect(github.asked).toEqual([]);
});

test("no repository for a host whose name or path only holds GitHub's", async () => {
	const { bench, host } = await started();
	bench.projects.push(
		{ name: "alike", folder: folderWith("https://notgithub.com/acme/shop.git") },
		{ name: "inside", folder: folderWith("https://git.example.com/github.com/acme/shop") },
		{ name: "deeper", folder: folderWith("https://github.com/acme/shop/extra") },
	);
	for (const project of ["alike", "inside", "deeper"]) expect(await host.repository(project)).toBeNull();
});

test("no repository: a folder without origin, an origin outside GitHub, a folder gone, a project Sonar does not list", async () => {
	const { bench, host } = await started();
	bench.projects.push(
		{ name: "elsewhere", folder: folderWith("https://git.example.com/acme/shop.git") },
		{ name: "gone", folder: `${folderWith()}-gone` },
	);
	for (const project of ["bare", "elsewhere", "gone", "unknown"]) expect(await host.repository(project)).toBeNull();
});

test("a folder's remote is read once, then kept", async () => {
	const { bench, host } = await started();
	const folder = folderWith("https://github.com/acme/first.git");
	bench.projects.push({ name: "moving", folder });
	expect(await host.repository("moving")).toBe("acme/first");
	setOrigin(folder, "https://github.com/acme/moved.git");
	expect(await host.repository("moving")).toBe("acme/first");
});

test("the setting github, handed over by Sonar, comes before the origin", async () => {
	const { bench, host } = await started();
	bench.left.push({ project: "shop", field: "github", value: "acme/named" }, { project: "bare", field: "github", value: "acme/bare" });
	expect(await host.repository("shop")).toBe("acme/named");
	expect(await host.repository("bare")).toBe("acme/bare");
});

test("a setting that names no repository leaves the origin", async () => {
	const { bench, host } = await started();
	for (const value of ["acme", "", 12, null, "a/b/c", " a/b", "a/b c", "https://github.com/a/b"]) {
		bench.left.splice(0, bench.left.length, { project: "shop", field: "github", value });
		expect(await host.repository("shop")).toBe("acme/shop");
	}
});

test("a project Sonar does not list finds its setting under its settings file's name", async () => {
	const { bench, host } = await started();
	bench.left.push({ project: "side_project", field: "github", value: "acme/side" });
	expect(await host.repository("side project")).toBe("acme/side");
});

test("a listed project never takes the setting of the file another name is written as", async () => {
	const { bench, host } = await started();
	bench.projects.push({ name: "side project", folder: folderWith() });
	bench.left.push({ project: "side_project", field: "github", value: "acme/side" });
	expect(await host.repository("side project")).toBeNull();
});

test("a Sonar that hands no field over: the origin alone", async () => {
	const bench = fakeServer({ card });
	bench.projects.push({ name: "shop", folder: folderWith("https://github.com/acme/shop.git") });
	await bench.start((api) => startGitHub({ ...api, projects: { list: api.projects.list, trust: api.projects.trust } }, fakeGitHub().send));
	expect(await bench.codeHost()?.repository("shop")).toBe("acme/shop");
});

test("the calls about a project's repository go to the one its setting names", async () => {
	const { bench, host, github } = await started();
	bench.left.push({ project: "shop", field: "github", value: "acme/named" });
	github.answer = () => Response.json({ data: { repository: { pullRequest: { state: "OPEN" } } } });
	await host.pullState("shop", 7);
	expect(github.asked[0]?.variables).toEqual({ owner: "acme", name: "named", number: 7 });
});
