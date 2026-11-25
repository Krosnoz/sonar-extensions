// The pools of light a model carries, taken out of it: they light the ground by night only (./lamplight.ts).
import { THREE } from "./nodes";

// The part of a pool of light on the ground (../plan/street-furniture.ts#pool), a flat disc whose colour fades to nothing at its edge.
const POOL = 7;

// The triangles of `geometry` that are pools, taken out of it: [what is left, the pools]. A geometry without a pool is
// returned as it is. Geometries are built without an index (./shapes.ts#piece), a triangle is three vertices in a row.
export function pooled(geometry: THREE.BufferGeometry): [THREE.BufferGeometry, THREE.BufferGeometry | null] {
	const kind = geometry.getAttribute("aPart");
	if (!kind || geometry.index) return [geometry, null];
	const rest: number[] = [];
	const pools: number[] = [];
	for (let first = 0; first < kind.count; first += 3) (kind.getX(first) === POOL ? pools : rest).push(first);
	if (!pools.length) return [geometry, null];
	const take = (firsts: number[]): THREE.BufferGeometry => {
		const made = new THREE.BufferGeometry();
		for (const [name, from] of Object.entries(geometry.attributes)) {
			const size = from.itemSize;
			const array = new Float32Array(firsts.length * 3 * size);
			firsts.forEach((first, at) => array.set(from.array.subarray(first * size, (first + 3) * size), at * 3 * size));
			made.setAttribute(name, new THREE.BufferAttribute(array, size));
		}
		return made;
	};
	return [take(rest), take(pools)];
}
