// The extensions of this repository: every folder of its root that has an extension.json, in the order of their names.

import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

export const root = join(import.meta.dir, "..");

export const extensions = (): string[] =>
	readdirSync(root, { withFileTypes: true })
		.filter((entry) => entry.isDirectory() && existsSync(join(root, entry.name, "extension.json")))
		.map((entry) => join(root, entry.name))
		.sort();
