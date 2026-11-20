// After each extension's build: writes release/ at the root, the files of the GitHub release Sonar installs from,
// two per extension: <id>.json (the card with its archive's SHA-256, its folder's release/extension.json) and
// <id>.tar.gz (its folder's release/extension.tar.gz), <id> read in the card. Refuses two folders of the same id: one
// would replace the other in the release.

import { copyFileSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { basename, join } from "node:path";
import { extensions, root } from "./extensions";

const release = join(root, "release");
const seen = new Map<string, string>();
const built = extensions().map((folder) => {
	const card = JSON.parse(readFileSync(join(folder, "release", "extension.json"), "utf8"));
	const id: unknown = card.id;
	if (typeof id !== "string" || !/^[a-z0-9-]+$/.test(id)) throw new Error(`${basename(folder)}: its card has no valid id.`);
	const other = seen.get(id);
	if (other) throw new Error(`${other} and ${basename(folder)} have the same id "${id}".`);
	seen.set(id, basename(folder));
	return { folder, id, version: card.version, sha256: card.sha256 };
});

rmSync(release, { recursive: true, force: true });
mkdirSync(release, { recursive: true });
for (const { folder, id, version, sha256 } of built) {
	copyFileSync(join(folder, "release", "extension.json"), join(release, `${id}.json`));
	copyFileSync(join(folder, "release", "extension.tar.gz"), join(release, `${id}.tar.gz`));
	console.log(`release/${id}.json and release/${id}.tar.gz: ${id} ${version}, sha256 ${sha256}`);
}
