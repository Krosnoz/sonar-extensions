// One block of the town is built while the town is open: the block it held for a subject to come (./plot.ts), by a
// front of its own that crosses it alone. Its ground is never taken away: behind a ragged line that follows the front,
// the subject's ground lies where the old one lay, cube for cube. Ahead of the front, what stood on the old ground is
// taken down from its top; behind it, what stands on the new one rises, and the building, bottom-up, as its bricks
// land.
import { abs, clamp, dot, float, min, mix, step, vec3 } from "three/tsl";
import { noise, type Node, type Vec3, type Vec4 } from "./nodes";
import { PLOT, STREET } from "./pace";
import type { How, Uniforms } from "./parts";
import { T } from "./shapes";

// How far past its block's edge a subject's ground reaches, at most (./delays.ts).
const REACH = 0.4;

// Whether a part reads the held block's front: what stood there, and what stands still on a subject's block, with its
// building's roof and storeys. Not a car nor a figure, which wait for the ground too.
export const swept = (how: How): boolean => how.plot === "old" || (how.plot !== "kept" && !!how.waits && (!!how.still || how.waits === "building"));

// `left`: how far past its laying the town's own front has the cube (./part-material.ts#built), which the block never
// goes ahead of: at the opening, and on the way back, it is built and left as the rest. `inside`, `cell`: the cube's
// place; `need`: the share of a band its height asks.
export function plotted(u: Uniforms, data: Vec4, how: How, left: Node, inside: Vec3, cell: Vec3, need: Node): Node {
	const middle = vec3(u.plot.x, 0, u.plot.y);
	const off = vec3(inside.x, 0, inside.z).sub(middle);
	const within = (half: number): Node => step(abs(off.x), half).mul(step(abs(off.z), half));
	// A subject's ground reaches past its block's edge, and its neighbour's into the block: it is the held block's when
	// it was put at that block's middle, as far along the town's front. The other parts stand inside their block.
	const mine = how.plot ? float(1) : how.waits === "land" ? within(T / 2 + REACH).mul(step(abs(data.x.sub(dot(u.dir, middle))), 0.1)) : within(T / 2);
	const passed = u.plot.z.sub(
		dot(u.dir, vec3(cell.x, 0, cell.z).sub(middle))
			.div(T)
			.mul(PLOT.bands),
	);
	const shaken = noise(cell).mul(0.06);
	// 1 where the new ground lies, -1 where the old one still does: no frame shows over a ground that is there.
	const relaid = step(0, passed.sub(PLOT.relay).sub(noise(cell).mul(PLOT.ragged)))
		.mul(2)
		.sub(1);
	const above = step(STREET, cell.y);
	const own = how.plot
		? mix(relaid.negate(), clamp(float(PLOT.old).sub(passed), -1, 1.1).sub(need).sub(shaken), above)
		: how.waits === "building"
			? u.plot.w.sub(cell.y.sub(STREET).div(u.plotTop.sub(STREET).max(0.1))).sub(shaken)
			: mix(relaid, clamp(passed.sub(PLOT.fresh), -1, 1.1).sub(need).sub(shaken), above);
	return mix(left, min(left, own), mine);
}
