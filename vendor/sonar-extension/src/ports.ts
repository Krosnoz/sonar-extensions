// The ports an extension fills: services the core calls, which an extension gives in place of a plugin (Manifest.provides
// and ServerApi.provide of ./contract.ts). Plain data and Promises, copied from the core's own ports, never imported from
// them: an extension built once keeps working while the core changes.
//
// A call that rejects with an Error bearing `off: true` (Object.assign(new Error("…"), { off: true })) tells the core the
// port is off: it does without the answer, as with no extension at all. Any other rejection is a failure the core logs.

// The ports of the core an extension may fill (PORTS of ./rules.ts).
export type Port = "judge";

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
