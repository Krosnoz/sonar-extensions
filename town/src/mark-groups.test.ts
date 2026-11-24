// A mark groups the inhabitants of one square only. A subject's crowd spreads over several squares of its quarter
// (./quarters.ts): grouped on the box of the whole quarter, inhabitants of squares far apart fell in one mark, set at
// their middle, sometimes off the screen while they were on it. At 10 000 agents, 10 to 30 agents of the screen were
// neither in a mark nor seen one by one (13/11).
import { expect, test } from "bun:test";
import type { Agent, Figure } from "./kit";

await import("./test-page");
const { grouping } = await import("./mark-groups");
const { T } = await import("./shapes");

const agent = { name: "a", state: 0, seed: 0.5, children: [] } as Agent;
// One subject's people on two squares of its quarter, ten blocks apart.
const figures: Figure[] = [0, 0.5, 10 * T, 10 * T + 0.5].map((x) => ({ topic: 0, agent, at: [x, 1.6, 0] }) as Figure);

test("from afar, a mark groups only the inhabitants of one square", () => {
	const groups = grouping(figures)(0.01, 30);
	expect(groups.map((group) => group.members.toSorted((a, b) => a - b))).toEqual([
		[0, 1],
		[2, 3],
	]);
});
