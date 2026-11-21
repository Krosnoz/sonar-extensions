// The questions asked to Jev, and how each of its answers is read: how urgent an agent's message is and which sentence
// sums it up, whether a reply is still fresh, whether a dictation corrects the request before it, which agents work on
// the same thing, a session's topic, and where a sentence said to the orb goes. As Sonar's plugin asked and read them.

import type { JudgedSession, JudgeRoute } from "@sonar/extension";
import { jevTexts } from "./i18n-questions";
import { sentencesOf } from "./sentences";
import type { Answers } from "./typesafe";

// One call to Jev, metered and within its budget: its answers only.
export type AskJev = (state: unknown, questions: Record<string, unknown>) => Promise<Answers>;

// Below this confidence, Jev's topic counts as none: the session waits for a better one.
const TOPIC_SURE = 0.6;
export const atStart = (name: string) => name.charAt(0).toUpperCase() + name.slice(1);
// Jev's choice is one of the criteria it was given; a missing or unknown one counts as the most general criterion.
const isCriterion = <K extends string>(criteria: Record<K, string>, choice: string | undefined): choice is K =>
	choice !== undefined && Object.hasOwn(criteria, choice);

export async function judge(ask: AskJev, user: string, agentName: string, message: string) {
	const sentences: Record<string, string> = Object.fromEntries(sentencesOf(message).map((sentence, i) => [`s${i}`, sentence]));
	const texts = jevTexts.judge(user);
	const questions: Record<string, unknown> = {
		urgency: { type: "score", ...texts.urgency },
		// A very short answer ("OK", a number) has no sentence, and TypeSafe refuses a question without a choice.
		status: { type: "choice", instructions: texts.status.instructions, criteria: { ...sentences, none: texts.status.none } },
	};
	const answers = await ask({ agent: agentName, message, sentences }, questions);
	return { urgency: answers["urgency"]?.score ?? 0, status: sentences[answers["status"]?.choice ?? ""] ?? "" };
}

export async function stillRelevant(ask: AskJev, user: string, answer: string, question: string, current: string) {
	const answers = await ask({ questionSeen: question, userAnswer: answer, agentMessageNow: current }, { fresh: { type: "noul", ...jevTexts.fresh(atStart(user)) } });
	return answers["fresh"]?.noul ?? 0;
}

export async function isCorrection(ask: AskJev, user: string, previous: string, next: string) {
	const answers = await ask({ currentRequest: previous, newMessage: next }, { correction: { type: "noul", ...jevTexts.correction(atStart(user)) } });
	return answers["correction"]?.noul ?? 0;
}

export async function relatedPairs(ask: AskJev, pairs: readonly (readonly [JudgedSession, JudgedSession])[]): Promise<number[]> {
	if (!pairs.length) return [];
	const questions = Object.fromEntries(
		pairs.map(([a, b], i) => [
			`p${i}`,
			{ type: "noul", instructions: { a: `${a.name} — ${a.summary}`, b: `${b.name} — ${b.summary}`, question: jevTexts.samePair } },
		]),
	);
	const answers = await ask({ pairs: pairs.length }, questions);
	return pairs.map((_, i) => answers[`p${i}`]?.noul ?? 0);
}

// The session's first request (`brief`) carries its topic; its last message often only tells the current step
// (starting a server, taking a capture), which looks like tooling.
export async function chooseTopic(
	ask: AskJev,
	agent: { readonly name: string; readonly branch: string; readonly brief: string; readonly ask: string | null; readonly summary: string },
	candidates: Readonly<Record<string, string>>,
): Promise<string | null> {
	const labels = Object.keys(candidates);
	const criteria = Object.fromEntries(labels.map((label, i) => [`t${i}`, `${label} : ${candidates[label]}`]));
	const answers = await ask(agent, {
		topic: { type: "choice", instructions: jevTexts.topic.instructions, criteria: { ...criteria, none: jevTexts.topic.none } },
	});
	const choice = answers["topic"]?.choice ?? "none";
	if (choice === "none" || (answers["topic"]?.confidence ?? 0) < TOPIC_SURE) return null;
	return labels[Number(choice.slice(1))] ?? null;
}

export async function route(
	ask: AskJev,
	user: string,
	text: string,
	agentNames: readonly string[],
	lastSpeaker: { readonly who: string; readonly text: string } | null,
): Promise<JudgeRoute> {
	const agents: Record<string, string> = Object.fromEntries(agentNames.map((name, i) => [`a${i}`, name]));
	const texts = jevTexts.route(user, atStart(user));
	const questions: Record<string, unknown> = {
		intent: { type: "choice", ...texts.intent },
		target: { type: "choice", instructions: texts.target.instructions, criteria: { ...agents, none: texts.target.none } },
	};
	if (lastSpeaker) questions["reply"] = { type: "noul", instructions: texts.reply };
	const startedAt = performance.now();
	// French keys: the French instructions name them as they are (see ./i18n-questions.ts).
	const answers = await ask({ phrase: text, agents, lastAgent: lastSpeaker?.who, whatItSaid: lastSpeaker?.text }, questions);
	const intent = answers["intent"]?.choice;
	return {
		intent: isCriterion(texts.intent.criteria, intent) ? intent : "ping",
		target: agents[answers["target"]?.choice ?? ""] ?? null,
		confidence: answers["intent"]?.confidence ?? 0,
		reply: answers["reply"]?.noul ?? 0,
		ms: Math.round(performance.now() - startedAt),
	};
}
