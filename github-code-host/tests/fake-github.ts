// GitHub's GraphQL API as the tests fake it, in memory: the function the extension sends its requests with. It keeps
// each request, and answers by `answer`, set by each test. Nothing leaves the machine. By default it only knows the
// account ada.

export type Asked = {
	readonly url: string;
	readonly method: string | undefined;
	readonly token: string;
	readonly query: string;
	readonly variables: Record<string, unknown>;
};

export const data = (value: unknown): Response => Response.json({ data: value });

export const viewer = (): Response => data({ viewer: { login: "ada" } });

// A token GitHub does not know.
export const badCredentials = (): Response => Response.json({ message: "Bad credentials" }, { status: 401 });

// A check run, and a pull request, as GitHub writes them.
export const checkRun = (name: string, conclusion: string | null, status = "COMPLETED") => ({ kind: "CheckRun", name, status, conclusion });

export const commits = (...checks: object[]) => ({ nodes: [{ commit: { statusCheckRollup: { contexts: { nodes: checks } } } }] });

export const pullNode = (number: number, state = "OPEN", more: Record<string, unknown> = {}) => ({
	number,
	url: `https://github.com/acme/shop/pull/${number}`,
	title: `Pull ${number}`,
	state,
	isDraft: false,
	mergeable: "MERGEABLE",
	baseRefName: "main",
	headRefOid: "4f9c2a1",
	reviews: { nodes: [] },
	comments: { nodes: [] },
	commits: commits(),
	...more,
});

export function fakeGitHub() {
	const fake = {
		asked: [] as Asked[],
		answer: viewer as (asked: Asked) => Response | Promise<Response>,
		send: async (url: string, init: RequestInit): Promise<Response> => {
			const body = JSON.parse(String(init.body)) as { query: string; variables: Record<string, unknown> };
			const token = (new Headers(init.headers).get("authorization") ?? "").replace(/^bearer /, "");
			const asked = { url, method: init.method, token, query: body.query, variables: body.variables };
			fake.asked.push(asked);
			return fake.answer(asked);
		},
	};
	return fake;
}
