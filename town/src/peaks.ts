// The town's high points, where they stand: the camera frames them whatever its heading (./camera.ts). Framed as one
// point over the town's middle, a church's spire at a corner went under the page's top bar after a turn (13/11).
import type { THREE } from "./nodes";

type Point = [number, number, number];

// The highest vertex of `geometry` on each square metre of the ground, above `floor`: a vertex lower on the same square
// rises less on the screen, but by under a metre at the steepest view, which the framing's margin takes.
export function peaksOf(geometry: THREE.BufferGeometry, floor: number): Point[] {
	const position = geometry.getAttribute("position");
	const cells = new Map<number, Point>();
	for (let index = 0; index < position.count; index++) {
		const y = position.getY(index);
		if (y <= floor) continue;
		const [x, z] = [position.getX(index), position.getZ(index)];
		const key = Math.round(x) * 100_003 + Math.round(z);
		if (y > (cells.get(key)?.[1] ?? -Infinity)) cells.set(key, [x, y, z]);
	}
	return [...cells.values()];
}

// Of `peaks`, those that rise on the screen to within a metre of the highest point of `base`, at one of 32 headings and
// 5 heights from `lowest` to `highest`: the others never change the framing, which is measured at every frame of a turn.
export function rising(peaks: Point[], base: Point[], lowest: number, highest: number): Point[] {
	const kept = new Set<Point>();
	for (let turn = 0; turn < 32; turn++)
		for (let tilt = 0; tilt <= 4; tilt++) {
			// The screen's up axis, as ./camera.ts#axesOf sets it.
			const [az, pitch] = [Math.PI / 4 + (turn * Math.PI) / 16, lowest + ((highest - lowest) * tilt) / 4];
			const [s, c, sp, cp] = [Math.sin(az), Math.cos(az), Math.sin(pitch), Math.cos(pitch)];
			const up = ([x, y, z]: Point): number => -sp * s * x + cp * y - sp * c * z;
			const top = base.reduce((most, each) => Math.max(most, up(each)), -Infinity) - 1;
			for (const each of peaks) if (up(each) > top) kept.add(each);
		}
	return [...kept];
}
