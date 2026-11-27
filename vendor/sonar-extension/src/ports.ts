// The ports an extension fills: services the core calls, which an extension gives in place of a plugin (Manifest.provides
// and ServerApi.provide of ./contract.ts). Plain data and Promises, copied from the core's own ports, never imported from
// them: an extension built once keeps working while the core changes.
//
// A call that rejects with an Error bearing `off: true` (Object.assign(new Error("…"), { off: true })) tells the core the
// port is off: it does without the answer, as with no extension at all. A rejection with an Error bearing `refused: true`
// tells the core the tracker or the code host refused the project's key (tickets, codeHost). Any other rejection is a
// failure the core logs.

// The ports of the core an extension may fill (PORTS of ./rules.ts).
export type Port = "judge" | "tickets" | "codeHost";

// A session, as the judge reads it beside another one: its name and what it does.
export type JudgedSession = { readonly name: string; readonly summary: string };

// Where a sentence said to the orb goes: Ping, a session to open, the next one, or the view fitted to the screen;
// `target` the session named (one of `agentNames`), null when none; `confidence` and `reply` from 0 to 1 (`reply`: the
// sentence answers the last speaker); `ms` how long the judgment took.
export type JudgeRoute = {
	readonly intent: "ping" | "open" | "next" | "fit";
	readonly target: string | null;
	readonly confidence: number;
	readonly reply: number;
	readonly ms: number;
};

// The judge of what agents and the user say (an extension fills it, as typesafe-jev does). Each probability goes from 0 to 1.
export type JudgeProvider = {
	// How urgently an agent waits for the user, from 0 (may wait days) to 2 (blocks a work or touches production), and
	// which of its message's sentences its card shows (`status`, one of messageSentences(message) of ./judge-answers.ts;
	// "" for none): a judge picks a sentence, it never writes one. Another sentence is left out, the urgency kept.
	readonly judge: (agentName: string, message: string) => Promise<{ readonly urgency: number; readonly status: string }>;
	// The probability that the user's answer to `question` still fits what the agent says now.
	readonly stillRelevant: (answer: string, question: string, current: string) => Promise<number>;
	// The probability that a new dictation corrects the request before it.
	readonly isCorrection: (previous: string, next: string) => Promise<number>;
	// For each pair, the probability that both sessions are on the same thing: one number per pair, in their order.
	readonly relatedPairs: (pairs: readonly (readonly [JudgedSession, JudgedSession])[]) => Promise<readonly number[]>;
	// A session's topic: one key of `candidates` (key → description), null when none fits or the judge is unsure.
	readonly chooseTopic: (
		agent: { readonly name: string; readonly branch: string; readonly brief: string; readonly ask: string | null; readonly summary: string },
		candidates: Readonly<Record<string, string>>,
	) => Promise<string | null>;
	readonly route: (text: string, agentNames: readonly string[], lastSpeaker: { readonly who: string; readonly text: string } | null) => Promise<JudgeRoute>;
	// The probability of yes for the end-of-turn check of a session: `key` names the question, `question` says what yes
	// and no mean. `lentKey`: the judge's key another Sonar lent the session it runs here, to use in place of its own.
	readonly yesOrNo: (
		message: string,
		key: string,
		question: { readonly instructions: string; readonly criteria: { readonly true: string; readonly false: string } },
		lentKey?: string,
	) => Promise<number>;
	// The key this Sonar lends with a session it runs on a linked computer, so that the end-of-turn check there judges as
	// here; null when it has none. From 1 to 512 characters, none a space or a control character, within 2 s: else
	// nothing is lent. A judge that lends names its key (`lentAs`).
	readonly lend?: () => Promise<string | null>;
	// The name of the key it lends and takes: 2 to 40 characters, lower case letters, digits and "-" ("typesafe" for
	// TypeSafe's, as the extension typesafe-jev lends it). Its `lend` goes under that name, and `yesOrNo` gets `lentKey` only from a
	// judge of the same name on the other computer: a key never reaches a service the user did not choose. Today the
	// linked computer runs a lent key named "typesafe" alone.
	readonly lentAs?: string;
};

export type Ticket = {
	readonly id: string;
	readonly title: string;
	readonly url: string;
	readonly state: string;
	readonly stateType: string;
	readonly color: string;
	readonly assignee: string | null;
};
export type TicketState = { readonly id: string; readonly name: string; readonly type: string; readonly color: string };

// A ticket tracker (Jira, Trello…), as an extension gives it. The core keeps the rest: the cache, the links between
// sessions and tickets, the search of a ticket in a session's texts, the agents that write a ticket.
export type TicketsProvider = {
	// The tracker's name, as the page says it ("Jira"): 1 to 40 characters.
	readonly name: string;
	// Whether the project can reach the tracker (a key saved): false, nothing is asked.
	readonly ready: (project: string) => boolean | Promise<boolean>;
	// The workspace the project reaches: its name and its teams' prefixes ("ABC" of "ABC-12").
	readonly workspace: (project: string) => Promise<{ readonly name: string; readonly teams: readonly string[] }>;
	// One answer per id, in their order; null for a ticket the tracker does not know.
	readonly tickets: (project: string, ids: readonly string[]) => Promise<readonly (Ticket | null)[]>;
	// Tickets to link: the user's own open ones, then the workspace's recently updated open ones.
	readonly candidates: (project: string) => Promise<readonly Ticket[]>;
	readonly states: (project: string, id: string) => Promise<readonly TicketState[]>;
	readonly setState: (project: string, id: string, stateId: string) => Promise<void>;
};

// A check of a pull request's CI: its name, the host's own word for its state (shown as it is), and its verdict in
// Sonar's words. A check cancelled or skipped tells nothing.
export type HostCheck = { readonly name: string; readonly state: string; readonly verdict: "passed" | "failed" | "pending" | "skipped" };
// Whether a pull request merges into its base as it is: "conflict" stops it, "behind" lacks its base's last commits,
// "blocked" waits for the host's rules (a review), "unknown" while the host computes it.
export type HostMergeable = "clean" | "conflict" | "behind" | "blocked" | "unknown";
// A pull request as one reading gives it. `head`: its last commit, by which a squash merge is found in a worktree.
export type HostPull = {
	readonly number: number;
	readonly url: string;
	readonly title: string;
	readonly state: "OPEN" | "MERGED" | "CLOSED";
	readonly draft: boolean;
	readonly checks: readonly HostCheck[];
	readonly head?: string;
};
// A review or a comment; a review still being written is not given. `at`: an ISO 8601 instant.
export type HostActivity = { readonly kind: "review" | "comment"; readonly author: string; readonly state: string; readonly body: string; readonly at: string };
// What a reading tells beyond the pull request: how it merges, the branch it merges into, its activity, oldest first.
export type PullReading = { readonly pull: HostPull; readonly mergeable: HostMergeable; readonly base: string; readonly activity: readonly HostActivity[] };
// An open issue the user handed over to Sonar's agents.
export type HostIssue = { readonly number: number; readonly title: string; readonly url: string; readonly body: string };
// A pull request merged, for the velocity: when it opened and merged (ISO 8601), the branch it merged into.
export type MergedPull = { readonly createdAt: string; readonly mergedAt: string; readonly base: string };
// A pull request open toward a branch the project follows.
export type OpenPullLine = {
	readonly number: number;
	readonly url: string;
	readonly title: string;
	readonly author: string;
	readonly createdAt: string;
	readonly draft: boolean;
	readonly labels: readonly string[];
	readonly mergeable: HostMergeable;
	readonly head: string;
	readonly checks: readonly HostCheck[];
};
// A branch the project follows: its open pull requests, how many merged into it since the moment asked, and the commits
// of the branch before it that it lacks (null for the first, or a branch the host does not have). `url`: the host's
// page of those open pull requests; without one, the branch links to nothing.
export type TrackedBranchLine = {
	readonly name: string;
	readonly pulls: readonly OpenPullLine[];
	readonly mergedSince: number;
	readonly ahead: number | null;
	readonly url?: string;
};
// The https access the project's sessions give git for the host: a header for each request to `host`.
export type HostGitAccess = { readonly host: string; readonly username: string; readonly password: string };

// A code host (GitHub, GitLab, Forgejo…), as an extension gives it. Each call takes the project's name: the extension
// reads its own key (keys.read). The core keeps the rest: the cache of readings, the watch of a pull request, the issues
// taken, the velocity, the merges by pull request, the branches followed.
export type CodeHostProvider = {
	// The host's name, as the page says it ("GitHub"): 1 to 40 characters.
	readonly name: string;
	// Whether the project reaches the host (a key saved): false, nothing else is asked. The repository is asked apart (`repository`).
	readonly ready: (project: string) => boolean | Promise<boolean>;
	// The project's repository as the page names it ("owner/name"); null when the project has none on this host.
	readonly repository: (project: string) => Promise<string | null>;
	// The account the project's key opens.
	readonly account: (project: string) => Promise<string>;
	// A pull request by its address; null for one the host does not show.
	readonly pullByUrl: (project: string, url: string) => Promise<PullReading | null>;
	// The pull request of a folder's branch: the open one, else the latest; null without one.
	readonly pullOfBranch: (project: string, folder: string, branch: string) => Promise<PullReading | null>;
	// The open issues that carry `label`, the oldest first, put by a person who can write in the repository.
	readonly issues: (project: string, label: string) => Promise<readonly HostIssue[]>;
	// The pull request of a branch already on the host: the one open, else a new one.
	readonly openPull: (
		project: string,
		pull: { readonly base: string; readonly head: string; readonly title: string; readonly body: string },
	) => Promise<{ readonly number: number; readonly url: string }>;
	readonly pullState: (project: string, number: number) => Promise<"OPEN" | "MERGED" | "CLOSED">;
	// The author's pull requests merged since `since` (a day, as 2026-09-07).
	readonly merged: (project: string, author: string, since: string) => Promise<readonly MergedPull[]>;
	// One answer per branch, in their order; `since`: the moment (ms) from which merges are counted.
	readonly tracked: (project: string, branches: readonly string[], since: number) => Promise<readonly TrackedBranchLine[]>;
	// The git access of the project's sessions; null to let them use the machine's own.
	readonly gitAccess: (project: string) => Promise<HostGitAccess | null>;
};
