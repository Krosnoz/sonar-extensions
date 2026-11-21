// TypeSafe's System One API, the one way the extension calls Jev, and the reading of its answers. TypeSafe's answer is
// checked as it comes: a field of the wrong type makes the whole answer unreadable.

// The address the extension calls; the tests give a fake one.
export const TYPESAFE_URL = "https://api.typesafe.ai/v1/systemone";
const MODEL = "jev-latest";

// One question's answer, as TypeSafe gives it.
export type Answer = {
	readonly noul?: number | undefined;
	readonly choice?: string | undefined;
	readonly score?: number | undefined;
	readonly confidence?: number | undefined;
};
export type Answers = Readonly<Record<string, Answer>>;

// TypeSafe refused for lack of credits (402).
export class OutOfCredits extends Error {}

export const systemOne = (url: string, key: string, state: unknown, questions: Record<string, unknown>, signal?: AbortSignal): Promise<Response> =>
	fetch(url, {
		method: "POST",
		headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
		body: JSON.stringify({ model: MODEL, state, questions }),
		...(signal ? { signal } : {}),
	});

type Fields = { readonly [key: string]: unknown };
const isFields = (value: unknown): value is Fields => typeof value === "object" && value !== null && !Array.isArray(value);
const isOptional = (value: unknown, type: "number" | "string") => value === undefined || typeof value === type;
const isAnswer = (value: unknown): value is Answer =>
	isFields(value) &&
	isOptional(value["noul"], "number") &&
	isOptional(value["choice"], "string") &&
	isOptional(value["score"], "number") &&
	isOptional(value["confidence"], "number");

// TypeSafe's answers and the input tokens it billed (undefined when it did not say); undefined when unreadable.
export function readReply(reply: unknown): { answers: Answers; tokens: number | undefined } | undefined {
	if (!isFields(reply) || !isFields(reply["answers"]) || !Object.values(reply["answers"]).every(isAnswer)) return undefined;
	const usage = reply["usage"];
	if (usage !== undefined && !(isFields(usage) && isOptional(usage["input_tokens"], "number"))) return undefined;
	const tokens = isFields(usage) && typeof usage["input_tokens"] === "number" ? usage["input_tokens"] : undefined;
	return { answers: reply["answers"] as Answers, tokens };
}

// One call to Jev with `key`: its answers and the tokens it read. Fails with OutOfCredits on a 402, with an Error on any
// other refusal, a network error or an answer it cannot read.
export async function askTypeSafe(url: string, key: string, state: unknown, questions: Record<string, unknown>) {
	const response = await systemOne(url, key, state, questions);
	if (response.status === 402) throw new OutOfCredits(`TypeSafe answered 402: ${await response.text()}`);
	if (!response.ok) throw new Error(`TypeSafe answered ${response.status}: ${await response.text()}`);
	const reply = readReply(await response.json());
	if (!reply) throw new Error("TypeSafe's answer is unreadable");
	return reply;
}
