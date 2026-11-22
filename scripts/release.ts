// After each extension's build: writes release/ at the root, the files of the GitHub release Sonar installs from,
// two per extension: <id>.json (the card with its archive's SHA-256, its folder's release/extension.json) and
// <id>.tar.gz (its folder's release/extension.tar.gz). Refuses a card the contract refuses, a folder not named by its
// card's id (Sonar reads the folder's name of the address …/tree/main/<folder> as the id; two folders never share an id
// then), and an archive whose SHA-256 is not its card's.
// And extensions.json, one file for all: the cards (each as its <id>.json) of the extensions catalog.json names, in its
// order. Sonar's screen Extensions reads it to offer the ones not installed yet. An extension left out of catalog.json,
// as the example to copy, is still published and installs by its address. Refuses an id of catalog.json without a
// folder.

import { copyFileSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import { readManifest } from "../vendor/sonar-extension/src/index";
import { extensions, root } from "./extensions";

const release = join(root, "release");
const built = extensions().map((folder) => {
	const name = basename(folder);
	const card = JSON.parse(readFileSync(join(folder, "release", "extension.json"), "utf8"));
	const reading = readManifest(card);
	if ("refusal" in reading) throw new Error(`${name}: the contract refuses its card: ${JSON.stringify(reading.refusal)}.`);
	const { id, version } = reading.manifest;
	if (id !== name) throw new Error(`${name}: its folder is not named by its card's id "${id}".`);
	const sha256 = new Bun.CryptoHasher("sha256").update(readFileSync(join(folder, "release", "extension.tar.gz"))).digest("hex");
	if (sha256 !== card.sha256) throw new Error(`${name}: its archive's SHA-256 is ${sha256}, its card says ${card.sha256}.`);
	return { folder, id, version, sha256, card };
});

const offered = (JSON.parse(readFileSync(join(root, "catalog.json"), "utf8")) as string[]).map((id) => {
	const one = built.find((each) => each.id === id);
	if (!one) throw new Error(`catalog.json names "${id}", which has no folder.`);
	return one.card;
});

rmSync(release, { recursive: true, force: true });
mkdirSync(release, { recursive: true });
for (const { folder, id, version, sha256 } of built) {
	copyFileSync(join(folder, "release", "extension.json"), join(release, `${id}.json`));
	copyFileSync(join(folder, "release", "extension.tar.gz"), join(release, `${id}.tar.gz`));
	console.log(`release/${id}.json and release/${id}.tar.gz: ${id} ${version}, sha256 ${sha256}`);
}
writeFileSync(join(release, "extensions.json"), `${JSON.stringify({ extensions: offered }, null, "\t")}\n`);
console.log(`release/extensions.json: ${offered.map((card) => card.id).join(", ")}`);
