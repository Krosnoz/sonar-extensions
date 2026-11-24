// The town's inhabitants and their robots are seen from the camera: on the real geometries of the town's blocks, a ray
// from each figure's body to the camera is not stopped by a building, a tree or a table. No process, no graphics card:
// the town is built on a kit that only records what it is asked to draw (the drawing itself is tests/page/world.page.ts's).
// A figure at rest or its robots hidden in the wall of the ground floor, or behind the tree of the square, went
// unseen for a subject with subagents (11/11).

import { expect, test } from "bun:test";
import { uniform, vec3 } from "three/tsl";
import type { Agent, Kit, Topic } from "./kit";
import { THREE } from "./nodes";
import type { Part } from "./parts";

// The town's modules read the page's storage and address (../state.ts).
const page = globalThis as Record<string, unknown>;
page["localStorage"] ??= { getItem: () => null };
page["location"] ??= { href: "http://127.0.0.1/" };
const { PITCH, R } = await import("./grid");
const { town } = await import("./town");
const { LOOKS } = await import("./figures");
const { T } = await import("./shapes");

type Put = { position: THREE.Vector3; rx: number; ry: number; scale: THREE.Vector3 };
// `from`: the file and line that made the part, to name what hides a figure.
type Recorded = { geometry: THREE.BufferGeometry; figure: boolean; puts: Put[]; from: string };
// A place keeps figures for who comes while the town is open, and each figure a second body (./bodies.ts), at a scale
// of 0: they do not show.
const shownOf = (part: Recorded): Put[] => part.puts.filter((put) => put.scale.x > 0);

// The first caller out of the kit's stand-in, as "file.ts:line".
const callerOf = (stack = ""): string => {
	const frames = stack.split("\n").slice(1);
	const frame = frames.find((line) => /\.ts:\d+/.test(line) && !line.includes("figures-visible.test.ts")) ?? "";
	return (
		frame
			.match(/([\w.-]+\.ts):(\d+)/)
			?.slice(1, 3)
			.join(":") ?? stack
	);
};

// A kit that draws nothing: it keeps where each part's instances stand, and moves them as the real parts do.
function recording(): { kit: Kit; parts: Recorded[] } {
	const parts: Recorded[] = [];
	let seed = 7;
	const kit = {
		night: false,
		aspect: 1.6,
		random: () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296,
		uTime: uniform(0),
		scene: new THREE.Scene(),
		blank: vec3(0, 0, 0),
		along: () => 0,
		part(geometry, _count, how = {}): Part {
			const recorded: Recorded = { geometry, figure: how.people === true, puts: [], from: callerOf(new Error().stack) };
			parts.push(recorded);
			const set = (put: Put, x: number, y: number, z: number, rx: number, ry: number, s: number | [number, number, number]): void => {
				put.position.set(x, y, z);
				if (typeof s === "number") put.scale.setScalar(s);
				else put.scale.set(...s);
				[put.rx, put.ry] = [rx, ry];
			};
			return {
				put: (given) => {
					const put: Put = { position: new THREE.Vector3(), rx: 0, ry: 0, scale: new THREE.Vector3() };
					set(put, given.x, given.y, given.z, given.rx ?? 0, given.ry ?? 0, given.s ?? 1);
					return recorded.puts.push(put) - 1;
				},
				move: (index, x, y, z, ry = 0, s = 1) => set(recorded.puts[index]!, x, y, z, 0, ry, s),
				set: (index, given) => set(recorded.puts[index]!, given.x, given.y, given.z, given.rx ?? 0, given.ry ?? 0, given.s ?? 1),
			};
		},
	} satisfies Kit;
	return { kit, parts };
}

// The figures are the town's parts that come and go with the near levels, in the order inhabitants.ts makes them: a
// person of each look, then the robots (the crates, bubbles and marks they carry are not looked at). With three looks
// written here, the fourth look stood for the robots once there were five, and no robot was looked at.
const PEOPLE = Array.from({ length: LOOKS }, (_, look) => look);
const ROBOTS = LOOKS;

// The camera looks down at the town from this side (./camera.ts).
const TOWARDS_CAMERA = new THREE.Vector3(Math.cos(PITCH) * R, Math.sin(PITCH), Math.cos(PITCH) * R);
const material = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });

const meshOf = (geometry: THREE.BufferGeometry, put: Put): THREE.Mesh => {
	const mesh = new THREE.Mesh(geometry, material);
	mesh.position.copy(put.position);
	mesh.rotation.set(put.rx, put.ry, 0);
	mesh.scale.copy(put.scale);
	mesh.updateMatrixWorld();
	return mesh;
};

// Subagents as a card lists them, 1 for one at work: a card with six of them, with one, with none.
const CHILDREN = [[1, 0, 1, 0, 1, 0], [0], []];
const topicOf = (index: number, state: number, agents: number): Topic => ({
	name: `Subject ${index}`,
	agents: Array.from({ length: agents }, (_, at): Agent => ({ name: `Agent ${at}`, state, seed: 0.13 + at * 0.29, children: CHILDREN[at % CHILDREN.length]! })),
	working: state === 1 ? agents : 0,
	waiting: state === 2 ? agents : 0,
	reviewing: state === 3 ? agents : 0,
});

// Nine subjects: every block's variant (the square's centre) with every style of building.
const SUBJECTS = 9;
const subjects = (state: number, agents: number): Topic[] => Array.from({ length: SUBJECTS }, (_, index) => topicOf(index, state, agents));
const SAMPLES = [0.1, 0.3, 0.5, 0.7, 0.9];

// The town's fixed pieces are one solid of 114 000 triangles, and three.js tries a ray against each triangle of a solid
// it crosses: 4 500 rays lasted over a minute, the test's limit (13/11). The solid is cut into pieces of a few hundred
// triangles in a row (the boxes of a same building), each with the sphere of its own triangles: a ray is tried against
// the pieces it crosses.
const PIECE = 300 * 3;
function cut(mesh: THREE.Mesh): THREE.Mesh[] {
	const { geometry } = mesh;
	const position = geometry.getAttribute("position");
	const count = geometry.index?.count ?? position.count;
	if (count <= PIECE) return [mesh];
	const [point, box] = [new THREE.Vector3(), new THREE.Box3()];
	return Array.from({ length: Math.ceil(count / PIECE) }, (_, at) => {
		const [start, end] = [at * PIECE, Math.min(count, (at + 1) * PIECE)];
		const piece = new THREE.BufferGeometry().setAttribute("position", position).setIndex(geometry.index);
		piece.setDrawRange(start, end - start);
		box.makeEmpty();
		for (let vertex = start; vertex < end; vertex++) box.expandByPoint(point.fromBufferAttribute(position, geometry.index?.getX(vertex) ?? vertex));
		piece.boundingSphere = box.getBoundingSphere(new THREE.Sphere());
		const part = new THREE.Mesh(piece, mesh.material);
		part.matrixWorld.copy(mesh.matrixWorld);
		part.userData["from"] = mesh.userData["from"];
		return part;
	});
}

// Who is hidden, as "subject (variant, style) kind at x, z of its block, behind what", with the share of its body the
// camera sees: a figure is seen when at least half of the points along its height are. `venues`: only the figures of
// the venues (./venues.ts) are looked at, and the other inhabitants hide them too; `squares`: with `venues`, only those
// of the subjects' own squares instead.
function hidden(topics: Topic[], seconds: number[], venues = false, squares = false): { name: string; seen: number }[] {
	const { kit, parts } = recording();
	const world = town.build(kit, topics);
	const figures = parts.filter((part) => part.figure);
	const bodies = [...PEOPLE.map((each) => figures[each]!), figures[ROBOTS]!];
	const fixed = parts
		.filter((part) => !part.figure)
		.flatMap((part) =>
			part.puts.flatMap((put) => {
				const mesh = meshOf(part.geometry, put);
				mesh.userData["from"] = part.from;
				return cut(mesh);
			}),
		);
	// On no subject's block: a venue.
	const onVenue = (put: Put): boolean => world.lots.every(({ at }) => Math.max(Math.abs(put.position.x - at[0]), Math.abs(put.position.z - at[1])) > T / 2);
	const ray = new THREE.Raycaster();
	// The solids whose sphere a ray crosses, told here once for all: asked each solid, three.js inverts its matrix for
	// each ray, and 4 500 rays by thousands of solids lasted over a minute on a busy machine (13/11).
	const sphereOf = (mesh: THREE.Mesh): THREE.Sphere => {
		if (!mesh.geometry.boundingSphere) mesh.geometry.computeBoundingSphere();
		return mesh.geometry.boundingSphere!.clone().applyMatrix4(mesh.matrixWorld);
	};
	const fixedSpheres = fixed.map(sphereOf);
	// With `venues`, the inhabitants where they stand at the second looked at, each but the one looked at.
	let [solids, spheres] = [fixed, fixedSpheres];
	const towards = TOWARDS_CAMERA.clone().normalize();
	const offset = new THREE.Vector3();
	const crossed = (from: THREE.Vector3, self: Put): THREE.Mesh[] =>
		solids.filter((mesh, index) => {
			if (mesh.userData["put"] === self) return false;
			const { center, radius } = spheres[index]!;
			const along = offset.subVectors(center, from).dot(towards);
			return along > -radius && offset.lengthSq() - along * along <= radius * radius;
		});
	// The subject whose block a point stands in, and where in it.
	const blockOf = (at: THREE.Vector3): { lot: number; x: number; z: number } => {
		const near = (lot: number): number => Math.max(Math.abs(at.x - world.lots[lot]!.at[0]), Math.abs(at.z - world.lots[lot]!.at[1]));
		const lot = world.lots.map((_, index) => index).sort((a, b) => near(a) - near(b))[0]!;
		return { lot, x: at.x - world.lots[lot]!.at[0], z: at.z - world.lots[lot]!.at[1] };
	};
	// The share of the figure's height in sight, and what stops the first ray that is stopped: the file that made it, and
	// where its instance stands in the figure's block.
	const seen = (part: Recorded, put: Put): { share: number; behind: string } => {
		part.geometry.computeBoundingBox();
		const { min, max } = part.geometry.boundingBox!;
		let behind = "";
		const clear = SAMPLES.filter((share) => {
			const from = new THREE.Vector3(put.position.x, put.position.y + put.scale.y * (min.y + share * (max.y - min.y)), put.position.z);
			ray.set(from, TOWARDS_CAMERA);
			const hit = ray.intersectObjects(crossed(from, put), false)[0];
			if (hit && !behind) {
				const { x, z } = blockOf(hit.point);
				// The block of what hides, from the figure's: 0, 1 for the block in front.
				const [di, dj] = [Math.round(hit.point.x / T) - Math.round(put.position.x / T), Math.round(hit.point.z / T) - Math.round(put.position.z / T)];
				behind = `${String(hit.object.userData["from"])}, hit at ${x.toFixed(2)}, ${hit.point.y.toFixed(2)}, ${z.toFixed(2)} (block ${di}, ${dj} from its own, ${(hit.point.x - from.x).toFixed(2)}, ${(hit.point.z - from.z).toFixed(2)} from it)`;
			}
			return !hit;
		});
		return { share: clear.length / SAMPLES.length, behind };
	};
	const unseen: { name: string; seen: number }[] = [];
	for (const second of seconds) {
		world.tick(second);
		if (venues) {
			const others = bodies.flatMap((part) =>
				shownOf(part).map((put) => {
					const mesh = meshOf(part.geometry, put);
					Object.assign(mesh.userData, { from: "an inhabitant", put });
					return mesh;
				}),
			);
			[solids, spheres] = [
				[...fixed, ...others],
				[...fixedSpheres, ...others.map(sphereOf)],
			];
		}
		for (const [kind, part] of [...PEOPLE.map((each) => ["person", figures[each]!] as const), ["robot", figures[ROBOTS]!] as const])
			for (const put of shownOf(part)) {
				if (venues && onVenue(put) === squares) continue;
				const { share, behind } = seen(part, put);
				if (share >= 0.5) continue;
				// A venue's figure: where in its own block.
				const { lot, x, z } = venues
					? { lot: -1, x: put.position.x - Math.round(put.position.x / T) * T, z: put.position.z - Math.round(put.position.z / T) * T }
					: blockOf(put.position);
				const style = (lot * 2 + Math.floor(lot / 3)) % 3;
				unseen.push({
					name: `subject ${lot} (variant ${lot % 3}, style ${style}) ${kind} at ${x.toFixed(2)}, ${z.toFixed(2)} (${second}s), behind ${behind}`,
					seen: share,
				});
			}
	}
	return unseen;
}

const STATES = [
	["at rest", 0],
	["waiting for the user", 2],
	["to review", 3],
] as const;
// Building the town and casting its rays takes 1 s alone, up to 47 s when the machine is busy (bun's default is 5 s).
for (const [name, state] of STATES)
	for (const agents of [1, 3])
		test(`town: the people ${name} and their robots are seen, ${agents} agent${agents > 1 ? "s" : ""} in a block`, () => {
			expect(hidden(subjects(state, agents), [0])).toEqual([]);
		}, 60_000);

// At work they walk round the square and pass behind its centre and the buildings now and then: over a round of the
// square (about 25 s), at most a quarter of what is looked at is behind something.
test("town: the people at work and their robots are seen most of the round", () => {
	const seconds = Array.from({ length: 10 }, (_, at) => at * 2.5);
	// Per block: 3 agents and 7 robots (6 + 1 + 0).
	const looked = seconds.length * SUBJECTS * (3 + 7);
	const missed = hidden(subjects(1, 3), seconds).length;
	expect(missed / looked).toBeLessThan(0.25);
}, 60_000);

// A town of 1 000 agents dealt among `count` subjects in turn: each its state, a sixth with two robots. Among 12 subjects each has one state: venues of walkers only, of people at rest only.
const crowded = (count: number): Topic[] => {
	const topics = Array.from({ length: count }, (_, index) => ({ ...topicOf(index, 0, 0), agents: [] as Agent[] }));
	for (let at = 0; at < 1000; at++)
		topics[at % count]!.agents.push({ name: `Agent ${at}`, state: at % 4, seed: (0.13 + at * 0.618034) % 1, children: at % 6 === 0 ? [1, 0] : [] });
	return topics;
};
// The crowds of the venues are seen one by one, from the camera's home: behind no building, tree, lamp nor inhabitant,
// those who stand as those who walk, at the start of the town's life and 40 s later.
for (const count of [9, 12])
	test(`town: 1 000 agents among ${count} subjects, every inhabitant and robot of a venue is seen`, () => {
		expect(hidden(crowded(count), [0, 40], true)).toEqual([]);
	}, 120_000);

// The crowds of the subjects' own squares too, each agent's two robots in a column at its right: two robots of a town
// of 1 000 stood behind the agent next on their right (14/11). Among 9 subjects, every state shares a square.
test("town: 1 000 agents among 9 subjects, every inhabitant and robot of a subject's square is seen", () => {
	expect(hidden(crowded(9), [0, 40], true, true)).toEqual([]);
}, 120_000);
