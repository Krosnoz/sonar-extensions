// The styles Sonar's settings kept, taken by the server part at its start (./style-left.ts): what it takes, what wins,
// what it sets aside, and that the field leaves the projects' files once, after styles.json is written.

import { expect, test } from "bun:test";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { ServerApi } from "@sonar/extension";
import { type Bench, fakeServer } from "@sonar/extension/testing";
import { start } from "../server";

const card = JSON.parse(readFileSync(new URL("../../extension.json", import.meta.url), "utf8"));
const PROJECTS = ["alpha", "beta", "gamma", "delta"];

// A bench whose projects' files hold `left` under `world`, and styles.json `kept` (none by default).
function bench(left: Record<string, unknown>, kept?: unknown): Bench {
	const made = fakeServer({ card });
	made.projects.push(...PROJECTS.map((name) => ({ name, folder: `/work/${name}` })));
	for (const [project, value] of Object.entries(left)) made.left.push({ project, field: "world", value: value as never });
	if (kept) writeFileSync(join(made.api.dataDir, "styles.json"), JSON.stringify(kept));
	return made;
}

const file = (made: Bench) => join(made.api.dataDir, "styles.json");
const fileOf = (made: Bench) => JSON.parse(readFileSync(file(made), "utf8"));

// The API with `forget` counted: what styles.json held at each call.
function counted(made: Bench): { api: ServerApi; calls: unknown[] } {
	const calls: unknown[] = [];
	const { forget } = made.api.projects;
	const counting = async (field: string) => {
		calls.push(existsSync(file(made)) ? fileOf(made) : null);
		await forget?.(field);
	};
	const projects = { ...made.api.projects, forget: counting };
	return { api: { ...made.api, projects }, calls };
}

test("nothing to take: nothing written, nothing forgotten", async () => {
	const made = bench({});
	const { api, calls } = counted(made);
	await start(api);
	expect(existsSync(file(made))).toBe(false);
	expect(calls).toEqual([]);
});

test("the styles Sonar kept are taken, then their field leaves the projects' files", async () => {
	const made = bench({ alpha: { style: "neon", drawn: "sun" }, beta: { drawn: "fjord" } });
	await made.start(start);
	expect((await made.get("/style", { project: "alpha" })).body).toEqual({ style: "neon", drawn: "sun" });
	expect((await made.get("/style", { project: "beta" })).body).toEqual({ style: null, drawn: "fjord" });
	expect(made.left).toEqual([]);
});

// Sonar kept a project's style in a file named after it, each character outside letters, digits, ".", "_" and "-"
// written "_". It gives a project it lists by its name, and another one by that file's name.
test("a style taken is found by its project's name, whatever its characters, listed by Sonar or not", async () => {
	const made = bench({ "Mon Projet": { style: null, drawn: "sun" }, my_folder: { style: "neon", drawn: null } });
	await made.start(start);
	expect((await made.get("/style", { project: "Mon Projet" })).body).toEqual({ style: null, drawn: "sun" });
	expect((await made.get("/style", { project: "my folder" })).body).toEqual({ style: "neon", drawn: null });
	// Two names Sonar kept in one file share one town style, as they did.
	expect((await made.post("/style", { project: "my/folder", style: "brick" })).body).toEqual({ style: "brick", drawn: null });
	expect((await made.get("/style", { project: "my folder" })).body).toEqual({ style: "brick", drawn: null });
});

test("a style chosen in the extension wins; one it only drew gives way", async () => {
	const kept = { projects: { alpha: { style: "brick", drawn: null }, beta: { style: null, drawn: "sun" } } };
	const made = bench({ alpha: { style: "neon" }, beta: { style: "oasis", drawn: "riverside" } }, kept);
	await made.start(start);
	expect(fileOf(made).projects).toEqual({ alpha: { style: "brick", drawn: null }, beta: { style: "oasis", drawn: "riverside" } });
});

test("a former value with no style chosen nor drawn changes nothing", async () => {
	const made = bench({ alpha: {}, beta: { style: null } }, { projects: { alpha: { style: null, drawn: "sun" } } });
	await made.start(start);
	expect(fileOf(made).projects).toEqual({ alpha: { style: null, drawn: "sun" } });
});

test("a value that is no world is set aside in styles.json, not taken, and not lost", async () => {
	const made = bench({ alpha: "neon", beta: { style: "castle", drawn: "sun" }, gamma: [1], delta: { drawn: "brick" } });
	await made.start(start);
	const kept = fileOf(made);
	expect(kept.projects).toEqual({ delta: { style: null, drawn: "brick" } });
	expect(kept.setAside).toEqual({ alpha: "neon", beta: { style: "castle", drawn: "sun" }, gamma: [1] });
	expect((await made.get("/style", { project: "beta" })).body).toEqual({ style: null, drawn: null });
});

test("forget is called once, after styles.json is written", async () => {
	const made = bench({ alpha: { style: "neon" } });
	const { api, calls } = counted(made);
	await start(api);
	expect(calls).toEqual([{ projects: { alpha: { style: "neon", drawn: null } } }]);
});

test("styles.json not written: nothing is forgotten, and the start goes on", async () => {
	const made = bench({ alpha: { style: "neon" } });
	// The file beside it, renamed over it, cannot be written: it is a folder.
	mkdirSync(join(made.api.dataDir, "styles.json.next"));
	const { api, calls } = counted(made);
	await start(api);
	expect(calls).toEqual([]);
	expect(made.log.some((line) => line.startsWith("The towns' styles were not taken"))).toBe(true);
	expect((await made.get("/style", { project: "alpha" })).body).toEqual({ style: null, drawn: null });
});

test("a Sonar without projects.left nor projects.forget starts without taking anything", async () => {
	const made = bench({ alpha: { style: "neon" } });
	const { left: _left, forget: _forget, ...projects } = made.api.projects;
	await start({ ...made.api, projects });
	expect((await made.get("/style", { project: "alpha" })).body).toEqual({ style: null, drawn: null });
	expect(existsSync(file(made))).toBe(false);
});

test("taken again, the same values give the same styles", async () => {
	const left = { alpha: { style: "neon", drawn: "sun" }, beta: { drawn: "fjord" }, gamma: "neon" };
	const made = bench(left);
	await made.start(start);
	const first = fileOf(made);
	// A forget lost on the way: the next start finds the same values.
	for (const [project, value] of Object.entries(left)) made.left.push({ project, field: "world", value: value as never });
	await made.start(start);
	expect(fileOf(made)).toEqual(first);
	expect(made.left).toEqual([]);
});
