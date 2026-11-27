// The GitHub repository of a folder: its "origin" remote's owner and name (an https or ssh address); none outside
// GitHub. Kept by folder: a worktree's remote does not change, and Sonar asks again every 2 minutes. Asked to git
// without holding the server: git takes seconds on a loaded machine.

import { execFile } from "node:child_process";

export type Repository = { readonly owner: string; readonly name: string };

// An owner or a repository's name, as GitHub writes them.
const PART = "[A-Za-z0-9._-]+";
// The host is GitHub's own, never one whose name only holds it: github.com, or ssh.github.com (ssh over the https
// port), after a scheme or in git's short ssh form.
const HOST = "(?:[^/@\\s]+@)?(?:ssh\\.)?github\\.com";
const ADDRESS = new RegExp(`^(?:(?:https?|ssh|git)://${HOST}(?::\\d+)?/|${HOST}:)(${PART}?)/(${PART}?)(?:\\.git)?/?$`, "i");
const NAMED = new RegExp(`^(${PART})/(${PART})$`);

const found = (match: RegExpExecArray | null): Repository | null => (match?.[1] && match[2] ? { owner: match[1], name: match[2] } : null);

// A repository written "owner/name", and nothing else around.
export const named = (value: unknown): Repository | null => (typeof value === "string" ? found(NAMED.exec(value)) : null);

// The repository a remote's address names; none for an address outside GitHub.
const addressed =(address: string): Repository | null => found(ADDRESS.exec(address.trim()));

// A folder that does not exist, one without git or without "origin": no repository.
const read = (folder: string) =>
	new Promise<Repository | null>((resolve) => {
		execFile("git", ["-C", folder, "remote", "get-url", "origin"], { windowsHide: true }, (failure, out) => resolve(failure ? null : addressed(String(out))));
	});

export function originReader(): (folder: string) => Promise<Repository | null> {
	const known = new Map<string, Promise<Repository | null>>();
	return (folder) => {
		const kept = known.get(folder);
		if (kept) return kept;
		const repository = read(folder);
		known.set(folder, repository);
		return repository;
	};
}
