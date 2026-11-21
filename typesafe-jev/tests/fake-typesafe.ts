// TypeSafe's System One API as the tests fake it, on a free local port: it keeps each request it gets, and answers by
// `answer`, set by each test. By default it answers every question the same neutral way, as Sonar's fake does: no
// sentence chosen, no urgency, 10 tokens read.

export type Asked = {
	readonly authorization: string | null;
	readonly model: unknown;
	readonly state: Record<string, unknown>;
	readonly questions: Record<string, { readonly type?: string; readonly instructions?: unknown; readonly criteria?: unknown }>;
};

export const neutral = (asked: Asked): Response =>
	Response.json({
		answers: Object.fromEntries(Object.keys(asked.questions).map((key) => [key, { noul: 0, choice: "none", score: 0, confidence: 0 }])),
		usage: { input_tokens: 10 },
	});

// Its answers given as data: each question's answer, and the tokens it read (none: TypeSafe did not say them).
export const answering =
	(answers: (asked: Asked) => Record<string, unknown>, tokens: number | null = 10) =>
	(asked: Asked): Response =>
		Response.json({ answers: answers(asked), ...(tokens === null ? {} : { usage: { input_tokens: tokens } }) });

export const outOfCredits = (): Response =>
	Response.json({ detail: { error_type: "billing_error", message: "No available TypeSafe API credits." } }, { status: 402 });

export type FakeTypeSafe = {
	readonly url: string;
	readonly asked: Asked[];
	answer: (asked: Asked) => Response | Promise<Response>;
	readonly stop: () => Promise<void>;
};

export function fakeTypeSafe(): FakeTypeSafe {
	const server = Bun.serve({
		port: 0,
		hostname: "127.0.0.1",
		fetch: async (request) => {
			const body = (await request.json()) as { model?: unknown; state?: Record<string, unknown>; questions?: Asked["questions"] };
			const one = { authorization: request.headers.get("authorization"), model: body.model, state: body.state ?? {}, questions: body.questions ?? {} };
			fake.asked.push(one);
			return fake.answer(one);
		},
	});
	const fake: FakeTypeSafe = { url: `http://127.0.0.1:${server.port}/v1/systemone`, asked: [], answer: neutral, stop: () => server.stop(true) };
	return fake;
}
