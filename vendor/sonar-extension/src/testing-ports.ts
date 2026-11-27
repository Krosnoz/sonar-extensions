// The ports of the testing kit (./testing.ts), refused as Sonar refuses them: a port its card does not declare, one
// filled twice, or once its start ended, and a provider that is not well formed. Each port filled is given back to the
// test with its answers checked as Sonar checks them.

import type { Manifest } from "./card";
import { checkedCodeHost, codeHostRefusal, keptCodeHost } from "./code-host-answers";
import type { ServerApi, Stop } from "./contract";
import { checkedJudge, CORE_LENT_NAMES, judgeRefusal, keptJudge } from "./judge-answers";
import type { CodeHostProvider, JudgeProvider, Port, TicketsProvider } from "./ports";
import { provideRefusal } from "./rules";
import { checkedTickets, keptTickets, ticketsRefusal } from "./ticket-answers";

// Sonar's words for a provider that lacks a field (`missing`), `kind` being its port's.
function wellFormed(kind: "tickets" | "code host", missing: string | null): void {
	if (missing === "name") throw new Error(`The "name" of its ${kind} provider must have 1 to 40 characters.`);
	if (missing) throw new Error(`Its ${kind} provider has no "${missing}": it must be a function.`);
}

// Until a test starts it through the bench, its start counts as under way.
export function portsOf(provides: Manifest["provides"]) {
	let starting = true;
	let judge: JudgeProvider | null = null;
	let tickets: TicketsProvider | null = null;
	let codeHost: CodeHostProvider | null = null;
	// Sonar's words for a port that may not be filled now (provideRefusal of ./rules.ts).
	const refused = (port: Port, filled: boolean) => {
		const refusal = provideRefusal(provides, port, starting, filled);
		if (refusal === "undeclared") throw new Error(`Its card does not declare the port "${port}": add "${port}" to its "provides".`);
		if (refusal === "late") throw new Error(`The port "${port}" is filled during its start only.`);
		if (refusal === "twice") throw new Error(`It already fills the port "${port}".`);
	};
	const provideTickets = (given: TicketsProvider) => {
		refused("tickets", tickets !== null);
		const provider = keptTickets(given);
		wellFormed("tickets", ticketsRefusal(given) ?? ticketsRefusal(provider));
		tickets = provider;
	};
	const provideCodeHost = (given: CodeHostProvider) => {
		refused("codeHost", codeHost !== null);
		const provider = keptCodeHost(given);
		wellFormed("code host", codeHostRefusal(given) ?? codeHostRefusal(provider));
		codeHost = provider;
	};
	const provideJudge = (given: JudgeProvider) => {
		refused("judge", judge !== null);
		const provider = keptJudge(given);
		const named = judgeRefusal(provider);
		if (named === "lend-unnamed") throw new Error('Its judge lends a key without "lentAs": name the key it lends.');
		if (named === "lent-as-core")
			throw new Error(
				`Its judge's "lentAs" "${String(provider.lentAs)}" is a name Sonar lends itself (${CORE_LENT_NAMES.join(", ")}): name its key otherwise.`,
			);
		if (named) throw new Error(`Its judge's "lentAs" must have 2 to 40 characters: lower case letters, digits and "-".`);
		judge = provider;
	};
	const provide: ServerApi["provide"] = { judge: provideJudge, tickets: provideTickets, codeHost: provideCodeHost };
	const start = async (run: () => void | Stop | Promise<void | Stop>) => {
		try {
			return await run();
		} finally {
			starting = false;
		}
	};
	// The bench's own: each port filled, as Sonar would call it.
	const bench = {
		judge: () => (judge ? checkedJudge(judge) : null),
		tickets: () => (tickets ? checkedTickets(tickets) : null),
		codeHost: () => (codeHost ? checkedCodeHost(codeHost) : null),
	};
	return { provide, start, bench };
}
