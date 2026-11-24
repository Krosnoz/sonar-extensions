// The town's instanced parts: one mesh per model, its instances placed by the world, built by the front in small cubes.
import { attribute, instancedBufferAttribute, renderGroup, uniform, vec4 } from "three/tsl";
import { delays, type Waits } from "./delays";
import { writeTurned } from "./instance-matrix";
import { discsOf, lamplight } from "./lamplight";
import type { Span } from "./layers";
import { layout, lots as lotsOf } from "./lots";
import { THREE, type Vec3, type Vec4 } from "./nodes";
import { material } from "./part-material";
import { pooled } from "./pool-split";
import { PEOPLE, seeThrough } from "./see-through";
import { mergeStill, type Still } from "./still-parts";

type Given = {
	x: number;
	y: number;
	z: number;
	color?: string;
	state?: number;
	seed?: number;
	rx?: number;
	ry?: number;
	s?: number | [number, number, number];
	w?: number;
};
// `put`'s `lot`: the crowd the instance belongs to, for a part with `lots` (./lots.ts).
// `mark`: when an instance of the people is born (the town's second, over 0) or goes (minus that second), in layers
// (./layers.ts); 0, it is there.
// `set`: an instance put before is written again where it stands now, drawn or not; its colour, state, seed and mark
// only when given (./bodies.ts: a figure that changes while the town is open).
export type Part = {
	put: (given: Given, lot?: number) => number;
	move: (index: number, x: number, y: number, z: number, ry?: number, s?: number) => void;
	set: (index: number, given: Given) => void;
	mark: (index: number, at: number) => void;
};
// `people`: the part shows only from the near levels, and comes and goes in small cubes.
// `layers`: its instances are born and go in layers as the people's, but it shows at every level (./scaffolds.ts).
// `span`: the bottom and top of a model born in layers (set by `parts` from its geometry).
// `panes`: the model has windows (set by `parts` from its geometry).
// `through`: the part shows through what hides it, and by night has a pale rim (./see-through.ts).
export type How = {
	moves?: (data: Vec4) => Vec3 | null;
	glow?: number;
	lamp?: number;
	flat?: boolean;
	shadow?: boolean;
	people?: boolean;
	layers?: boolean;
	span?: Span;
	panes?: boolean;
	through?: boolean;
	// The part never moves: with few instances, it is merged with others once the town is built (./still-parts.ts).
	still?: boolean;
	// The instances come in lots (./lots.ts): the part draws only those of the lots the camera sees.
	lots?: boolean;
	// The part stands on a subject's block: it is laid when the block's cubes land (./delays.ts).
	waits?: Waits;
	// A storey laid merge by merge: its instance's `state` says the share laid, the rest is under a net (./site-net.ts#netOf).
	rises?: boolean;
	// "old": what stands on the block the town holds for a subject to come, and leaves when it comes (./plot.ts).
	// "kept": what that block's own front never hides, the same before and after: the line of the land's edge.
	plot?: "old" | "kept";
};

// The values the shaders share: the town's time, the construction's, where the front is, the band it builds, how far
// the sea leads it, the town's bottom and top, and how much of the people shows.
// In three.js's shared group of a render, written once per pass: in the default group of each object, the time that
// changes at every frame wrote every object's block again, in every pass (about 400 writes a frame).
const shared = (value: number) => uniform(value).setGroup(renderGroup);
export function uniforms() {
	return {
		time: shared(0),
		building: shared(0),
		front: shared(-1e6),
		band: shared(1),
		lead: shared(1),
		base: shared(0),
		top: shared(1),
		people: shared(0),
		// The accent the user chose, which a figure born or going glows in (./layers.ts).
		accent: uniform(new THREE.Vector3(1, 1, 1)).setGroup(renderGroup),
		// The way the front goes (./kit.ts#SceneDef): a subject's land is laid where each of its cubes lies along it.
		dir: uniform(new THREE.Vector3(1, 0, 0)).setGroup(renderGroup),
		// How much later each subject's building is laid (./delays.ts).
		delays: delays(),
		// The block the town holds for a subject to come (./plot.ts): its middle (x, z), how far its own front is, and the
		// share of its building's height laid, up to `plotTop`. Far from any block while the town holds none.
		plot: uniform(new THREE.Vector4(1e6, 1e6, -100, -1)).setGroup(renderGroup),
		plotTop: shared(3),
	};
}
export type Uniforms = ReturnType<typeof uniforms>;

// What every part of a town shares: its scene, its values, its lamps' light, its lots, and the list of its parts.
type Kit = {
	scene: THREE.Scene;
	u: Uniforms;
	along: (x: number, y: number, z: number) => number;
	night: boolean;
	tint: THREE.Color;
	dummy: THREE.Object3D;
	lit: ReturnType<typeof lamplight> | null;
	made: { meshes: THREE.InstancedMesh[]; people: boolean; used: () => number }[];
	stills: Still[];
	crowds: ReturnType<typeof lotsOf>;
};

// The part's mesh, added to the scene with nothing drawn yet.
function meshOf(
	k: Kit,
	geometry: THREE.BufferGeometry,
	data: Vec4,
	colour: Vec3,
	capacity: number,
	how: How,
	panes: boolean,
): THREE.InstancedMesh<THREE.BufferGeometry, THREE.MeshStandardNodeMaterial> {
	const mesh = new THREE.InstancedMesh(geometry, material(k.u, data, colour, { ...how, panes }, k.lit), capacity);
	mesh.count = 0;
	mesh.frustumCulled = false;
	mesh.castShadow = how.shadow ?? true;
	mesh.receiveShadow = true;
	if (how.people) mesh.renderOrder = PEOPLE;
	k.scene.add(mesh);
	return mesh;
}

// An instance's matrix, set through an Object3D: turned on two axes, at one scale or three.
function place(
	dummy: THREE.Object3D,
	mesh: THREE.InstancedMesh,
	index: number,
	x: number,
	y: number,
	z: number,
	rx: number,
	ry: number,
	s: number | [number, number, number],
): void {
	dummy.position.set(x, y, z);
	dummy.rotation.set(rx, ry, 0);
	if (typeof s === "number") dummy.scale.setScalar(s);
	else dummy.scale.set(...s);
	dummy.updateMatrix();
	mesh.setMatrixAt(index, dummy.matrix);
}

// A part born in layers knows its model's bottom and top: its instances are born and go in layers between them
// (./layers.ts).
function spanned(whole: THREE.BufferGeometry, how: How): How {
	if (!how.people && !how.layers) return how;
	whole.computeBoundingBox();
	return { ...how, span: [whole.boundingBox!.min.y, whole.boundingBox!.max.y] };
}

// One number of the instances' values, written and sent to the graphics card.
function written(placed: THREE.InstancedInterleavedBuffer, at: number, value: number): void {
	placed.array[at] = value;
	placed.needsUpdate = true;
}

// An instance written again where it lies (`Part.set`): its matrix and its place along the front always, its colour,
// state, seed and mark when given.
function rewritten(
	k: Kit,
	mesh: THREE.InstancedMesh,
	placed: THREE.InstancedInterleavedBuffer,
	tinted: THREE.InstancedInterleavedBuffer,
	lay: ReturnType<typeof layout> | null,
	index: number,
	given: Given,
): void {
	const at = lay ? lay.slotOf(index) : index;
	if (lay) k.crowds.note(lay.lotOf(index), given.x, given.z);
	place(k.dummy, mesh, at, given.x, given.y, given.z, given.rx ?? 0, given.ry ?? 0, given.s ?? 1);
	if (given.color !== undefined) k.tint.set(given.color).toArray(tinted.array, at * 3);
	const values = placed.array;
	values[at * 4] = k.along(given.x, given.y, given.z);
	if (given.state !== undefined) values[at * 4 + 1] = given.state;
	if (given.seed !== undefined) values[at * 4 + 2] = given.seed;
	if (given.w !== undefined) values[at * 4 + 3] = given.w;
	mesh.instanceMatrix.needsUpdate = placed.needsUpdate = tinted.needsUpdate = true;
}

// A part draws `used` instances. One that is not of the people is drawn from its first instance, put with the town or
// later (./scaffolds.ts).
function draws(how: How, meshes: THREE.InstancedMesh[], used: number): void {
	for (const each of meshes) {
		each.count = used;
		if (!how.people) each.visible = true;
	}
}

// One model's part: its mesh, its instances' arrays, and how they are put and moved.
function partOf(k: Kit, whole: THREE.BufferGeometry, count: number, how: How): Part {
	const { u, lit, along, dummy, tint, crowds } = k;
	const [geometry, pools] = pooled(whole);
	const discs = pools && lit ? discsOf(pools) : [];
	const capacity = Math.max(1, count);
	const values = new Float32Array(capacity * 4);
	const tints = new Float32Array(capacity * 3);
	const placed = new THREE.InstancedInterleavedBuffer(values, 4);
	const own = instancedBufferAttribute<"vec4">(placed, "vec4");
	// A geometry that merges pieces built at different times carries where each lies along the front (./city.ts).
	const data = geometry.getAttribute("aAlong") ? vec4(attribute("aAlong", "float"), own.yzw) : own;
	const kinds = geometry.getAttribute("aPart")?.array ?? [];
	const panes = Array.prototype.some.call(kinds, (kind: number) => kind > 5.5 && kind < 6.5);
	const tinted = new THREE.InstancedInterleavedBuffer(tints, 3);
	const colour = instancedBufferAttribute<"vec3">(tinted, "vec3");
	// Where each instance lies in the arrays, when its crowd's lots are drawn only where the camera sees them.
	const lay = how.lots ? layout(crowds, capacity) : null;
	let used = 0;
	const mesh = meshOf(k, geometry, data, colour, capacity, how, panes);
	const followers = how.through ? seeThrough(k.scene, mesh, colour, k.night) : [];
	k.made.push({ meshes: [mesh, ...followers], people: how.people ?? false, used: () => used });
	if (lay)
		crowds.attach(() => {
			const seen = lay.arrange([
				[mesh.instanceMatrix.array, 16],
				[values, 4],
				[tints, 3],
			]);
			mesh.count = seen;
			for (const follower of followers) follower.count = seen;
			mesh.instanceMatrix.needsUpdate = placed.needsUpdate = tinted.needsUpdate = true;
		});
	if (how.still) k.stills.push({ mesh, values, tints, look: JSON.stringify({ ...how, panes }), material: (d, c) => material(u, d, c, { ...how, panes }, lit) });
	return {
		put(given, lot = 0) {
			if (used === capacity) return capacity - 1;
			const index = used++;
			place(dummy, mesh, index, given.x, given.y, given.z, given.rx ?? 0, given.ry ?? 0, given.s ?? 1);
			tint.set(given.color ?? "#ffffff").toArray(tints, index * 3);
			values.set([along(given.x, given.y, given.z), given.state ?? 0, given.seed ?? 0, given.w ?? 0], index * 4);
			lit?.place(discs, dummy.matrix, how.plot === "old");
			if (lay) {
				lay.put(lot, index);
				crowds.note(lot, given.x, given.z);
			}
			draws(how, [mesh, ...followers], used);
			return index;
		},
		move(index, x, y, z, ry = 0, s = 1) {
			// A part not drawn is not moved: the town moves what moves at each frame before drawing it (./kit.ts#frame), so a
			// part shown again is in its place at its first frame. Moved, the people's parts of a town of 10 000 agents
			// were sent to the graphics card at every frame of the whole town's view, where none of them shows.
			if (!mesh.visible) return;
			const at = lay ? lay.slotOf(index) : index;
			if (lay) crowds.note(lay.lotOf(index), x, z);
			writeTurned(mesh.instanceMatrix.array, at, x, y, z, ry, s);
			mesh.instanceMatrix.needsUpdate = true;
			// What moves is built when the front reaches where it is now, not where it started.
			values[at * 4] = along(x, y, z);
			placed.needsUpdate = true;
		},
		set: (index, given) => rewritten(k, mesh, placed, tinted, lay, index, given),
		mark: (index, at) => written(placed, (lay ? lay.slotOf(index) : index) * 4 + 3, at),
	};
}

// `along`: where a point is along the front's way; what is placed there is built when the front passes it. The pools of
// light a model has light the ground by night only (./lamplight.ts).
// `shown(people, all)`: which parts are drawn. A part without instances is not, nor the people's parts while none of
// them shows (`people` false): drawn, a part whose every pixel its mask leaves out cost as much script as any other (its
// bindings, its state), in the town's pass and in the sun's. `all` draws every part, for the programs to be prepared.
export function parts(scene: THREE.Scene, u: Uniforms, along: (x: number, y: number, z: number) => number, night: boolean) {
	const tint = new THREE.Color();
	const dummy = new THREE.Object3D();
	const lit = night ? lamplight() : null;
	const made: Kit["made"] = [];
	const stills: Still[] = [];
	const crowds = lotsOf();
	const kit: Kit = { scene, u, along, night, tint, dummy, lit, made, stills, crowds };
	const shown = (people: boolean, all = false): void => {
		for (const part of made) for (const mesh of part.meshes) mesh.visible = all || (part.used() > 0 && (people || !part.people));
	};
	const part = (whole: THREE.BufferGeometry, count: number, how: How = {}): Part => partOf(kit, whole, count, spanned(whole, how));
	// Called once the town is built.
	const settle = (): void => mergeStill(scene, stills);
	// The lamps of the block held at (x, z) light the ground: the old ones until `built`, its subject's own from then on.
	const hold = (x: number, z: number, built: boolean): void => lit?.hold(x, z, built);
	return { part, shown, settle, hold, cull: crowds.cull, inView: crowds.seen };
}
