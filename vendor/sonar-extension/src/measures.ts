// What Sonar measures, as the contract gives it to an extension (ServerApi of ./contract.ts): read only, as Sonar keeps it
// now. Times in milliseconds since 1970, days as YYYY-MM-DD in the user's time zone, every duration in milliseconds (its
// name ends in `Ms`). A session is named by its agent's session id (`sessionId`), never by its handle. Types only here;
// the core fills them (apps/server/src/extensions/reads.ts).

import type { ServerEvents } from "./contract";

// A read bounded in time: what happened at `since` or after.
export type Since = { readonly since: number };

// A read Sonar keeps for a while only, or that the user may stop measuring: its lines, and `from`, the oldest instant it
// covers, never before `since`. Every line from `from` on is there: an empty list is zero. null: Sonar does not measure
// it, noted nothing yet, or has not read it yet since it started. One exception: the user's minutes (presence) while
// they did not want their activity measured, before they wanted it again, have no line, though `from` is before them.
// A list within a line (UsageLine's `repliesMs`) is null when not measured: empty, it is zero too.
export type Covered<Line> = { readonly from: number | null; readonly lines: readonly Line[] };

// One session's work on one day, as its agent's files tell it. `folder`: its working folder, null when its files name
// none; `project`: that folder's project (a worktree's and a draft's included), null without a folder. `cost`: the API
// equivalent of its work, in dollars. `messages`: the messages its files give as the user's: the user's own, and those
// the agent's program writes in their place (an end-of-turn check's feedback, a notification). These are none: a tool's
// result, a message the agent's program adds without showing it in the conversation, a subagent's message, and the
// message Sonar sends to keep a session alive. `activeMs`: the time its files show work, pauses of 5 minutes or more
// left out. `lastAt`: its last activity that day. `ends`: its agent's turn ends; `sentBack`: those an end-of-turn check
// sent back to it. `repliesMs`: the user's reply delays, from an answer of its agent to the user's next message (neither
// feedback nor a notification), in the order its files wrote the messages. A delay too short or too long to be a reply
// (a message queued during the turn, a night) is not counted. On a day before Sonar counted them, `ends`, `sentBack` and
// `repliesMs` are 0 and empty: Sonar does not tell such a day from a day without any. `repliesMs` is null, not
// measured, while the user does not want their activity measured (setting `metrics`). Sonar decides it at the read:
// once the user wants it again, the delays of the days it was off are given too (not so for presence's minutes).
export type UsageLine = {
	readonly day: string;
	readonly sessionId: string;
	readonly folder: string | null;
	readonly project: string | null;
	readonly cost: number;
	readonly messages: number;
	readonly activeMs: number;
	readonly lastAt: number;
	readonly ends: number;
	readonly sentBack: number;
	readonly repliesMs: readonly number[] | null;
};

// The agent works from the message that starts its turn to the answer that ends it, then waits for the user until
// their next message. There may be gaps between two segments: their durations do not add up to the session's time.
export type TimelineSegment = { readonly kind: "work" | "wait"; readonly from: number; readonly to: number };

// A session's time from `since` to now, from its own files (its subagents' left out); no segment when none of them can be
// read. `touches`: when the user's messages came; null, not measured, while the user does not want their activity
// measured (setting `metrics`), decided at the read as UsageLine's `repliesMs`. `name`: the name Sonar showed for it, or
// its delegated task's title; null when Sonar knows none.
export type SessionTimeline = {
	readonly sessionId: string;
	readonly name: string | null;
	readonly segments: readonly TimelineSegment[];
	readonly touches: readonly number[] | null;
};

// A week of the user's velocity, Monday to Sunday (`start`). `prs`: the user's pull requests merged, as Sonar counts them.
// `leadMs`: their median time from opened to merged; null when `prs` is 0. In a project's weeks (Velocity's
// `projects[].weeks`), `prs` and `leadMs` are null when GitHub did not give the project's PRs: no GitHub repository set,
// no key, a key GitHub does not know, or GitHub failed. In Velocity's `weeks` (every project together), `prs` and
// `leadMs` count only the projects whose PRs GitHub gave, and are null when it gave none: read `projects` to know which.
// `commits`: the user's commits. `parallel`: the median, over the days the user wrote to an agent, of the sessions they
// wrote in. `replyMs`: the median of their reply delays. `parallel` and `replyMs` are null when there is nothing to
// count that week.
export type VelocityWeek = {
	readonly start: string;
	readonly prs: number | null;
	readonly leadMs: number | null;
	readonly commits: number;
	readonly parallel: number | null;
	readonly replyMs: number | null;
};

// The user's velocity over its last weeks, the oldest first: every project's (`weeks`), and each project with a
// repository's. `sonarSince`: the day of Sonar's first commit, null when unknown.
export type Velocity = {
	readonly sonarSince: string | null;
	readonly weeks: readonly VelocityWeek[];
	readonly projects: readonly { readonly project: string; readonly weeks: readonly VelocityWeek[] }[];
};

// What a project's agents proved, each past its threshold: its verification works, the user's corrections do not come
// back, few turn ends are sent back, few changes are undone once landed. Another proof may come in a later version: read
// one you do not know as unknown.
export type TrustProof = "verification" | "corrections" | "sentBack" | "reverts";

// A project's trust, as Sonar measured it last. `level`: 1 to prove, 2 in progress, 3 trusted; another level may
// come in a later version. `points`: the points of its verification's map; `working`: those whose last check worked.
export type ProjectTrust = {
	readonly project: string;
	readonly level: 1 | 2 | 3;
	readonly proofs: readonly TrustProof[];
	readonly points: number;
	readonly working: number;
};

// A task one session delegated to another. `sessionId`: the session it runs in, null until it starts;
// `parentSessionId`: the session that delegated it, null when Sonar does not know it. `project`: its folder's project.
// `state`: waiting its turn, at work, asking its parent, then done, failed (its time limit passed too) or stopped (by
// the user or its parent); another state may come in a later version. `startedAt`: when it was delegated; `endedAt`:
// null while it has not ended.
export type TaskLine = {
	readonly sessionId: string | null;
	readonly parentSessionId: string | null;
	readonly project: string;
	readonly state: "queued" | "running" | "question" | "done" | "failed" | "stopped";
	readonly startedAt: number;
	readonly endedAt: number | null;
};

// A minute the user spent on Sonar, marked by an open page (two pages in one minute count once). `at`: its start.
// `project`: the project shown, or the open session's; `sessionId`: the session open then. null: none.
export type PresenceMinute = { readonly at: number; readonly project: string | null; readonly sessionId: string | null };

// A session the user closed, as the event "session-closed" told it; `task`: it ran a delegated task.
export type ClosedSession = ServerEvents["session-closed"] & { readonly task: boolean };

// A branch that landed in its project's base branch through Sonar: the merge queue's, or one an agent announced.
// `firstPass`: no round of the queue set it aside, and no earlier merge of it stopped, since it last landed (a merge
// announced again is no setback).
export type LandedMerge = { readonly at: number; readonly project: string; readonly firstPass: boolean };

// One stop Sonar made by itself: a folder's commands, left behind by agents.
export type StoppedCommand = { readonly at: number; readonly project: string };
