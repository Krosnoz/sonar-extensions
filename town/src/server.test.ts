// The server part's routes on the contract's kit: a project's style read and chosen, and the draw, as Sonar's own kept
// them in each project's settings (the user's choice, else the style the fewest other projects' towns show, drawn once).

import { expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { type Bench, fakeServer } from "@sonar/extension/testing";
import { start } from "./server";

const card = JSON.parse(readFileSync(new URL("../extension.json", import.meta.url), "utf8"));

async function started(projects: readonly string[], dataDir?: string): Promise<Bench> {
	const bench = fakeServer({ card, dataDir });
	bench.projects.push(...projects.map((name) => ({ name, folder: `/work/${name}` })));
	await bench.start(start);
	return bench;
}

const fileOf = (bench: Bench) => JSON.parse(readFileSync(join(bench.api.dataDir, "styles.json"), "utf8"));

test("a project without a choice reads none, and the reading writes nothing", async () => {
	const bench = await started(["alpha"]);
	expect(await bench.get("/style", { project: "alpha" })).toEqual({ status: 200, body: { style: null, drawn: null } });
	expect(existsSync(join(bench.api.dataDir, "styles.json"))).toBe(false);
});

test("a project Sonar does not list, or none named, is refused", async () => {
	const bench = await started(["alpha"]);
	expect((await bench.get("/style", { project: "beta" })).status).toBe(404);
	expect((await bench.get("/style")).status).toBe(400);
	expect((await bench.post("/style", { project: "beta", style: "neon" })).status).toBe(404);
	expect((await bench.post("/style", { style: "neon" })).status).toBe(400);
	expect((await bench.post("/style", ["alpha"])).status).toBe(400);
});

test("a style that is not one of the six, nor automatic, is refused and changes nothing", async () => {
	const bench = await started(["alpha"]);
	expect((await bench.post("/style", { project: "alpha", style: "castle" })).status).toBe(400);
	expect((await bench.post("/style", { project: "alpha" })).status).toBe(400);
	expect(existsSync(join(bench.api.dataDir, "styles.json"))).toBe(false);
});

test("a style chosen is kept in styles.json, and read again after a restart", async () => {
	const bench = await started(["alpha"]);
	expect(await bench.post("/style", { project: "alpha", style: "neon" })).toEqual({ status: 200, body: { style: "neon", drawn: null } });
	expect(fileOf(bench)).toEqual({ projects: { alpha: { style: "neon", drawn: null } } });
	const again = await started(["alpha"], bench.api.dataDir);
	expect((await again.get("/style", { project: "alpha" })).body).toEqual({ style: "neon", drawn: null });
});

test("the draw takes the style the fewest other projects' towns show, the first of the list among equals", async () => {
	const bench = await started(["alpha", "beta", "gamma"]);
	expect((await bench.post("/style", { project: "alpha", style: "automatic" })).body).toEqual({ style: null, drawn: "riverside" });
	expect((await bench.post("/style", { project: "beta", style: "brick" })).body).toEqual({ style: "brick", drawn: null });
	// alpha shows riverside, beta brick: sun is the first of the styles no other town shows.
	expect((await bench.post("/style", { project: "gamma", style: "automatic" })).body).toEqual({ style: null, drawn: "sun" });
});

test("the draw counts the projects Sonar lists only", async () => {
	const bench = await started(["alpha", "beta"]);
	await bench.post("/style", { project: "beta", style: "riverside" });
	bench.projects.splice(1, 1);
	bench.projects.push({ name: "gamma", folder: "/work/gamma" });
	expect((await bench.post("/style", { project: "gamma", style: "automatic" })).body).toEqual({ style: null, drawn: "riverside" });
});

test("a style drawn is kept: a choice keeps it under it, and the draw asked again gives it back", async () => {
	const bench = await started(["alpha", "beta"]);
	await bench.post("/style", { project: "alpha", style: "automatic" });
	expect((await bench.post("/style", { project: "alpha", style: "fjord" })).body).toEqual({ style: "fjord", drawn: "riverside" });
	// beta now shows riverside too: alpha's draw is not drawn again.
	await bench.post("/style", { project: "beta", style: "riverside" });
	expect((await bench.post("/style", { project: "alpha", style: "automatic" })).body).toEqual({ style: null, drawn: "riverside" });
});

test("two choices at once are both kept", async () => {
	const bench = await started(["alpha", "beta"]);
	await Promise.all([bench.post("/style", { project: "alpha", style: "sun" }), bench.post("/style", { project: "beta", style: "oasis" })]);
	expect(fileOf(bench).projects).toEqual({ alpha: { style: "sun", drawn: null }, beta: { style: "oasis", drawn: null } });
});
