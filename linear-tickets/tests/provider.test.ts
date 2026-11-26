// Linear as Sonar's ticket tracker, call by call, when Linear answers: issues in one request, candidates without
// duplicates, states in the board's order, a change of state, the workspace a key opens.

import { afterAll, beforeEach, expect, test } from "bun:test";
import { data, fakeLinear, issue, knowing, workspace } from "./fake-linear";
import { started } from "./support";

const linear = fakeLinear();
afterAll(() => linear.stop());
beforeEach(() => {
	linear.asked.length = 0;
	linear.answer = workspace;
});

test("names Linear, and reaches it only for a project with a key", async () => {
	const { tickets } = await started(linear);
	expect(tickets.name).toBe("Linear");
	expect(await tickets.ready("acme")).toBe(true);
	expect(await tickets.ready("example")).toBe(false);
	expect(linear.asked).toHaveLength(0);
});

test("issues in one request with the project's key: one answer per id, in their order, null for one Linear does not know", async () => {
	const { tickets } = await started(linear);
	// Linear gives them in its own order.
	linear.answer = knowing(issue("ABC-3", { state: { name: "Done", type: "completed", color: "#0f0" }, assignee: { displayName: "example" } }), issue("ABC-1"));
	expect(await tickets.tickets("acme", ["ABC-1", "ABC-2", "ABC-3"])).toEqual([
		{
			id: "ABC-1",
			title: "Title ABC-1",
			url: "https://example.com/acme/issue/ABC-1",
			state: "Todo",
			stateType: "unstarted",
			color: "#cccccc",
			assignee: null,
		},
		null,
		{
			id: "ABC-3",
			title: "Title ABC-3",
			url: "https://example.com/acme/issue/ABC-3",
			state: "Done",
			stateType: "completed",
			color: "#0f0",
			assignee: "example",
		},
	]);
	expect(linear.asked).toHaveLength(1);
	const [asked] = linear.asked;
	expect(asked?.authorization).toBe("example-key");
	expect(asked?.variables).toEqual({ ids: ["ABC-1", "ABC-2", "ABC-3"], first: 3 });
	expect(asked?.query).toContain("includeArchived: true");
	expect(asked?.query).not.toContain("ABC-");
});

test("an identifier in lower case, or asked twice, finds its issue", async () => {
	const { tickets } = await started(linear);
	linear.answer = knowing(issue("ABC-12"));
	expect((await tickets.tickets("acme", ["abc-12", "ABC-12"])).map((ticket) => ticket?.id)).toEqual(["ABC-12", "ABC-12"]);
});

test("a request never holds a malformed identifier, which is answered null", async () => {
	const { tickets } = await started(linear);
	linear.answer = knowing(issue("ABC-1"));
	const malformed = ['ABC-2") { id } other: issue(id: "ABC-3', "ABC", "ABC-", "-12", "AB C-1", "ABC-1x", ""];
	const found = await tickets.tickets("acme", [...malformed, "ABC-1"]);
	expect(found.map((ticket) => ticket?.id ?? null)).toEqual([...malformed.map(() => null), "ABC-1"]);
	expect(linear.asked).toHaveLength(1);
	expect(linear.asked[0]?.variables).toEqual({ ids: ["ABC-1"], first: 1 });
	// Nothing to ask: no request at all, for the issues, their states or a change.
	linear.asked.length = 0;
	expect(await tickets.tickets("acme", malformed)).toEqual(malformed.map(() => null));
	expect(await tickets.tickets("acme", [])).toEqual([]);
	for (const id of malformed) {
		await expect(tickets.states("acme", id)).rejects.toThrow("not a Linear issue identifier");
		await expect(tickets.setState("acme", id, "s-done")).rejects.toThrow("not a Linear issue identifier");
	}
	expect(linear.asked).toHaveLength(0);
});

test("a title longer than Sonar takes is cut, the answer kept", async () => {
	const { tickets } = await started(linear);
	linear.answer = knowing(issue("ABC-1", { title: "a".repeat(600) }));
	expect((await tickets.tickets("acme", ["ABC-1"]))[0]?.title).toBe("a".repeat(500));
});

test("candidates: the user's own open issues first, then the recently updated open ones, each once", async () => {
	const { tickets } = await started(linear);
	linear.answer = () =>
		data({
			viewer: { assignedIssues: { nodes: [issue("ABC-1"), issue("ABC-4")] } },
			issues: { nodes: [issue("ABC-2"), issue("ABC-1"), issue("OPS-3")] },
		});
	expect((await tickets.candidates("acme")).map((ticket) => ticket.id)).toEqual(["ABC-1", "ABC-4", "ABC-2", "OPS-3"]);
	expect(linear.asked).toHaveLength(1);
	const query = linear.asked[0]?.query;
	expect(query).toContain("viewer { assignedIssues(first: 50");
	expect(query).toContain("issues(first: 100");
	expect(query).toContain(`nin: ["completed", "canceled"]`);
	expect(query).toContain("orderBy: updatedAt");
});

test("states in the order of the team's board, the issue named in the variables", async () => {
	const { tickets } = await started(linear);
	linear.answer = () =>
		data({
			issue: {
				team: {
					states: {
						nodes: [
							{ id: "s-done", name: "Done", type: "completed", color: "#0f0", position: 3 },
							{ id: "s-todo", name: "Todo", type: "unstarted", color: "#ccc", position: 1 },
							{ id: "s-doing", name: "In Progress", type: "started", color: "#ff0", position: 2.5 },
						],
					},
				},
			},
		});
	expect(await tickets.states("acme", "ABC-1")).toEqual([
		{ id: "s-todo", name: "Todo", type: "unstarted", color: "#ccc" },
		{ id: "s-doing", name: "In Progress", type: "started", color: "#ff0" },
		{ id: "s-done", name: "Done", type: "completed", color: "#0f0" },
	]);
	expect(linear.asked[0]?.variables).toEqual({ id: "ABC-1" });
});

test("a change of state is sent as variables; one Linear says it did not make rejects", async () => {
	const { tickets } = await started(linear);
	linear.answer = () => data({ issueUpdate: { success: true } });
	await tickets.setState("acme", "ABC-1", "s-done");
	expect(linear.asked[0]?.query).toStartWith("mutation");
	expect(linear.asked[0]?.variables).toEqual({ id: "ABC-1", stateId: "s-done" });
	linear.answer = () => data({ issueUpdate: { success: false } });
	await expect(tickets.setState("acme", "ABC-1", "s-done")).rejects.toThrow("Linear did not change the state of ABC-1");
});

test("the workspace a project reaches: its name and its teams' prefixes", async () => {
	const { tickets } = await started(linear);
	expect(await tickets.workspace("acme")).toEqual({ name: "ACME", teams: ["ABC", "OPS"] });
	expect(linear.asked.map((asked) => asked.authorization)).toEqual(["example-key"]);
	expect(linear.asked[0]?.query).toContain("teams(first: 200)");
});
