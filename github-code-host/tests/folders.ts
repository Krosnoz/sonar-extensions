// The folders the tests give the extension: real git repositories, all in one temporary folder, removed once every
// test ran (./preload.ts). Their files are written here, so that only the extension starts git.

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

let root: string | undefined;
let made = 0;

export function removeFolders() {
	if (root) rmSync(root, { recursive: true, force: true });
	root = undefined;
}

// Writes the config of a folder's repository, whose "origin" is `origin`; without one, it has no remote.
export function setOrigin(folder: string, origin?: string) {
	const remote = origin ? `[remote "origin"]\n\turl = ${origin}\n` : "";
	writeFileSync(join(folder, ".git", "config"), `[core]\n\trepositoryformatversion = 0\n${remote}`);
}

// A new repository.
export function folderWith(origin?: string): string {
	root ??= mkdtempSync(join(tmpdir(), "github-folders-"));
	const folder = join(root, String(++made));
	for (const part of ["objects", "refs"]) mkdirSync(join(folder, ".git", part), { recursive: true });
	writeFileSync(join(folder, ".git", "HEAD"), "ref: refs/heads/main\n");
	setOrigin(folder, origin);
	return folder;
}
