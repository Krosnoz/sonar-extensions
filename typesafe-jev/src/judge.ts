// Jev as Sonar's judge (the port `judge`): each call asks TypeSafe, counted in the usage and within the monthly cap.
// Switched off, without a key, at its cap or out of credits, a call rejects with an Error bearing `off: true`, which the
// core reads as "judge off": it does without the answer.

import { type JudgeProvider, lentKeyOf, type ServerApi } from "@sonar/extension";
import { spentThisMonth } from "./cost";
import * as questions from "./questions";
import { type JevSettings, readSettings } from "./settings";
import { jevStopped } from "./stopped";
import { askTypeSafe, held, OutOfCredits, systemOne } from "./typesafe";
import type { Usage } from "./usage";

export type JevOptions = { readonly url: string; readonly now: () => number };

const YES_OR_NO_MS = 8000;
export const TYPESAFE_KEY = "typesafe";

export const off = (message: string) => Object.assign(new Error(message), { off: true });
const offInSettings = () => off("Jev is off in its settings");

export function jevJudge(api: ServerApi, options: JevOptions, usage: Usage): JudgeProvider {
	const key = async () => (await api.keys.read(TYPESAFE_KEY))?.trim() || null;

	// Jev switches itself off and says why, once: the switch stays off until the user turns it on again.
	let stopping: Promise<void> | null = null;
	const stop = (reason: "cap" | "credits") =>
		(stopping ??= (async () => {
			const settings = await readSettings(api);
			if (!settings.on) return;
			await api.settings.write({ ...settings, on: false });
			const texts = jevStopped[api.language()];
			api.log(reason === "cap" ? texts.cap(settings.monthlyUsd) : texts.credits());
			api.live.send(reason === "cap" ? { kind: "cap", usd: settings.monthlyUsd } : { kind: "credits" });
		})().finally(() => {
			stopping = null;
		}));

	const ask: questions.AskJev = async (state, asked) => {
		const settings: JevSettings = await readSettings(api);
		const token = await key();
		if (!settings.on) throw offInSettings();
		if (!token) throw off("Jev has no TypeSafe key");
		if (spentThisMonth(usage.days(), options.now()) >= settings.monthlyUsd) {
			await stop("cap");
			throw off("Jev reached its monthly cap");
		}
		usage.call();
		try {
			const { answers, tokens } = await askTypeSafe(options.url, token, state, asked);
			usage.tokens(tokens);
			return answers;
		} catch (error) {
			if (!(error instanceof OutOfCredits)) throw error;
			await stop("credits");
			throw off(error.message);
		}
	};
	const user = () => api.userName();

	return {
		judge: (agentName, message) => questions.judge(ask, user(), agentName, message),
		stillRelevant: (answer, question, current) => questions.stillRelevant(ask, user(), answer, question, current),
		isCorrection: (previous, next) => questions.isCorrection(ask, user(), previous, next),
		relatedPairs: (pairs) => questions.relatedPairs(ask, pairs),
		chooseTopic: (agent, candidates) => questions.chooseTopic(ask, agent, candidates),
		route: (text, agentNames, lastSpeaker) => questions.route(ask, user(), text, agentNames, lastSpeaker),
		// The end-of-turn check: neither counted nor capped, as in Sonar's plugin. A key another Sonar lent serves without
		// one here; 0 when TypeSafe refuses; a network error or a silence past its delay rejects, and the turn ends.
		yesOrNo: async (message, questionKey, question, lentKey) => {
			if (!(await readSettings(api)).on) throw offInSettings();
			const token = lentKey?.trim() || (await key());
			if (!token) throw off("Jev has no TypeSafe key");
			const response = await systemOne(options.url, token, { message }, { [questionKey]: { type: "noul", ...question } }, AbortSignal.timeout(YES_OR_NO_MS));
			if (!response.ok) return 0;
			const reply: unknown = await response.json();
			const answer = (reply as { answers?: Record<string, { noul?: unknown } | undefined> } | null)?.answers?.[questionKey]?.noul;
			return typeof answer === "number" ? held(answer) : 0;
		},
		// A key Sonar would not lend (a space inside, over 512 characters) lends nothing.
		lend: async () => ((await readSettings(api)).on ? (lentKeyOf(await key()) ?? null) : null),
		lentAs: TYPESAFE_KEY,
	};
}
