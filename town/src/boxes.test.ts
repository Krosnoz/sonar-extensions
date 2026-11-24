// A box of the town is made from one box built once, scaled: a city made thousands of them, each a new BoxGeometry
// turned into an unindexed copy, then turned three times by an angle of zero. The town's build froze the page 2 to 3 s
// after the click (13/11).

import { expect, test } from "bun:test";

const page = globalThis as Record<string, unknown>;
page["matchMedia"] ??= () => ({ matches: false });
page["document"] ??= { documentElement: { dataset: {} } };
page["getComputedStyle"] ??= () => ({ paddingTop: "0" });
await import("./test-page");
const { THREE } = await import("./nodes");
const { b, tone } = await import("./shapes");

// The box as it was made before: three.js's box, unindexed, turned, moved, coloured.
function before(hex: string, w: number, h: number, d: number, x: number, y: number, z: number, part: number, turn: [number, number, number]) {
	const made = new THREE.BoxGeometry(w, h, d).toNonIndexed();
	made
		.rotateX(turn[0])
		.rotateY(turn[1])
		.rotateZ(turn[2])
		.translate(x, y + h / 2, z);
	const count = made.getAttribute("position").count;
	const colors = new Float32Array(count * 3);
	const tint = new THREE.Color(tone(hex));
	for (let each = 0; each < count; each++) tint.toArray(colors, each * 3);
	made.setAttribute("color", new THREE.BufferAttribute(colors, 3));
	made.setAttribute("aPart", new THREE.BufferAttribute(new Float32Array(count).fill(part), 1));
	return made;
}

const CASES: [string, number, number, number, number, number, number, number, [number, number, number]][] = [
	["#c9a58a", 1, 2, 3, 0, 0, 0, 0, [0, 0, 0]],
	["#56637a", 0.13, 2.7, 0.04, 1.5, -0.2, 3.3, 8.31, [0, 0, 0]],
	["#e9dcc4", 4.4, 0.1, 2.05, -7, 1.1, 0.4, 2, [0, 0.7, 0]],
	["#9db5a6", 0.3, 0.3, 0.3, 2, 3, 4, 6, [0.2, -1.1, 0.5]],
];

test("a box is the same as three.js's, unindexed, turned and moved", () => {
	for (const each of CASES) {
		const [made, reference] = [b(...each), before(...each)];
		expect(made.index).toBeNull();
		expect(made.groups).toEqual(reference.groups);
		expect(Object.keys(made.attributes).toSorted()).toEqual(Object.keys(reference.attributes).toSorted());
		for (const name of Object.keys(reference.attributes)) {
			const [mine, theirs] = [made.getAttribute(name), reference.getAttribute(name)];
			expect(mine.itemSize).toBe(theirs.itemSize);
			const turned = each[8].some((angle) => angle !== 0);
			// Turned, the angle's matrix is applied as before; an angle of zero, no more: the same values, to a float's last bit.
			[...mine.array].forEach((value, at) => (turned ? expect(value).toBeCloseTo(theirs.array[at]!, 5) : expect(value).toBe(theirs.array[at]!)));
		}
	}
});

test("a box is made without building three.js's box again", () => {
	// The method is kept to be called on its own geometry (`call` below), then put back.
	// oxlint-disable-next-line typescript/unbound-method
	const unindexed = THREE.BufferGeometry.prototype.toNonIndexed;
	let copies = 0;
	THREE.BufferGeometry.prototype.toNonIndexed = function (this: InstanceType<typeof THREE.BufferGeometry>) {
		copies++;
		return unindexed.call(this);
	};
	try {
		for (let at = 0; at < 50; at++) b("#c9a58a", 1 + at, 2, 3, at, 0, 0);
	} finally {
		THREE.BufferGeometry.prototype.toNonIndexed = unindexed;
	}
	// The one box built once, at most.
	expect(copies).toBeLessThanOrEqual(1);
});
