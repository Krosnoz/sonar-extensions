// The light of the shops' windows on the pavement before a front row, by night. A pool lies before each shop window
// lit by night, read from the row's own geometry: pools laid every 2,7 along the row lit the pavement before houses
// and archways that have no shop, and missed the dark windows' darkness.
import { NIGHT_ONLY } from "./facades-kit";
import { THREE } from "../render/nodes";
import type { G } from "../render/shapes";
import { pool } from "../plan/street-furniture";

// A box of ../render/shapes.ts#b is 36 vertices in a row. A window lit by night carries the part NIGHT_ONLY, as a 32-bit float.
const BOX = 36;
const LIT = Math.fround(NIGHT_ONLY);
// A shop's window (./facades-ground.ts#shop) stands from 0.22 up, on the front face; a dwelling's starts at 0.52.
const SHOP_FOOT = 0.3;
// The pool's middle, on the pavement between the front (z 2,4) and the kerb (z 2,63), and its reach beyond the window's
// ends and out: it fades out at the kerb. Reaching 0,85 out from the kerb, at a lamp's strength, it lay across the road
// and read from above as a lamp missing (12/11).
const [POOL_Z, BEYOND, OUT] = [2.47, 0.3, 0.32];
// The shops' light, about 0.6 of the amber of their windows: softer than a lamp's pool.
export const SHOP_LIGHT = "#8c602f";

// The lit shop windows of `geometry` that face the street (+z): their middle along x and their half-width.
function litShopWindows(geometry: THREE.BufferGeometry): { x: number; half: number }[] {
	const kind = geometry.getAttribute("aPart");
	const position = geometry.getAttribute("position");
	const found: { x: number; half: number }[] = [];
	if (!kind) return found;
	for (let at = 0; at + BOX <= kind.count;) {
		if (kind.getX(at) !== LIT) {
			at++;
			continue;
		}
		const box = new THREE.Box3();
		for (let each = at; each < at + BOX; each++) box.expandByPoint(new THREE.Vector3().fromBufferAttribute(position, each));
		const size = box.getSize(new THREE.Vector3());
		// Thin along z: a window on the front face, not one on a side or on a corner's cut.
		if (box.min.y < SHOP_FOOT && size.z < 0.1 && size.x > 0.3) found.push({ x: (box.min.x + box.max.x) / 2, half: size.x / 2 });
		at += BOX;
	}
	return found;
}

// The pools before the lit shop windows of a front row (its houses as ./house-rows.ts#row builds them, their front at z 2,4).
export function shopPools(front: G[]): G[] {
	return front.flatMap((house) => litShopWindows(house).map((window) => pool(SHOP_LIGHT, window.x, POOL_Z, window.half + BEYOND, OUT)));
}
