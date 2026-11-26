// Linear's GraphQL API, the one way the extension calls Linear: one request, with a project's key, and the reading of
// its answer. A request that gets no readable answer rejects with Linear's own message when it gives one.

import { fieldOf, type Read } from "./decode";

// The address the extension calls; the tests give a fake one.
export const LINEAR_URL = "https://api.linear.app/graphql";
const TIMEOUT_MS = 10_000;

// One request with a key it holds: the answer's `data`, as `read` reads it. A value goes in `variables`, never in the
// query's text.
export type AskLinear = <A>(query: string, read: Read<A>, variables?: Record<string, unknown>) => Promise<A>;

const errorOf = (answer: unknown): string | undefined => {
	const errors = fieldOf(answer, "errors");
	const message = Array.isArray(errors) ? fieldOf(errors[0], "message") : undefined;
	return typeof message === "string" ? message : undefined;
};

export const linearAt =
	(url: string, key: string): AskLinear =>
	async (query, read, variables = {}) => {
		const response = await fetch(url, {
			method: "POST",
			headers: { "content-type": "application/json", authorization: key },
			body: JSON.stringify({ query, variables }),
			signal: AbortSignal.timeout(TIMEOUT_MS),
		});
		const answer: unknown = await response.json().catch(() => null);
		const data = response.ok ? read(fieldOf(answer, "data")) : undefined;
		if (data !== undefined) return data;
		const message = errorOf(answer) ?? (response.ok ? "Linear's answer is unreadable" : `Linear answered ${response.status}`);
		// Linear refused the key itself: Sonar reads `refused`, and tells it from a Linear out of reach.
		const refused = response.status === 401 || response.status === 403;
		throw Object.assign(new Error(message), refused ? { refused: true } : {});
	};
