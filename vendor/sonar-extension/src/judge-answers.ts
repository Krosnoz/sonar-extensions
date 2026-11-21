// What a judge an extension fills may give the core (JudgeProvider of ./ports.ts), checked the same way by Sonar
// (apps/server/src/extensions/judge-port.ts) and by the kit (./testing.ts): an extension that gives what Sonar refuses
// fails in its own tests as in Sonar. The bounds are the plugin Jev's own: a probability from 0 to 1, an urgency on its
// three levels, a sentence picked from the message, never written. Plain functions: the kit imports nothing of Sonar.

import type { JudgeProvider, JudgeRoute } from "./ports";

// The name of the key a judge lends and takes (`lentAs`).
const LENT_NAME = /^[a-z0-9-]{2,40}$/;
// A key lent: 1 to 512 characters, none a space nor a control character.
const LENT_KEY = /^[^\s\p{C}]{1,512}$/u;
// The most urgent: the plugin's urgency is a level from 0 (may wait days) to 2 (blocks a work or touches production).
export const URGENCY_MOST = 2;
const INTENTS: readonly JudgeRoute["intent"][] = ["ping", "open", "next", "fit"];

// The names the core lends itself with a session it runs on a linked computer: the Claude key (`token`,
// apps/server/src/claude-code/layer.ts#lentKeyOf), and what the other computer reads beside it (keyIn of
// plugins/claude-code/src/agent/launch.ts, withProfile of apps/server/src/peers/lent-profile.ts, and `memory` of
// apps/host/src/sessions/granted.ts). A judge's key never goes under one of them: it would take the Claude key's place.
// The name the host relays (`typesafe`) is not one: a judge lends under it.
export const CORE_LENT_NAMES: readonly string[] = ["token", "configDir", "profile", "mcp", "memory"];

// The judge as `provide.judge` takes it, before its check: its `lentAs` and `lend` read once, so that an object changed
// later, or a getter read again, does not escape the check. Its calls go to the extension's object.
export function keptJudge(provider: JudgeProvider): JudgeProvider {
	const lentAs = provider.lentAs;
	const lend = provider.lend?.bind(provider);
	return {
		judge: (...asked) => provider.judge(...asked),
		stillRelevant: (...asked) => provider.stillRelevant(...asked),
		isCorrection: (...asked) => provider.isCorrection(...asked),
		relatedPairs: (...asked) => provider.relatedPairs(...asked),
		chooseTopic: (...asked) => provider.chooseTopic(...asked),
		route: (...asked) => provider.route(...asked),
		yesOrNo: (...asked) => provider.yesOrNo(...asked),
		...(lend ? { lend } : {}),
		...(lentAs !== undefined ? { lentAs } : {}),
	};
}

// Why Sonar refuses a judge given to `provide.judge`: it lends a key without naming it ("lend-unnamed"), names it out
// of form ("lent-as") or as a key the core lends ("lent-as-core"); null when it takes it.
export function judgeRefusal(provider: JudgeProvider): "lend-unnamed" | "lent-as" | "lent-as-core" | null {
	const { lentAs } = provider;
	if (lentAs === undefined) return provider.lend ? "lend-unnamed" : null;
	if (typeof lentAs !== "string" || !LENT_NAME.test(lentAs)) return "lent-as";
	return CORE_LENT_NAMES.includes(lentAs) ? "lent-as-core" : null;
}

// The name of the one lent key a linked computer's host relays: a copy of LENT_JUDGE_NAME of @sonar/domain, held to it
// by tests/extension-testing-kit-judge.test.ts.
export const RELAYED_LENT_NAME = "typesafe";

// The end-of-turn check's yes or no, as Sonar asks it: a key another Sonar lent goes to a judge of the relayed name alone,
// never to a service the user did not choose.
export const askYesOrNo = (provider: JudgeProvider, ...[message, key, question, lentKey]: Parameters<JudgeProvider["yesOrNo"]>): Promise<number> =>
	lentKey && provider.lentAs === RELAYED_LENT_NAME ? provider.yesOrNo(message, key, question, lentKey) : provider.yesOrNo(message, key, question);

// The key `lend()` gave, when it is one Sonar lends; undefined otherwise (null, out of form).
export const lentKeyOf = (value: unknown): string | undefined => (typeof value === "string" && LENT_KEY.test(value) ? value : undefined);

// What Sonar says of an answer it refuses.
export const cannotRead = (call: string): string => `The extension's judge answered ${call} with what Sonar cannot read`;

const fieldOf = (value: unknown, key: string): unknown => (typeof value === "object" && value !== null ? Reflect.get(value, key) : undefined);
const within = (value: unknown, most: number): value is number => typeof value === "number" && value >= 0 && value <= most;
const isIntent = (value: unknown): value is JudgeRoute["intent"] => INTENTS.some((each) => each === value);

// The core's sentences of a message, as the plugin picks among them, and a judge an extension fills too: a copy of
// sentencesOf of @sonar/domain, held to it by tests/extension-judge-sentences.test.ts.
const plain = (text: string): string =>
	text
		.replace(/\*\*|__|`|^#+\s*|^\s*[-*>]\s+|\|/gm, "")
		.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
		.trim();
export const messageSentences = (text: string): string[] =>
	text
		.split("\n")
		.flatMap((line) => plain(line).match(/[^.!?]+[.!?]*/g) ?? [])
		.map((sentence) => sentence.trim())
		.filter((sentence) => sentence.length > 3)
		.slice(-40);

// Each answer as the core reads it, or undefined when Sonar refuses it.
export const probabilityOf = (answer: unknown): number | undefined => (within(answer, 1) ? answer : undefined);

// `status`: one of the message's sentences, or "" for none (the card then shows its first). A sentence Sonar does not
// split so is left out, the urgency kept: nothing the judge wrote is shown, and the card is not asked again.
export function judgmentOf(answer: unknown, message: string): { urgency: number; status: string } | undefined {
	const urgency = fieldOf(answer, "urgency");
	const status = fieldOf(answer, "status");
	if (!within(urgency, URGENCY_MOST) || typeof status !== "string") return undefined;
	return { urgency, status: messageSentences(message).includes(status) ? status : "" };
}

// One probability per pair, in their order.
export function pairScoresOf(answer: unknown, pairs: number): number[] | undefined {
	if (!Array.isArray(answer) || answer.length !== pairs) return undefined;
	const scores = answer.map(probabilityOf);
	return scores.every((each) => each !== undefined) ? scores : undefined;
}

export const topicOf = (answer: unknown, candidates: Readonly<Record<string, string>>): string | null | undefined =>
	answer === null ? null : typeof answer === "string" && Object.hasOwn(candidates, answer) ? answer : undefined;

// `target`: null, or one of the sessions named.
export function routeOf(answer: unknown, agentNames: readonly string[]): JudgeRoute | undefined {
	const [intent, target, confidence, reply, ms] = ["intent", "target", "confidence", "reply", "ms"].map((key) => fieldOf(answer, key));
	if (!isIntent(intent) || !(target === null || (typeof target === "string" && agentNames.includes(target)))) return undefined;
	if (!within(confidence, 1) || !within(reply, 1) || !within(ms, Number.MAX_SAFE_INTEGER)) return undefined;
	return { intent, target, confidence, reply, ms };
}

// One answer of the kit's judge, decoded, or the call fails as in Sonar.
async function read<A>(call: string, answer: Promise<unknown>, decode: (answer: unknown) => A | undefined): Promise<A> {
	const decoded = decode(await answer);
	if (decoded === undefined) throw new Error(cannotRead(call));
	return decoded;
}

// The judge as the kit gives it to a test: each answer Sonar refuses fails the call, with Sonar's words; a key out of
// form lends nothing. It holds no delay over a call: Sonar does.
export function checkedJudge(provider: JudgeProvider): JudgeProvider {
	return {
		judge: (agentName, message) => read("judge", provider.judge(agentName, message), (answer) => judgmentOf(answer, message)),
		stillRelevant: (answer, question, current) => read("stillRelevant", provider.stillRelevant(answer, question, current), probabilityOf),
		isCorrection: (previous, next) => read("isCorrection", provider.isCorrection(previous, next), probabilityOf),
		relatedPairs: (pairs) => read("relatedPairs", provider.relatedPairs(pairs), (answer) => pairScoresOf(answer, pairs.length)),
		chooseTopic: (agent, candidates) => read("chooseTopic", provider.chooseTopic(agent, candidates), (answer) => topicOf(answer, candidates)),
		route: (text, agentNames, lastSpeaker) => read("route", provider.route(text, agentNames, lastSpeaker), (answer) => routeOf(answer, agentNames)),
		yesOrNo: (...asked) => read("yesOrNo", askYesOrNo(provider, ...asked), probabilityOf),
		...(provider.lend ? { lend: async () => lentKeyOf(await provider.lend?.()) ?? null } : {}),
		...(provider.lentAs !== undefined ? { lentAs: provider.lentAs } : {}),
	};
}
