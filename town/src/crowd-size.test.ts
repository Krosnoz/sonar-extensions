// A square holds its whole crowd, whatever its size: `crowdOf` ends and places each one. Its fixed gaps bounded what a
// square holds: past about 150 agents a square, no scale would do, the loop never ended, and the town of 10 000 agents
// froze the page (13/11). The computation runs in a process of its own: an endless loop does not freeze the tests.
import { expect, test } from "bun:test";

const crowd = new URL("./crowd.ts", import.meta.url).pathname.replace(/^\/(\w:)/, "$1");
// The crowd of `count` agents, one in three with two robots: its scale, its people standing and walking, and how long
// the computation took.
function crowdOf(count: number): { scale: number; stands: number; starts: number; ms: number } | null {
	const code = `
		const { crowdOf } = await import(${JSON.stringify(crowd)});
		const agents = Array.from({ length: ${count} }, (_, at) => ({ name: "a", state: at % 4, seed: (at * 0.618) % 1, children: at % 3 ? [] : [1, 0] }));
		const began = performance.now();
		const made = crowdOf(agents, [-3, 3]);
		console.log(JSON.stringify({ scale: made.scale, stands: made.stands.length, starts: made.starts.length, ms: performance.now() - began }));`;
	const run = Bun.spawnSync({ cmd: [process.execPath, "-e", code], timeout: 10_000, stdout: "pipe", stderr: "pipe" });
	return run.exitCode === 0 ? JSON.parse(run.stdout.toString()) : null;
}

test("a square of 1 000 agents places each one in less than a second", () => {
	const made = crowdOf(1000);
	expect(made).not.toBeNull();
	expect(made!.scale).toBeGreaterThan(0);
	expect([made!.stands, made!.starts]).toEqual([750, 250]);
	expect(made!.ms).toBeLessThan(1000);
});

test("a square of 200 agents places each one", () => {
	const made = crowdOf(200);
	expect(made).not.toBeNull();
	expect([made!.stands, made!.starts]).toEqual([150, 50]);
});

test("a crowd that fitted already keeps its scale", () => {
	expect(crowdOf(110)!.scale).toBeCloseTo(0.02758, 4);
	// Two steps under 0.003368 since an agent with two robots keeps its right neighbour out of their line of sight on a
	// square too (./figures-visible.test.ts, 14/11).
	expect(crowdOf(140)!.scale).toBeCloseTo(0.003039, 5);
});
