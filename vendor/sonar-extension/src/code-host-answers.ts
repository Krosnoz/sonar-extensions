// What a code host provider an extension fills may give the core (CodeHostProvider of ./ports.ts), checked the same way
// by Sonar (apps/server/src/extensions/) and by the kit (./testing.ts): an extension that gives what Sonar refuses fails
// in its own tests as in Sonar. Bounds keep a host's answer from filling the cache or the page, and an access git cannot
// take out of the sessions. Plain functions: the kit imports nothing of Sonar.

import { fieldOf, isHttps, listOf, named, text } from "./answer-fields";
import type {
	CodeHostProvider,
	HostActivity,
	HostCheck,
	HostGitAccess,
	HostIssue,
	HostMergeable,
	HostPull,
	MergedPull,
	OpenPullLine,
	PullReading,
	TrackedBranchLine,
} from "./ports";
import { readyOf } from "./ticket-answers";

const NAME_MOST = 40;
const TITLE_MOST = 500;
const BODY_MOST = 65_536;
const WORD_MOST = 200;
const REF_MOST = 255;
// The greatest number a pull request or an issue may have.
const NUMBER_MOST = 2 ** 31;
const CHECKS_MOST = 100;
const ACTIVITY_MOST = 200;
const ISSUES_MOST = 100;
const MERGED_MOST = 1000;
const PULLS_MOST = 100;
const LABELS_MOST = 20;
// The branches one `tracked` call asks at most.
export const BRANCHES_MOST = 20;
const MERGED_SINCE_MOST = 10_000;
// A host as git's settings name it: the expression of HOST in packages/git/src/access-env.ts, copied, since the contract
// imports nothing of the core.
const HOST = /^[a-z0-9.-]+(:\d{1,5})?$/i;
const HOST_MOST = 253;
// A user name and a password go to git in a header: neither holds a space nor a control character.
const USERNAME = /^[^\s\p{C}]{1,200}$/u;
const PASSWORD = /^[^\s\p{C}]{1,4096}$/u;

const STATES: readonly HostPull["state"][] = ["OPEN", "MERGED", "CLOSED"];
const VERDICTS: readonly HostCheck["verdict"][] = ["passed", "failed", "pending", "skipped"];
const MERGEABLES: readonly HostMergeable[] = ["clean", "conflict", "behind", "blocked", "unknown"];
const KINDS: readonly HostActivity["kind"][] = ["review", "comment"];

// What Sonar says of an answer it refuses.
export const codeHostCannotRead = (call: string): string => `The extension's code host provider answered ${call} with what Sonar cannot read`;

const isOneOf = <A extends string>(words: readonly A[], value: unknown): value is A => words.some((each) => each === value);
const isCount = (value: unknown, most: number): value is number => typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= most;
const isNumber = (value: unknown): value is number => isCount(value, NUMBER_MOST) && value > 0;
// The page links to it as it is: nothing before its scheme.
const isAddress = (value: unknown): value is string => isHttps(value) && value.startsWith("https:");
const isInstant = (value: unknown): value is string => text(value, WORD_MOST) && Number.isFinite(Date.parse(value));
const isLogin = (value: unknown, form: RegExp): value is string => typeof value === "string" && form.test(value);

function checkOf(answer: unknown): HostCheck | undefined {
	const [name, state, verdict] = ["name", "state", "verdict"].map((key) => fieldOf(answer, key));
	return text(name, WORD_MOST) && text(state, WORD_MOST) && isOneOf(VERDICTS, verdict) ? { name, state, verdict } : undefined;
}

const checksOf = (answer: unknown): HostCheck[] | undefined => listOf(answer, CHECKS_MOST, checkOf);

function pullOf(answer: unknown): HostPull | undefined {
	const [number, url, title, state, draft, head] = ["number", "url", "title", "state", "draft", "head"].map((key) => fieldOf(answer, key));
	const checks = checksOf(fieldOf(answer, "checks"));
	if (!isNumber(number) || !isAddress(url) || !text(title, TITLE_MOST)) return undefined;
	if (!isOneOf(STATES, state) || typeof draft !== "boolean" || !checks) return undefined;
	if (!(head === undefined || text(head, REF_MOST))) return undefined;
	return { number, url, title, state, draft, checks, ...(head === undefined ? {} : { head }) };
}

function activityOf(answer: unknown): HostActivity | undefined {
	const [kind, author, state, body, at] = ["kind", "author", "state", "body", "at"].map((key) => fieldOf(answer, key));
	if (!isOneOf(KINDS, kind) || !text(author, WORD_MOST) || !text(state, WORD_MOST)) return undefined;
	// The core compares instants as texts (@sonar/code-host, changes.ts): one form for them all.
	return text(body, BODY_MOST) && isInstant(at) ? { kind, author, state, body, at: new Date(Date.parse(at)).toISOString() } : undefined;
}

function issueOf(answer: unknown): HostIssue | undefined {
	const [number, title, url, body] = ["number", "title", "url", "body"].map((key) => fieldOf(answer, key));
	return isNumber(number) && text(title, TITLE_MOST) && isAddress(url) && text(body, BODY_MOST) ? { number, title, url, body } : undefined;
}

function mergedPullOf(answer: unknown): MergedPull | undefined {
	const [createdAt, mergedAt, base] = ["createdAt", "mergedAt", "base"].map((key) => fieldOf(answer, key));
	return isInstant(createdAt) && isInstant(mergedAt) && text(base, REF_MOST) ? { createdAt, mergedAt, base } : undefined;
}

function openPullLineOf(answer: unknown): OpenPullLine | undefined {
	const [number, url, title, author, createdAt] = ["number", "url", "title", "author", "createdAt"].map((key) => fieldOf(answer, key));
	const [draft, mergeable, head] = ["draft", "mergeable", "head"].map((key) => fieldOf(answer, key));
	const labels = listOf(fieldOf(answer, "labels"), LABELS_MOST, (label) => (text(label, WORD_MOST) ? label : undefined));
	const checks = checksOf(fieldOf(answer, "checks"));
	if (!isNumber(number) || !isAddress(url) || !text(title, TITLE_MOST) || !text(author, WORD_MOST)) return undefined;
	if (!isInstant(createdAt) || typeof draft !== "boolean" || !isOneOf(MERGEABLES, mergeable)) return undefined;
	return text(head, REF_MOST) && labels && checks ? { number, url, title, author, createdAt, draft, labels, mergeable, head, checks } : undefined;
}

function branchLineOf(answer: unknown): TrackedBranchLine | undefined {
	const [name, mergedSince, ahead, url] = ["name", "mergedSince", "ahead", "url"].map((key) => fieldOf(answer, key));
	const pulls = listOf(fieldOf(answer, "pulls"), PULLS_MOST, openPullLineOf);
	if (typeof name !== "string" || !pulls || !isCount(mergedSince, MERGED_SINCE_MOST)) return undefined;
	if (!(url === undefined || isAddress(url))) return undefined;
	if (!(ahead === null || isCount(ahead, Number.MAX_SAFE_INTEGER))) return undefined;
	return { name, pulls, mergedSince, ahead, ...(url === undefined ? {} : { url }) };
}

export const repositoryNameOf = (answer: unknown): string | null | undefined => (answer === null || named(answer, WORD_MOST) ? answer : undefined);

export const hostAccountOf = (answer: unknown): string | undefined => (named(answer, WORD_MOST) ? answer : undefined);

// A pull request as one reading gives it, or null for none.
export function pullReadingOf(answer: unknown): PullReading | null | undefined {
	if (answer === null) return null;
	const pull = pullOf(fieldOf(answer, "pull"));
	const activity = listOf(fieldOf(answer, "activity"), ACTIVITY_MOST, activityOf);
	const [mergeable, base] = ["mergeable", "base"].map((key) => fieldOf(answer, key));
	return pull && activity && isOneOf(MERGEABLES, mergeable) && text(base, REF_MOST) ? { pull, mergeable, base, activity } : undefined;
}

export const hostIssuesOf = (answer: unknown): HostIssue[] | undefined => listOf(answer, ISSUES_MOST, issueOf);

export function openedPullOf(answer: unknown): { number: number; url: string } | undefined {
	const [number, url] = ["number", "url"].map((key) => fieldOf(answer, key));
	return isNumber(number) && isAddress(url) ? { number, url } : undefined;
}

export const pullStateOf = (answer: unknown): HostPull["state"] | undefined => (isOneOf(STATES, answer) ? answer : undefined);

export const mergedPullsOf = (answer: unknown): MergedPull[] | undefined => listOf(answer, MERGED_MOST, mergedPullOf);

// One answer per branch asked, in their order.
export function trackedOf(answer: unknown, branches: readonly string[]): TrackedBranchLine[] | undefined {
	const lines = listOf(answer, BRANCHES_MOST, branchLineOf);
	return lines?.length === branches.length && lines.every((line, at) => line.name === branches[at]) ? lines : undefined;
}

// The git access of a project's sessions, or null for the machine's own.
export function gitAccessOf(answer: unknown): HostGitAccess | null | undefined {
	if (answer === null) return null;
	const [host, username, password] = ["host", "username", "password"].map((key) => fieldOf(answer, key));
	if (!text(host, HOST_MOST) || !HOST.test(host)) return undefined;
	return isLogin(username, USERNAME) && isLogin(password, PASSWORD) ? { host, username, password } : undefined;
}

// What a code host provider lacks, by the first field missing or not of its type; null when it has all it needs.
export function codeHostRefusal(provider: CodeHostProvider): keyof CodeHostProvider | null {
	if (!named(provider.name, NAME_MOST)) return "name";
	const calls = ["ready", "repository", "account", "pullByUrl", "pullOfBranch", "issues", "openPull", "pullState", "merged", "tracked", "gitAccess"] as const;
	return calls.find((call) => typeof provider[call] !== "function") ?? null;
}

// One answer of the kit's provider, decoded, or the call fails as in Sonar.
async function read<A>(call: string, answer: Promise<unknown>, decode: (answer: unknown) => A | undefined): Promise<A> {
	const decoded = decode(await answer);
	if (decoded === undefined) throw new Error(codeHostCannotRead(call));
	return decoded;
}

// The provider as `provide.codeHost` keeps it: its `name` read once, so that an object changed later, or a getter read
// again, does not escape the check. Its calls go to the extension's object.
export function keptCodeHost(provider: CodeHostProvider): CodeHostProvider {
	return {
		name: provider.name,
		ready: (project) => provider.ready(project),
		repository: (project) => provider.repository(project),
		account: (project) => provider.account(project),
		pullByUrl: (project, url) => provider.pullByUrl(project, url),
		pullOfBranch: (project, folder, branch) => provider.pullOfBranch(project, folder, branch),
		issues: (project, label) => provider.issues(project, label),
		openPull: (project, pull) => provider.openPull(project, pull),
		pullState: (project, number) => provider.pullState(project, number),
		merged: (project, author, since) => provider.merged(project, author, since),
		tracked: (project, branches, since) => provider.tracked(project, branches, since),
		gitAccess: (project) => provider.gitAccess(project),
	};
}

// The provider as the kit gives it to a test: each answer Sonar refuses fails the call, with Sonar's words. It holds no
// delay over a call: Sonar does.
export function checkedCodeHost(provider: CodeHostProvider): CodeHostProvider {
	return {
		name: provider.name,
		ready: async (project) => read("ready", Promise.resolve(provider.ready(project)), readyOf),
		repository: (project) => read("repository", provider.repository(project), repositoryNameOf),
		account: (project) => read("account", provider.account(project), hostAccountOf),
		pullByUrl: (project, url) => read("pullByUrl", provider.pullByUrl(project, url), pullReadingOf),
		pullOfBranch: (project, folder, branch) => read("pullOfBranch", provider.pullOfBranch(project, folder, branch), pullReadingOf),
		issues: (project, label) => read("issues", provider.issues(project, label), hostIssuesOf),
		openPull: (project, pull) => read("openPull", provider.openPull(project, pull), openedPullOf),
		pullState: (project, number) => read("pullState", provider.pullState(project, number), pullStateOf),
		merged: (project, author, since) => read("merged", provider.merged(project, author, since), mergedPullsOf),
		tracked: (project, branches, since) => read("tracked", provider.tracked(project, branches, since), (answer) => trackedOf(answer, branches)),
		gitAccess: (project) => read("gitAccess", provider.gitAccess(project), gitAccessOf),
	};
}
