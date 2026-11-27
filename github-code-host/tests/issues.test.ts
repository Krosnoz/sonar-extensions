// The issues handed to the agents: the open ones that carry the label, kept only when a person who can write in the
// repository put it last.

import { expect, test } from "bun:test";
import { type Asked, data } from "./fake-github";
import { failureOf, started } from "./support";

const labeled = (login: string | null, name = "sonar") => ({ label: { name }, actor: login === null ? null : { login } });
const node = (number: number, events: object[], more: object = {}) => ({
	number,
	title: `Issue ${number}`,
	url: `https://github.com/acme/shop/issues/${number}`,
	body: `Body ${number}`,
	timelineItems: { nodes: events },
	...more,
});

// The issues of the repository, and what each person may do in it.
const repository =
	(issues: object[], permissions: Record<string, string> = { ada: "ADMIN" }) =>
	({ query, variables }: Asked): Response => {
		if (!query.includes("collaborators(")) return data({ repository: { issues: { nodes: issues } } });
		const permission = permissions[String(variables["login"])];
		return data({ repository: { collaborators: { edges: permission ? [{ permission }] : [] } } });
	};

async function handedOver(issues: object[], permissions?: Record<string, string>) {
	const { host, github } = await started();
	github.answer = repository(issues, permissions);
	return { issues: await host.issues("shop", "sonar"), github };
}

test("the labeled issues of the project's repository, in GitHub's order (the oldest first)", async () => {
	const { issues, github } = await handedOver([node(4, [labeled("ada")]), node(9, [labeled("ada")])]);
	expect(issues).toEqual([
		{ number: 4, title: "Issue 4", url: "https://github.com/acme/shop/issues/4", body: "Body 4" },
		{ number: 9, title: "Issue 9", url: "https://github.com/acme/shop/issues/9", body: "Body 9" },
	]);
	expect(github.asked[0]?.variables).toEqual({ owner: "acme", name: "shop", label: "sonar" });
	expect(github.asked[0]?.query).toContain("states: OPEN, labels: [$label], orderBy: { field: CREATED_AT, direction: ASC }");
});

test("only a person who can write counts: admin, maintain or write; each is asked once", async () => {
	const events = ["ada", "grace", "alan", "reader", "stranger", "ada"];
	const { issues, github } = await handedOver(
		events.map((login, at) => node(at + 1, [labeled(login)])),
		{ ada: "ADMIN", grace: "MAINTAIN", alan: "WRITE", reader: "READ" },
	);
	expect(issues.map((issue) => issue.number)).toEqual([1, 2, 3, 6]);
	expect(github.asked.slice(1).map((each) => each.variables["login"])).toEqual(["ada", "grace", "alan", "reader", "stranger"]);
});

test("the last person to put that label counts, whatever its case; another label's events do not", async () => {
	const { issues } = await handedOver([
		node(1, [labeled("ada"), labeled("stranger")]),
		node(2, [labeled("stranger"), labeled("ada", "SONAR")]),
		node(3, [labeled("stranger"), labeled("ada", "bug")]),
		node(4, [labeled("ada"), labeled(null)]),
		node(5, []),
	]);
	expect(issues.map((issue) => issue.number)).toEqual([2]);
});

test("a person whose rights cannot be read does not count", async () => {
	const { host, github } = await started();
	github.answer = ({ query }) =>
		query.includes("collaborators(")
			? data({ repository: { collaborators: null } })
			: data({ repository: { issues: { nodes: [node(1, [labeled("ada")])] } } });
	expect(await host.issues("shop", "sonar")).toEqual([]);
});

test("a repository the token does not see: GitHub's own words, as it answers for one it hides", async () => {
	const { host, github } = await started();
	github.answer = () => Response.json({ data: { repository: null }, errors: [{ message: "Could not resolve to a Repository" }] });
	expect((await failureOf(host.issues("shop", "sonar"))).message).toContain("Could not resolve to a Repository");
});

test("a title or a body longer than Sonar takes is cut", async () => {
	const { issues } = await handedOver([node(1, [labeled("ada")], { title: "t".repeat(600), body: "b".repeat(70_000) })]);
	expect([issues[0]?.title.length, issues[0]?.body.length]).toEqual([500, 65_536]);
});
