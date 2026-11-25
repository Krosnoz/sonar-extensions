// `SONAR_REPO=<a copy of Sonar> bun run test:page [files] [--jobs N]`: the town's page tests (tests/page/), played on
// Sonar's page bench with the extension laid from this repository's release. Sonar is not a published package: the
// tests import its test helpers through tests/sonar, a link to the copy SONAR_REPO names, made here and kept out of git.
// A link, not imports by the variable's path: Node and TypeScript both follow it, so the tests import Sonar's helpers
// with their types, and Sonar's helpers find Sonar's own files and packages beside them.
// Each file runs as Sonar's `bun run verify` runs it, with the same code (its tools/verify/pool.ts): under Node, in a
// temporary home of its own, with Sonar's fake `claude` first on the PATH; a file that fails runs again alone at the
// end. One file at a time by default: a file starts a server, a host and Chromium.
// `--types` only checks the tests' types (`bun run check:page`).

import { existsSync, lstatSync, readdirSync, readlinkSync, rmSync, statSync, symlinkSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const TOWN = join(import.meta.dir, "..");
const ROOT = join(TOWN, "..");
const LINK = join(TOWN, "tests", "sonar");
const PAGES = join(TOWN, "tests", "page");

function fail(text: string): never {
	console.error(text);
	process.exit(2);
}

const args = process.argv.slice(2);
const given = process.env["SONAR_REPO"];
if (!given)
	fail(
		"SONAR_REPO is not set: name the folder of a copy of Sonar's repository, its dependencies installed (`bun install` there), e.g. SONAR_REPO=../sonar bun run test:page.",
	);
const sonar = resolve(given);
for (const needed of ["tests/page/support/bench.ts", "tools/verify/pool.ts", "node_modules"])
	if (!existsSync(join(sonar, needed))) fail(`${join(sonar, needed)} is missing: SONAR_REPO must name a copy of Sonar's repository, after \`bun install\` there.`);

// The link to the copy of Sonar, made again when it names another folder. Something else in its place is never removed.
function link(): void {
	if (existsSync(LINK) || isLink(LINK)) {
		if (!isLink(LINK)) fail(`${LINK} is in the way: it should be the link to SONAR_REPO that this script makes. Move it away.`);
		if (resolve(readlinkSync(LINK)) === sonar) return;
		rmSync(LINK);
	}
	// A junction on Windows, which needs no right; elsewhere the type is ignored.
	symlinkSync(sonar, LINK, "junction");
}
function isLink(path: string): boolean {
	try {
		return lstatSync(path).isSymbolicLink();
	} catch {
		return false;
	}
}
link();

// Sonar does not check the types of its own test helpers (its tsconfig leaves tests/ out): only the errors of this
// repository's files count, the town's tests read against the helpers' types.
const tsc = Bun.spawnSync([process.execPath, "x", "tsc", "-p", "tests/page", "--pretty", "false"], { cwd: TOWN });
const errors = `${tsc.stdout.toString()}${tsc.stderr.toString()}`
	.split(/\r?\n(?=\S)/)
	.filter((error) => error.trim() && !error.replaceAll("\\", "/").startsWith("tests/sonar/"));
if (errors.length) fail(`${errors.join("\n")}\nThe page tests' types are wrong (tsc -p tests/page).`);
if (args.includes("--types")) process.exit(0);

// The bench lays the town from release/ at this repository's root. Missing, or older than the extension's files, it is
// built again: a test of an old build passes or fails for nothing.
function newest(path: string): number {
	const stat = statSync(path);
	if (!stat.isDirectory()) return stat.mtimeMs;
	return Math.max(0, ...readdirSync(path).map((name) => newest(join(path, name))));
}
const archive = join(ROOT, "release", "town.tar.gz");
const sources = Math.max(...["src", "assets", "scripts/build.ts", "extension.json", "package.json"].map((name) => newest(join(TOWN, name))));
if (!existsSync(archive) || statSync(archive).mtimeMs < sources) {
	console.log(existsSync(archive) ? "release/town.tar.gz is older than the extension's files: bun run build at the root." : "release/town.tar.gz is missing: bun run build at the root.");
	const built = Bun.spawnSync([process.execPath, "run", "build"], { cwd: ROOT, stdio: ["inherit", "inherit", "inherit"] });
	if (built.exitCode !== 0) fail("The build failed: run `bun run setup`, then `bun run build`, at the repository's root.");
}

const option = (name: string) => args[args.indexOf(name) + 1];
const jobs = args.includes("--jobs") ? Number(option("--jobs")) : 1;
if (!Number.isInteger(jobs) || jobs < 1) fail(`--jobs takes a number of files at a time: "${option("--jobs") ?? ""}".`);
const named = args.filter((arg, index) => !arg.startsWith("--") && args[index - 1] !== "--jobs").map((file) => join(PAGES, basename(file)));
const files = named.length ? named : readdirSync(PAGES).filter((name) => name.endsWith(".page.ts")).toSorted().map((name) => join(PAGES, name));
for (const file of files) if (!existsSync(file)) fail(`${file} is not a page test of the town.`);

// What Sonar's own check does before it runs files (its tools/verify.ts): its fake `claude` built, the tests' processes
// below normal priority, the fake agents kept at it.
type Job = { name: string; cmd: string[] };
type Outcome = { name: string; ok: boolean; unstable: boolean; skipped: number };
const from = async <T>(path: string): Promise<T> => (await import(pathToFileURL(join(sonar, path)).href)) as T;
const { buildFakeClaude } = await from<{ buildFakeClaude: (root: string) => void }>("tools/verify/fake-bin.ts");
const { stayLow } = await from<{ stayLow: () => void }>("packages/processes/src/index.ts");
const { runPool } = await from<{ runPool: (root: string, jobs: Job[], concurrency: number) => Promise<Outcome[]> }>("tools/verify/pool.ts");
stayLow();
process.env["SONAR_TEST_AGENTS_KEEP_PRIORITY"] = "1";
buildFakeClaude(sonar);

// --test-force-exit: whatever a page test leaves open (a browser, a bench) does not keep its file running.
const planned = files.map((file) => ({ name: `tests/page/${basename(file)}`, cmd: ["node", "--test", "--test-force-exit", file] }));
const started = performance.now();
const outcomes = await runPool(sonar, planned, jobs);
const red = outcomes.filter((outcome) => !outcome.ok);
const unstable = outcomes.filter((outcome) => outcome.unstable);
const seconds = ((performance.now() - started) / 1000).toFixed(0);
console.log(`\n${outcomes.length - red.length}/${outcomes.length} green, ${unstable.length} unstable, ${red.length} red · ${seconds} s, ${jobs} at a time.`);
// A test skipped is said: a file green without its tests proves nothing.
for (const outcome of outcomes.filter((each) => each.skipped)) console.log(`  ${outcome.skipped} skipped: ${outcome.name}`);
for (const outcome of unstable) console.log(`  unstable: ${outcome.name}`);
for (const outcome of red) console.log(`  red: ${outcome.name}`);
process.exit(red.length ? 1 : 0);
