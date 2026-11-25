// What the routes answer, field for field the answers of Sonar's own statistics (GET /api/stats, /api/stats/project and
// /api/stats/tasks), so that a page written for those reads these. Week by week, Monday to Sunday, 9 weeks as the
// velocity. null: not measured that week (the measure did not exist yet, or nothing to measure). Where the contract
// gives less than Sonar's own statistics read (README, "What differs when activity is not measured"), a field may be
// null where Sonar's is a number: `waitedMs`, a strip's `interventions` and `touches`.

export type StatsWeek = {
	readonly start: string;
	// The user's pull requests merged; their median time from opened to merged, in hours.
	readonly prs: number;
	readonly leadHours: number | null;
	readonly commits: number;
	// Median over active days of the sessions the user wrote in; median reply delay, in seconds.
	readonly parallel: number | null;
	readonly reply: number | null;
	// API equivalent of the agents' work, in dollars.
	readonly cost: number;
	// Sessions the agents worked in; the user's messages to them.
	readonly sessions: number;
	readonly interventions: number;
	readonly agentMs: number;
	// From the end of an agent's answer to the user's next message.
	readonly waitedMs: number | null;
	// Turn ends, and those an end-of-turn check sent back to the agent.
	readonly ends: number;
	readonly sentBack: number;
	readonly humanMs: number | null;
	// Sessions closed by the user, delegated tasks aside.
	readonly closed: number | null;
	// Branches merged through Sonar, and those never set aside before.
	readonly landed: number | null;
	readonly firstPass: number | null;
	readonly tasksEnded: number | null;
	readonly tasksFailed: number | null;
	// Commands left by agents that Sonar stopped.
	readonly strays: number | null;
};

export type TrustLevel = 1 | 2 | 3;

// A project's trust, as the contract gives it (projects.trust): its level, its proofs past their threshold, and its
// verification's points. Sonar's own statistics give every measure behind the proofs too; the contract does not.
export type StatsTrust = {
	readonly level: TrustLevel;
	readonly proofs: { readonly verification: boolean; readonly corrections: boolean; readonly sentBack: boolean; readonly reverts: boolean };
	readonly measures: { readonly verification: { readonly points: number; readonly working: number } };
};

// sonarSince: the day of Sonar's first commit, "" unknown. allCost: every project's cost each week, for a project's share.
export type ProjectStats = {
	readonly project: string;
	readonly sonarSince: string;
	readonly updatedAt: number;
	readonly weeks: readonly StatsWeek[];
	readonly allCost: readonly number[];
	readonly trust: StatsTrust | null;
};

// level: the project's trust level, null without a folder to read it from.
export type GlobalStats = {
	readonly sonarSince: string;
	readonly updatedAt: number;
	readonly weeks: readonly StatsWeek[];
	readonly projects: readonly { readonly project: string; readonly level: TrustLevel | null; readonly weeks: readonly StatsWeek[] }[];
};

export type Segment = { readonly kind: "work" | "wait"; readonly from: number; readonly to: number };

// A session of the project, its time on a strip from `from` to `to`: the agent works, it waits for the user;
// `touches`: the user's messages.
export type StatsTask = {
	readonly session: string;
	readonly name: string;
	readonly cost: number;
	readonly agentMs: number;
	readonly waitedMs: number;
	readonly humanMs: number;
	readonly interventions: number | null;
	readonly from: number;
	readonly to: number;
	readonly segments: readonly Segment[];
	readonly touches: readonly number[] | null;
};
