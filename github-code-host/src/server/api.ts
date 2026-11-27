// GitHub's GraphQL API, the one way the extension calls GitHub: one request, with a token, its data, or why GitHub
// refused it.

import { fieldOf, textOf } from "./decode";

const API_URL = "https://api.github.com/graphql";

export type Send = (url: string, init: RequestInit) => Promise<Response>;

// One request with a token it holds: the answer's `data`, as it came. A value goes in `variables`, never in the
// query's text.
export type AskGitHub = (query: string, variables?: Record<string, unknown>) => Promise<unknown>;

export const githubWith =
	(send: Send, token: string): AskGitHub =>
	async (query, variables = {}) => {
		const response = await send(API_URL, {
			method: "POST",
			headers: { Authorization: `bearer ${token}`, "Content-Type": "application/json", "User-Agent": "Sonar" },
			body: JSON.stringify({ query, variables }),
		});
		// GitHub says why in a JSON body ("Bad credentials"); a proxy may answer otherwise.
		if (!response.ok) {
			const body = await response.text();
			const reason = `GitHub ${response.status}: ${/"message":\s*"([^"]+)"/.exec(body)?.[1] ?? body.slice(0, 200)}`;
			// GitHub refused the token itself (wrong, expired, revoked): Sonar reads `refused`, and tells it from a GitHub
			// out of reach.
			throw Object.assign(new Error(reason), response.status === 401 ? { refused: true } : {});
		}
		const answer: unknown = await response.json().catch(() => {
			throw new Error("GitHub: unreadable answer");
		});
		const errors = fieldOf(answer, "errors");
		const refused = Array.isArray(errors) ? textOf(fieldOf(errors[0], "message")) : undefined;
		if (refused) throw new Error(`GitHub: ${refused}`);
		return fieldOf(answer, "data");
	};
