// The names of the inhabitants: where they go, how many show, and when a building hides them (pure functions of
// ./signs.ts and ./heights.ts).
import { expect, test } from "bun:test";
import "./signs-test-page";

const signs = { ...(await import("./signs.ts")), ...(await import("./sign-geometry.ts")), ...(await import("./sign-names.ts")) };
const { fits, nameBox } = signs;

test("an inhabitant's name comes after the subjects: a place taken by a subject hides it", () => {
	const taken = [[480, 280, 560, 300]];
	const [x, y, w, h] = [520, 300, 80, 20];
	const [a, b, c, d] = nameBox(x, y, w, h);
	// The box is above the head, centred.
	expect([a, c]).toEqual([x - w / 2, x + w / 2]);
	expect(d).toBeLessThan(y);
	expect(fits(taken, a, b, c - a, d - b)).toBe(false);
	expect(fits([], a, b, c - a, d - b)).toBe(true);
});

test("an inhabitant's name at the screen's edge keeps the edge's margin, as the subjects' labels do", () => {
	const { nameInside, NAME_GAP } = signs;
	const [width, tall, bar, margin] = [1440, 900, 64, 16];
	const [w, h] = [140, 28];
	// The case seen (computer, 1 000 agents, near view): « Autonome security » 5 px from the left edge.
	const at = (x: number, y: number) => nameBox(x, y, w, h);
	expect(nameInside(at(5 - NAME_GAP + w / 2, 400), width, tall, bar, margin)).toBe(false);
	expect(nameInside(at(margin - NAME_GAP + w / 2, 400), width, tall, bar, margin)).toBe(true);
	// On the right, at the bottom and under the top bar: the same margin.
	expect(nameInside(at(width - 5 + NAME_GAP - w / 2, 400), width, tall, bar, margin)).toBe(false);
	expect(nameInside(at(700, tall - 5), width, tall, bar, margin)).toBe(false);
	expect(nameInside(at(700, bar + h + 5), width, tall, bar, margin)).toBe(false);
	expect(nameInside(at(700, 400), width, tall, bar, margin)).toBe(true);
});

test("an inhabitant behind a building has no name; in front, or above the roofs, it has one", async () => {
	const { heightMap } = await import("./heights.ts");
	const heights = heightMap();
	// A building of 4 × 4, 6 high, centred on (0, 0).
	heights.add(-2, -2, 2, 2, 6);
	// The camera looks from +x, from above: the ray from the head towards it rises towards +x.
	const toward = [Math.cos(0.6), Math.sin(0.6), 0] as const;
	expect(heights.hides([-3, 1.6, 0], toward)).toBe(true);
	expect(heights.hides([3, 1.6, 0], toward)).toBe(false);
	// Beside the building, out of its ray.
	expect(heights.hides([-3, 1.6, 5], toward)).toBe(false);
	// Against the wall, on the camera's side: not hidden by its own wall.
	expect(heights.hides([2.1, 1.6, 0], toward)).toBe(false);
	// Above the roof.
	expect(heights.hides([-3, 7, 0], toward)).toBe(false);
});

test("an inhabitant's body is a box from its feet to its head: a label does not go over it", () => {
	const { bodyBox } = signs;
	const [left, top, right, bottom] = bodyBox(100, 140, 100);
	expect([top, bottom]).toEqual([100, 140]);
	expect(right - left).toBeCloseTo(17.6);
	// The case seen: the end of a subject's label touched an inhabitant at its right edge.
	expect(fits([[left, top, right, bottom]], right - 40, 110, 50, 30)).toBe(false);
	expect(fits([[left, top, right, bottom]], right + 1, 110, 50, 30)).toBe(true);
	// A tiny inhabitant keeps 4 px of width at least.
	expect(bodyBox(10, 12, 8)[2] - bodyBox(10, 12, 8)[0]).toBe(4);
});

test("at a thousand agents, two names per zone of the screen, those who wait first, then those to review, then those at work", () => {
	const { nameZone, nameRank, NAMES_PER_ZONE } = signs;
	expect(NAMES_PER_ZONE).toBe(2);
	expect(nameZone(10, 10)).toBe(nameZone(100, 100));
	expect(nameZone(10, 10)).not.toBe(nameZone(130, 10));
	// States: 0 neutral, 1 at work, 2 waiting, 3 to review.
	const states = [0, 1, 2, 3, 1, 2];
	const order = states.map((_, at) => at).sort((a, b) => nameRank(states[a]!) - nameRank(states[b]!));
	expect(order.map((at) => states[at])).toEqual([2, 2, 3, 1, 1, 0]);
	// A crowd of 1000 in one zone: two names at most, the two that wait.
	const crowd = new Map<string, number>();
	const shown = Array.from({ length: 1000 }, (_, at) => (at < 2 ? 2 : 1))
		.sort((a, b) => nameRank(a) - nameRank(b))
		.filter((state) => {
			const zone = nameZone(50, 50);
			if ((crowd.get(zone) ?? 0) >= NAMES_PER_ZONE) return false;
			crowd.set(zone, (crowd.get(zone) ?? 0) + 1);
			return state === 2 || state === 1;
		});
	expect(shown).toEqual([2, 2]);
});

test("a name shown stays while the roof in front of its inhabitant does not rise 0.3 above the ray; a name hidden waits until the ray passes 0.1 above it", async () => {
	const { heightMap } = await import("./heights.ts");
	const heights = heightMap();
	heights.add(-2, -2, 2, 2, 6);
	const toward = [Math.cos(0.6), Math.sin(0.6), 0] as const;
	// A head whose ray passes 0.2 under the roof's corner: a name shown stays, a name hidden does not come back.
	const y = 6 - 0.2 - Math.tan(0.6);
	expect(heights.hides([-3, y, 0], toward, 0.3)).toBe(false);
	expect(heights.hides([-3, y, 0], toward, -0.1)).toBe(true);
	// 0.6 under the corner: hidden for both.
	expect(heights.hides([-3, y - 0.4, 0], toward, 0.3)).toBe(true);
	// 0.2 above: shown for both.
	expect(heights.hides([-3, y + 0.4, 0], toward, -0.1)).toBe(false);
});
