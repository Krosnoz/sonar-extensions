// What the town's drawing gives its life (./live-steps.ts#Stage), and the bricks thrown while the town is open: a
// merge's pallet pours them (./pouring.ts). They fly as a card's bricks (./dust.ts), on the town's clock.
import { dust, type Grain } from "./dust";
import type { Flight } from "./layer-grains";
import type { Stage } from "./live-steps";
import type { THREE } from "./nodes";
import { townEar } from "./town-ear";
import { reducedMotion } from "./look";

// With motion reduced, every change is there at once.
export const moves = (): boolean => !reducedMotion();

// `hot`: the colour of the edge that eats the page, which a brick keeps on its way (./rim.ts).
export function thrown(scene: THREE.Scene, night: boolean, hot: readonly [number, number, number]) {
	let flights: { drawn: ReturnType<typeof dust>; until: number }[] = [];
	return {
		add(grains: Grain[], until: number): void {
			flights.push({ drawn: dust(scene, grains, night, hot), until });
		},
		tick(seconds: number, camera: THREE.Camera): void {
			for (const flight of flights) {
				if (seconds > flight.until) flight.drawn.dispose();
				else flight.drawn.set(seconds, camera);
			}
			flights = flights.filter((flight) => seconds <= flight.until);
		},
	};
}

// `top`: the height the town is built up to (./part-material.ts#built). `size`: a grain's size in metres. `seen`: whether
// the camera shows a place's figures. `moving`: false with motion reduced.
export function stageOf(
	top: { value: number },
	air: { add: (flight: Flight) => void },
	cubes: ReturnType<typeof thrown>,
	size: () => number,
	seen: (lot: number) => boolean,
	moving: () => boolean,
): Stage {
	return {
		add: (flight) => air.add(flight),
		size,
		seen,
		moves: moving,
		bricks: (grains, until) => cubes.add(grains, until),
		rises: (high) => void (top.value = Math.max(top.value, high)),
		// With motion reduced every change is there at once: nothing is heard.
		hear: (kind, at) => {
			if (moving()) townEar().heard(kind, at);
		},
		knock: (at, high) => {
			if (moving()) townEar().laid(at, high);
		},
	};
}
