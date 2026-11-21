// Jev's judgments as Sonar's judge asks them: the questions sent to TypeSafe, and how each answer is read back into a
// card's sentence and urgency, a reply's freshness, a correction, pairs of agents, a topic and a route. As Sonar's
// tests/judgments.test.ts on its plugin.

import { afterAll, beforeEach, expect, test } from "bun:test";
import { jevTexts } from "../src/i18n-questions";
import { answering, fakeTypeSafe, neutral } from "./fake-typesafe";
import { started } from "./support";

const typesafe = fakeTypeSafe();
afterAll(() => typesafe.stop());
beforeEach(() => {
	typesafe.asked.length = 0;
	typesafe.answer = neutral;
});

const MESSAGE = "J'ai corrigé le test de facturation.\nJe peux merger la PR #2040 maintenant ?\n\n1. Merger\n2. Attendre la CI";

test("judges a message: its urgency, and the sentence it picks quoted as it is; only these two questions, with the key", async () => {
	const { judge } = await started(typesafe);
	typesafe.answer = answering(() => ({ urgency: { score: 0.4 }, status: { choice: "s0" } }));
	expect(await judge.judge("Billing", MESSAGE)).toEqual({ urgency: 0.4, status: "J'ai corrigé le test de facturation." });
	const [asked] = typesafe.asked;
	expect(asked?.authorization).toBe("Bearer test-key");
	expect(asked?.model).toBe("jev-latest");
	expect(asked?.state).toMatchObject({ agent: "Billing", message: MESSAGE, sentences: { s0: "J'ai corrigé le test de facturation." } });
	expect(Object.keys(asked?.questions ?? {})).toEqual(["urgency", "status"]);
	expect(asked?.questions["urgency"]).toEqual({ type: "score", ...jevTexts.judge("alex").urgency });
	// The user's name in the questions; the sentences as choices, and none.
	expect(String(asked?.questions["urgency"]?.instructions)).toContain("urgente pour alex ?");
	expect(asked?.questions["status"]?.criteria).toMatchObject({ s0: "J'ai corrigé le test de facturation.", none: jevTexts.judge("alex").status.none });
});

test("a judgment Jev leaves out: no urgency, and no sentence for none or a choice it was not given", async () => {
	const { judge } = await started(typesafe);
	expect(await judge.judge("Billing", MESSAGE)).toEqual({ urgency: 0, status: "" });
	typesafe.answer = answering(() => ({ status: { choice: "s99" } }));
	expect(await judge.judge("Billing", MESSAGE)).toEqual({ urgency: 0, status: "" });
});

test("a message with a bullet: Jev picks among the sentences as Sonar cuts them, and Sonar shows the one it picks", async () => {
	const { judge } = await started(typesafe);
	typesafe.answer = answering(() => ({ urgency: { score: 1 }, status: { choice: "s1" } }));
	expect(await judge.judge("Billing", "Merged.\n- Everything passes.")).toEqual({ urgency: 1, status: "Everything passes." });
	expect(typesafe.asked[0]?.state["sentences"]).toEqual({ s0: "Merged.", s1: "Everything passes." });
});

test("freshness, correction, pairs, a topic among the candidates when Jev is sure, a route", async () => {
	const { judge } = await started(typesafe);
	typesafe.answer = answering(({ questions, state }) => {
		if (questions["fresh"]) return { fresh: { noul: 0.3 } };
		if (questions["correction"]) return { correction: { noul: 0.9 } };
		if (questions["p0"]) return { p0: { noul: 0.8 }, p1: { noul: 0.69 } };
		if (questions["topic"]) return { topic: { choice: "t1", confidence: state["brief"] === "billing" ? 0.8 : 0.5 } };
		return { intent: { choice: "open", confidence: 0.92 }, target: { choice: "a1" }, reply: { noul: 0.1 } };
	});
	expect(await judge.stillRelevant("oui", "Je merge ?", "J'ai mergé.")).toBe(0.3);
	expect(typesafe.asked.at(-1)).toMatchObject({
		state: { questionSeen: "Je merge ?", userAnswer: "oui", agentMessageNow: "J'ai mergé." },
		questions: { fresh: { type: "noul", ...jevTexts.fresh("Alex") } },
	});
	expect(await judge.isCorrection("résume la PR", "non, arrête")).toBe(0.9);
	expect(typesafe.asked.at(-1)).toMatchObject({
		state: { currentRequest: "résume la PR", newMessage: "non, arrête" },
		questions: { correction: { type: "noul", ...jevTexts.correction("Alex") } },
	});
	const [a, b, c] = [
		{ name: "A", summary: "billing" },
		{ name: "B", summary: "billing" },
		{ name: "C", summary: "billing too" },
	];
	expect(
		await judge.relatedPairs([
			[a, b],
			[b, c],
		]),
	).toEqual([0.8, 0.69]);
	expect(typesafe.asked.at(-1)).toMatchObject({
		state: { pairs: 2 },
		questions: { p1: { type: "noul", instructions: { a: "B — billing", b: "C — billing too", question: jevTexts.samePair } } },
	});
	const topicOf = (brief: string) => judge.chooseTopic({ name: "A", branch: "feat/x", brief, ask: null, summary: "" }, { Billing: "stripe", Tooling: "scripts" });
	expect(await topicOf("billing")).toBe("Tooling");
	expect(typesafe.asked.at(-1)?.questions["topic"]?.criteria).toEqual({ t0: "Billing : stripe", t1: "Tooling : scripts", none: jevTexts.topic.none });
	expect(await topicOf("unsure")).toBeNull();
	expect(await judge.route("montre B", ["A", "B"], { who: "A", text: "Je merge ?" })).toMatchObject({ intent: "open", target: "B", confidence: 0.92, reply: 0.1 });
	expect(typesafe.asked.at(-1)).toMatchObject({
		state: { phrase: "montre B", agents: { a0: "A", a1: "B" }, lastAgent: "A", whatItSaid: "Je merge ?" },
		questions: { intent: { type: "choice", ...jevTexts.route("alex", "Alex").intent }, reply: { type: "noul" } },
	});
});

test("no pair asks nothing; a topic Jev says none of, or one it was not given, is none", async () => {
	const { judge } = await started(typesafe);
	expect(await judge.relatedPairs([])).toEqual([]);
	expect(typesafe.asked).toHaveLength(0);
	const agent = { name: "A", branch: "main", brief: "x", ask: "y", summary: "z" };
	typesafe.answer = answering(() => ({ topic: { choice: "none", confidence: 0.99 } }));
	expect(await judge.chooseTopic(agent, { Billing: "stripe" })).toBeNull();
	typesafe.answer = answering(() => ({ topic: { choice: "t7", confidence: 0.99 } }));
	expect(await judge.chooseTopic(agent, { Billing: "stripe" })).toBeNull();
});

test("a route without a last speaker asks no reply; an intent Jev does not give goes to Ping", async () => {
	const { judge } = await started(typesafe);
	typesafe.answer = answering(() => ({ intent: { choice: "dance", confidence: 0.7 }, target: { choice: "none" } }));
	expect(await judge.route("chante", ["A"], null)).toMatchObject({ intent: "ping", target: null, confidence: 0.7, reply: 0 });
	expect(Object.keys(typesafe.asked[0]?.questions ?? {})).toEqual(["intent", "target"]);
});

test("a value TypeSafe sends past its bounds is held to them: Sonar reads the answer, and does not refuse it", async () => {
	const { judge } = await started(typesafe);
	typesafe.answer = answering(({ questions }) => {
		if (questions["urgency"]) return { urgency: { score: 2.4 }, status: { choice: "s0" } };
		if (questions["fresh"]) return { fresh: { noul: 1.02 } };
		if (questions["correction"]) return { correction: { noul: -0.1 } };
		if (questions["p0"]) return { p0: { noul: 1.5 } };
		if (questions["ended"]) return { ended: { noul: 1.3 } };
		return { intent: { choice: "open", confidence: 1.01 }, target: { choice: "a0" }, reply: { noul: -0.2 } };
	});
	expect(await judge.judge("Billing", MESSAGE)).toMatchObject({ urgency: 2 });
	expect(await judge.stillRelevant("oui", "Je merge ?", "J'ai mergé.")).toBe(1);
	expect(await judge.isCorrection("résume la PR", "non, arrête")).toBe(0);
	expect(await judge.relatedPairs([[{ name: "A", summary: "billing" }, { name: "B", summary: "billing" }]])).toEqual([1]);
	expect(await judge.route("montre A", ["A"], { who: "A", text: "Je merge ?" })).toMatchObject({ confidence: 1, reply: 0 });
	expect(await judge.yesOrNo("Done.", "ended", { instructions: "Did the agent end its work?", criteria: { true: "It did", false: "It did not" } })).toBe(1);
});

test("an answer TypeSafe sends malformed, or a refusal, fails as an error, not as Jev off", async () => {
	const { judge } = await started(typesafe);
	for (const reply of [{ answers: { correction: { noul: "high" } } }, { answers: [] }, { nothing: true }, { answers: {}, usage: { input_tokens: "10" } }]) {
		typesafe.answer = () => Response.json(reply);
		const failure = await judge.isCorrection("a", "b").catch((error: unknown) => error);
		expect(failure).toBeInstanceOf(Error);
		expect(failure).toMatchObject({ message: "TypeSafe's answer is unreadable" });
		expect((failure as { off?: unknown }).off).toBeUndefined();
	}
	typesafe.answer = () => new Response("down", { status: 500 });
	await expect(judge.isCorrection("a", "b")).rejects.toThrow("TypeSafe answered 500: down");
});
