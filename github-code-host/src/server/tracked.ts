// The branches a project follows, in Sonar's words, from the one request of ./tracked-query.ts.

import type { HostMergeable, OpenPullLine, TrackedBranchLine } from "@sonar/extension";
import type { AskGitHub } from "./api";
import { checksOf } from "./checks";
import { fieldOf, isTextOrAbsent, nodesOf, nodesOrNone, numberOf, REF_MOST, textOf, textsOf, TITLE_MOST, WORD_MOST } from "./decode";
import type { Repository } from "./remote";
import { trackedQuery, trackedVariables } from "./tracked-query";

// GitHub merges these at once: its rules hold nothing back.
const MERGES = new Set(["CLEAN", "HAS_HOOKS", "UNSTABLE"]);

function mergeableOf(mergeable: string | undefined, status: string | undefined): HostMergeable {
	if (mergeable === "CONFLICTING" || status === "DIRTY") return "conflict";
	// GitHub says UNKNOWN while it works it out.
	if (!status || status === "UNKNOWN") return "unknown";
	if (MERGES.has(status)) return "clean";
	return status === "BEHIND" ? "behind" : "blocked";
}

function openOf(node: unknown, unnamed: string): OpenPullLine | undefined {
	const texts = textsOf(node, "url", "title", "createdAt");
	const number = numberOf(fieldOf(node, "number"));
	const draft = fieldOf(node, "isDraft");
	const [mergeable, status, head] = ["mergeable", "mergeStateStatus", "headRefName"].map((key) => fieldOf(node, key));
	const labels = nodesOrNone(fieldOf(node, "labels"), (label) => textOf(fieldOf(label, "name"))?.slice(0, WORD_MOST));
	const checks = checksOf(fieldOf(node, "commits"), unnamed);
	if (!texts || number === undefined || typeof draft !== "boolean" || !labels || !checks) return undefined;
	if (!isTextOrAbsent(mergeable) || !isTextOrAbsent(status) || !isTextOrAbsent(head)) return undefined;
	return {
		number,
		url: texts.url,
		title: texts.title.slice(0, TITLE_MOST),
		// A deleted account has no author.
		author: (textOf(fieldOf(fieldOf(node, "author"), "login")) ?? "?").slice(0, WORD_MOST),
		createdAt: texts.createdAt,
		draft,
		labels,
		mergeable: mergeableOf(mergeable, status),
		head: (head ?? "").slice(0, REF_MOST),
		checks,
	};
}

// `data`: the answer to the query for these branches. Null when GitHub does not show the repository.
function linesOf(data: unknown, branches: readonly string[], since: number, unnamed: string): Omit<TrackedBranchLine, "url">[] | null {
	const repository = fieldOf(data, "repository");
	if (typeof repository !== "object" || repository === null) return null;
	return branches.map((name, index) => {
		const pulls = nodesOf(fieldOf(repository, `open${index}`), (node) => openOf(node, unnamed)) ?? [];
		const merged = nodesOf(fieldOf(repository, `merged${index}`), (node) => ({ at: textOf(fieldOf(node, "mergedAt")) })) ?? [];
		const mergedSince = merged.filter(({ at }) => at && Date.parse(at) >= since).length;
		// The first branch asks for none; GitHub answers null for a branch it does not have.
		const ahead = numberOf(fieldOf(fieldOf(fieldOf(repository, `ref${index}`), "compare"), "aheadBy")) ?? null;
		return { name, pulls, mergedSince, ahead: index > 0 ? ahead : null };
	});
}

// GitHub's page of the pull requests open toward a branch.
const openToward = ({ owner, name }: Repository, branch: string) =>
	`https://github.com/${owner}/${name}/pulls?q=${encodeURIComponent(`is:pr is:open base:${branch}`)}`;

export async function trackedBranches(
	ask: AskGitHub,
	repository: Repository,
	branches: readonly string[],
	since: number,
	unnamed: string,
): Promise<TrackedBranchLine[]> {
	const data = await ask(trackedQuery(branches.length), trackedVariables(repository, branches));
	const lines = linesOf(data, branches, since, unnamed);
	if (!lines) throw new Error(`GitHub: ${repository.owner}/${repository.name} not found`);
	return lines.map((line) => ({ ...line, url: openToward(repository, line.name) }));
}
