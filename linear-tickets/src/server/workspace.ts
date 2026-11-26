// The workspace a Linear key opens: its name, and its teams' prefixes ("ABC" of "ABC-12").

import type { AskLinear } from "./api";
import { fieldOf, nodesOf, textsOf } from "./decode";

// As many teams as Sonar takes; Linear gives 50 when not asked.
export const readWorkspace = (ask: AskLinear): Promise<{ name: string; teams: string[] }> =>
	ask("query { organization { name } teams(first: 200) { nodes { key } } }", (data) => {
		const organization = textsOf(fieldOf(data, "organization"), "name");
		const teams = nodesOf(fieldOf(data, "teams"), (node) => textsOf(node, "key")?.key);
		return organization && teams ? { name: organization.name, teams } : undefined;
	});
