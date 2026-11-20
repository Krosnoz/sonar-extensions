// `bun scripts/each.ts <arguments>`: runs `bun <arguments>` in each extension's folder, one after the other, and stops
// at the first that fails. The same Bun that runs this script, so that it works without a shell on every system.

import { basename } from "node:path";
import { extensions } from "./extensions";

const folders = extensions();
if (folders.length === 0) throw new Error("No folder with an extension.json at the root.");
for (const folder of folders) {
	console.log(`\n${basename(folder)}: bun ${process.argv.slice(2).join(" ")}`);
	const run = Bun.spawnSync([process.execPath, ...process.argv.slice(2)], { cwd: folder, stdio: ["inherit", "inherit", "inherit"] });
	if (run.exitCode !== 0) process.exit(run.exitCode ?? 1);
}
