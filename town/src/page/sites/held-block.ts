// What stands on the block the town holds for a subject to come (../plan/layout.ts#cityGrid): the town's own decor, as on
// any free block, in a part of its own, which leaves when the subject comes (./plot.ts). Its trees are laid in its
// geometry, so that they leave with it; its bricks leave from points of its surface.
import { tree } from "../people/figures";
import { THREE } from "../render/nodes";
import type { Part } from "../render/parts";
import type { G } from "../render/shapes";

// A tree put on the held block goes to `into`, where it stands, instead of an instance of the town's trees. `top`: the
// highest a tree may stand, as any tree of the town (../plan/city.ts).
export const planted =
	(into: G[], top: number) =>
	(kind: number): Part => ({
		put(given) {
			const made = tree(kind);
			made.computeBoundingBox();
			const size = Math.min(typeof given.s === "number" ? given.s : 1, top / made.boundingBox!.max.y);
			into.push(
				made
					.scale(size, size, size)
					.rotateY(given.ry ?? 0)
					.translate(given.x, given.y, given.z),
			);
			return 0;
		},
		move: () => {},
		set: () => {},
		mark: () => {},
	});

// A point of what stands there, and its colour (red, green and blue, to 255).
export type Standing = { at: [number, number, number]; colour: [number, number, number] };

// Points of the surface of `geometry` above the ground, one a triangle.
export function surfaceOf(geometry: G): Standing[] {
	const [position, colours] = [geometry.getAttribute("position"), geometry.getAttribute("color")];
	const own = new THREE.Color();
	const points: Standing[] = [];
	for (let at = 0; at < position.count; at += 3) {
		if (position.getY(at) < 0.02) continue;
		if (colours) own.setRGB(colours.getX(at), colours.getY(at), colours.getZ(at)).convertLinearToSRGB();
		points.push({ at: [position.getX(at), position.getY(at), position.getZ(at)], colour: [own.r * 255, own.g * 255, own.b * 255] });
	}
	return points;
}
