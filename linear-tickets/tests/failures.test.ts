// When a call cannot answer: no key for the project, a key Linear refuses (told apart, `refused`), Linear out of reach
// or silent, and an answer that cannot be read.

import { afterAll, beforeEach, expect, spyOn, test } from "bun:test";
import { isOff, isRefused, type TicketsProvider } from "@sonar/extension";
import { data, fakeLinear, issue, unauthorized, workspace } from "./fake-linear";
import { started } from "./support";

const linear = fakeLinear();
afterAll(() => linear.stop());
beforeEach(() => {
	linear.asked.length = 0;
	linear.answer = workspace;
});

// Every call that asks Linear for a project.
const calls: ((tickets: TicketsProvider, project: string) => Promise<unknown>)[] = [
	(tickets, project) => tickets.workspace(project),
	(tickets, project) => tickets.tickets(project, ["ABC-1"]),
	(tickets, project) => tickets.candidates(project),
	(tickets, project) => tickets.states(project, "ABC-1"),
	(tickets, project) => tickets.setState(project, "ABC-1", "s-done"),
];

// What a call rejects with; it fails the test when the call answers.
const failureOf = (call: Promise<unknown> | undefined): Promise<Error> =>
	Promise.resolve(call).then(
		() => {
			throw new Error("The call answered.");
		},
		(error: Error) => error,
	);

// A failure that is neither a refused key nor the port off: Sonar says Linear is out of reach.
const expectUnreachable = (error: Error, message?: string) => {
	expect(isRefused(error)).toBe(false);
	expect(isOff(error)).toBe(false);
	if (message !== undefined) expect(error.message).toBe(message);
};

test("a call for a project without a key rejects, says which, and asks Linear nothing", async () => {
	const { tickets } = await started(linear);
	for (const call of calls) {
		const error = await failureOf(call(tickets, "example"));
		expectUnreachable(error, `No Linear key for the project "example": add one in Sonar's Settings > Services`);
	}
	expect(linear.asked).toHaveLength(0);
});

test("a key Linear refuses (401, 403): every call rejects with Linear's message, refused", async () => {
	const { tickets } = await started(linear);
	for (const status of [401, 403]) {
		linear.answer = () => unauthorized(status);
		for (const call of calls) {
			const error = await failureOf(call(tickets, "acme"));
			expect(error.message).toBe("Authentication required, not authenticated");
			expect(isRefused(error)).toBe(true);
		}
	}
	linear.answer = () => new Response("no", { status: 401 });
	const bare = await failureOf(tickets.workspace("acme"));
	expect(bare.message).toBe("Linear answered 401");
	expect(isRefused(bare)).toBe(true);
});

test("Linear down, or an error of its own: every call rejects, the key not refused", async () => {
	const { tickets } = await started(linear);
	linear.answer = () => new Response("down", { status: 503 });
	for (const call of calls) expectUnreachable(await failureOf(call(tickets, "acme")), "Linear answered 503");
	linear.answer = () => Response.json({ errors: [{ message: "Rate limit exceeded" }] }, { status: 400 });
	expectUnreachable(await failureOf(tickets.candidates("acme")), "Rate limit exceeded");
	// Linear answers an issue it does not know by an error, without data.
	linear.answer = () => Response.json({ errors: [{ message: "Entity not found: Issue" }], data: null });
	expectUnreachable(await failureOf(tickets.states("acme", "ABC-999")), "Entity not found: Issue");
});

test("no connection to Linear: the call rejects, the key not refused", async () => {
	const gone = fakeLinear();
	const { tickets } = await started(gone);
	await gone.stop();
	expectUnreachable(await failureOf(tickets.tickets("acme", ["ABC-1"])));
});

test("a silent Linear is left after 10 s", async () => {
	const { tickets } = await started(linear);
	linear.answer = () => new Promise<Response>(() => {});
	const timeout = AbortSignal.timeout.bind(AbortSignal);
	const delays: number[] = [];
	// The delay is kept, and passes at once.
	const spy = spyOn(AbortSignal, "timeout").mockImplementation((ms) => {
		delays.push(ms);
		return timeout(50);
	});
	try {
		const error = await failureOf(tickets.workspace("acme"));
		expect(error.name).toBe("TimeoutError");
		expectUnreachable(error);
	} finally {
		spy.mockRestore();
	}
	expect(delays).toEqual([10_000]);
});

test("an answer that cannot be read rejects every call", async () => {
	const { tickets } = await started(linear);
	const unreadable = [() => new Response("<html></html>"), () => data(null), () => data({}), () => Response.json([])];
	for (const answer of unreadable) {
		linear.answer = answer;
		for (const call of calls) expectUnreachable(await failureOf(call(tickets, "acme")), "Linear's answer is unreadable");
	}
});

test("one field of another type makes the whole answer unreadable", async () => {
	const { tickets } = await started(linear);
	const wrong: [Record<string, unknown>, () => Promise<unknown>][] = [
		[{ issues: { nodes: [issue("ABC-1", { title: 12 })] } }, () => tickets.tickets("acme", ["ABC-1"])],
		[{ issues: { nodes: [issue("ABC-1", { state: null })] } }, () => tickets.tickets("acme", ["ABC-1"])],
		[{ issues: { nodes: [issue("ABC-1", { assignee: {} })] } }, () => tickets.tickets("acme", ["ABC-1"])],
		[{ viewer: { assignedIssues: { nodes: [] } }, issues: { nodes: [null] } }, () => tickets.candidates("acme")],
		[{ issue: { team: { states: { nodes: [{ id: "s", name: "Todo", type: "unstarted", color: "#ccc" }] } } } }, () => tickets.states("acme", "ABC-1")],
		[{ issueUpdate: { success: "yes" } }, () => tickets.setState("acme", "ABC-1", "s")],
		[{ organization: { name: "ACME" }, teams: { nodes: [{}] } }, () => tickets.workspace("acme")],
	];
	for (const [answer, call] of wrong) {
		linear.answer = () => data(answer);
		expectUnreachable(await failureOf(call()), "Linear's answer is unreadable");
	}
});
