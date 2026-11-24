// The monument's block, at the town's back corner, and how far the monument grows with the town.
import type { Block } from "./grid";
import { merge } from "./nodes";
import { b, type G } from "./shapes";
import { lamp } from "./street-furniture";
import { seat } from "./figures";
import { landmark } from "./landmarks";
import type { Trees } from "./city";
import type { Style } from "./styles";

// The monument's room: its half width, and its back and front, at scale 1 (as ./landmarks.ts draws it, 0.2 forward).
const FOOT: Record<Style["landmark"], { hx: number; z0: number; z1: number }> = {
	lattice: { hx: 3.3, z0: -3.1, z1: 3.5 },
	clock: { hx: 2, z0: -1.8, z1: 2.2 },
	deco: { hx: 2.56, z0: -2.36, z1: 2.76 },
	pagoda: { hx: 2.6, z0: -2.4, z1: 2.8 },
	spire: { hx: 1.45, z0: -3, z1: 3.4 },
	dome: { hx: 3.65, z0: -3, z1: 3.4 },
};
// The room: x within ±4.2, z from -5 to 1.7 on the parvis (-5.2 to 2.4, 10.4 wide), benches in front, trees on the sides.
const ROOM = { hx: 4.2, z0: -5, z1: 1.7 };

// The monument grows with the town: 1 over a village, 1.5 over a town, 1.9 over a city; its footprint stops where its
// room does, and it then rises instead (up to 1.4 times its width's growth), so it never leaves its block.
function scaleOfLandmark(tier: number, kind: Style["landmark"]): { scale: [number, number, number]; z: number } {
	const want = tier <= 1 ? 1 : tier === 2 ? 1.5 : 1.9;
	const foot = FOOT[kind];
	const flat = Math.min(want, ROOM.hx / foot.hx, (ROOM.z1 - ROOM.z0) / (foot.z1 - foot.z0));
	const up = Math.min(want, flat * 1.4);
	return { scale: [flat, up, flat], z: Math.min(ROOM.z1 - foot.z1 * flat, Math.max(ROOM.z0 - foot.z0 * flat, -1.5)) };
}

// The monument's block: a big parvis edged in a darker stone, the monument, benches along its front, a lamp at each
// corner and trees on both sides. Nothing else stands in front of it.
export function monument(style: Style, block: Block, trees: Trees, tier: number, r: () => number): G[] {
	const { scale, z } = scaleOfLandmark(tier, style.landmark);
	const out: G[] = [
		b("#d6cbbd", 10.4, 0.06, 7.6, 0, 0, -1.4),
		merge(landmark(style))
			.scale(...scale)
			.translate(0, 0, z),
	];
	for (const [w, d, x, zz] of [
		[10.4, 0.3, 0, -5.05],
		[10.4, 0.2, 0, 2.3],
		[0.3, 7, -5.05, -1.4],
		[0.3, 7, 5.05, -1.4],
	] as const)
		out.push(b("#c3b5a3", w, 0.03, d, x, 0.06, zz));
	for (const x of [-3, 3]) out.push(...seat(x, 1.95));
	for (const [x, zz] of [
		[-4.7, 1.9],
		[4.7, 1.9],
		[-4.7, -4.6],
		[4.7, -4.6],
	] as const)
		out.push(...lamp(x, zz));
	for (const [x, zz] of [
		[-4.7, -3],
		[4.7, -3],
		[-4.7, -0.6],
		[4.7, -0.6],
	] as const)
		trees(style.trees[Math.floor(r() * style.trees.length)]!).put({ x: block.x + x, y: 0, z: block.z + zz, ry: r() * 6, s: 1.1 });
	return out;
}
