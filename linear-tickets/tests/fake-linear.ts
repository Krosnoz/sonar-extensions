// Linear's GraphQL API as the tests fake it, in memory, on a free local port: it keeps each request it gets, and
// answers by `answer`, set by each test. By default it knows one workspace, ACME, without any issue.

type Asked = {
	readonly authorization: string | null;
	readonly query: string;
	readonly variables: Record<string, unknown>;
};

// An issue as Linear writes it.
export const issue = (identifier: string, more: Record<string, unknown> = {}) => ({
	identifier,
	title: `Title ${identifier}`,
	url: `https://example.com/acme/issue/${identifier}`,
	state: { name: "Todo", type: "unstarted", color: "#cccccc" },
	assignee: null,
	...more,
});

export const data = (value: unknown): Response => Response.json({ data: value });

export const workspace = (): Response => data({ organization: { name: "ACME" }, teams: { nodes: [{ key: "ABC" }, { key: "OPS" }] } });

// Linear's filter by identifiers over these issues: those it does not know are left out.
export const knowing =
	(...issues: ReturnType<typeof issue>[]) =>
	({ variables }: Asked): Response =>
		data({ issues: { nodes: issues.filter((each) => (variables["ids"] as string[]).includes(each.identifier)) } });

// A key Linear does not know.
export const unauthorized = (status = 401): Response => Response.json({ errors: [{ message: "Authentication required, not authenticated" }] }, { status });

export type FakeLinear = {
	readonly url: string;
	readonly asked: Asked[];
	answer: (asked: Asked) => Response | Promise<Response>;
	readonly stop: () => Promise<void>;
};

export function fakeLinear(): FakeLinear {
	const server = Bun.serve({
		port: 0,
		hostname: "127.0.0.1",
		fetch: async (request) => {
			const body = (await request.json()) as { query: string; variables: Record<string, unknown> };
			const one = { authorization: request.headers.get("authorization"), query: body.query, variables: body.variables };
			fake.asked.push(one);
			return fake.answer(one);
		},
	});
	const fake: FakeLinear = { url: `http://127.0.0.1:${server.port}/graphql`, asked: [], answer: workspace, stop: () => server.stop(true) };
	return fake;
}
