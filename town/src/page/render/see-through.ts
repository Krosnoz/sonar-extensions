// Every inhabitant stays in sight. Where a wall, a roof or a tree stands between it and the camera, its silhouette shows
// through, drawn where the depth test fails: the occlusion silhouette of isometric games (Two Point Hospital's staff
// behind a wall, Torchlight 2's hero behind a pillar), a line of its state's colour round a light fill. By night, a rim
// round each one parts it from the ground: its coat, its trousers or its beanie had the ground's value (1.0 to 1.3:1).
import { attribute, cameraProjectionMatrix, float, length, mix, mrt, normalLocal, positionLocal, screenSize, uniform, vec3, vec4 } from "three/tsl";
import { THREE, typed, type Node, type Vec3 } from "./nodes";

// How much of the state's colour the silhouette's fill lays over the wall: light, so that it reads as behind the wall,
// its line saying the figure. At 0.5 over every piece, a figure's overlapping pieces summed into one saturated column.
const GHOST = 0.3;
// The silhouette's line, in pixels of the screen: one, as a drawing's.
const LINE = 1;
// The night's rim, in pixels of the screen, a twentieth of the figure's height, from 1 (a figure of 20 px, on the
// phone) to 1.5 (a figure seen near). At 3 pixels of the drawing everywhere, a small figure wore a halo, and the rims of
// a tight crowd met in one pale slab.
const RIM = [1, 1.5, 0.05] as const;
// A figure's height in its model (../people/figures.ts#person).
const TALL = 0.7;
// How far towards white the rim takes the state's colour: pale enough to stand off the night's ground at 3:1 (the
// paving, out of the pools, is the lightest), still its state. ./outline.ts finds the state's colour back from it.
export const PALE = 0.75;

// Pixels of the drawing per pixel of the screen (the quality's ratio, ./quality.ts), kept by ./pipeline.ts.
export const drawingRatio = uniform(2);

// The rims are drawn after the town, the silhouettes' fills, then their lines, and the people after them: a silhouette
// shows through a wall, never through its own figure nor through another inhabitant, which have not written their depth
// yet; a figure covers its own rim, which writes no depth, and only its edge is left. A rim never lies over a neighbour:
// every figure covers every rim.
const [BEHIND, FILL, LINED] = [1, 1.3, 1.6];
export const PEOPLE = 2;

// The meshes that follow `mesh`: the same instances, places and moves (its `instanceMatrix`), the same cubes shown (its
// material's mask). `tint`: each instance's state colour. Their `count` is kept equal to `mesh`'s by the caller.
export function seeThrough(
	scene: THREE.Scene,
	mesh: THREE.InstancedMesh<THREE.BufferGeometry, THREE.MeshStandardNodeMaterial>,
	tint: Vec3,
	night: boolean,
): THREE.InstancedMesh[] {
	const base = mesh.material;
	// three.js types a material's position as a bare node: the town's materials set a position (./part-material.ts).
	const moved = typed(base.positionNode ?? positionLocal, "vec3");
	const out = mesh.geometry.getAttribute("aOut");
	// The figure grown on every side, each piece by itself (../people/figures.ts#outward). The hull takes the way out as its
	// normal, so that three.js turns it with each instance.
	const hull = new THREE.BufferGeometry();
	for (const [name, values] of Object.entries(mesh.geometry.attributes)) hull.setAttribute(name, name === "normal" && out ? out : values);
	// The camera is orthographic: a pixel of the screen is 2 × ratio / (P[1][1] × the drawing's height) world units.
	const pixel = drawingRatio.mul(2).div(cameraProjectionMatrix.mul(vec4(0, 1, 0, 0)).y.mul(screenSize.y));
	// three.js hands the normal turned by the instance's matrix, divided by its scale: the instance's scale is what the
	// way out lost.
	const way = attribute("aOut", "vec3");
	const scale = length(way).div(length(normalLocal).max(1e-6));
	const grown = (pixels: Node): Vec3 => moved.add(normalLocal.normalize().mul(length(way)).mul(pixel.mul(pixels)));
	// One normal, facing the camera, for the whole silhouette: the outline pass (./outline.ts) creases where normals turn,
	// and drew each limb and fold of the figure over the wall.
	const facing = mrt({ normal: vec3(0, 0, 1) });
	// Drawn where the figure is behind what the town drew, once a pixel: the stencil keeps a fill's overlapping pieces
	// (the head, the hair, the jacket) from summing, and the line from crossing the fill. The alpha already written (the
	// page under a town still being built) stays as it is. Blended without being transparent: three.js keeps it in the
	// opaque list, where `renderOrder` places it.
	const behind = (material: THREE.MeshBasicNodeMaterial): THREE.MeshBasicNodeMaterial =>
		Object.assign(material, {
			blending: THREE.CustomBlending,
			blendSrc: THREE.SrcAlphaFactor,
			blendDst: THREE.OneMinusSrcAlphaFactor,
			blendSrcAlpha: THREE.ZeroFactor,
			blendDstAlpha: THREE.OneFactor,
			depthWrite: false,
			depthFunc: THREE.GreaterDepth,
			stencilWrite: true,
			stencilRef: 1,
			stencilFunc: THREE.NotEqualStencilFunc,
			stencilZPass: THREE.ReplaceStencilOp,
			maskNode: base.maskNode,
			mrtNode: facing,
		});
	const fill = behind(new THREE.MeshBasicNodeMaterial());
	fill.colorNode = tint;
	fill.opacityNode = float(GHOST);
	fill.positionNode = moved;
	const made = [follower(scene, mesh, mesh.geometry, fill, FILL)];
	if (!out) return made;
	const line = behind(new THREE.MeshBasicNodeMaterial());
	line.colorNode = tint;
	line.positionNode = grown(float(LINE));
	made.push(follower(scene, mesh, hull, line, LINED));
	if (!night) return made;
	// Unlit, drawn under the figure: its edge is a line between the figure's ink and the ground. As an inverted hull pushed
	// behind the figure, it stood over the face (a beanie's grown piece), or sank under the ground at the feet.
	const rim = new THREE.MeshBasicNodeMaterial({ depthWrite: false });
	rim.colorNode = mix(tint, vec3(1), PALE);
	// A normal no face seen can have marks the rim for the outline pass, which turns it dark on a light ground.
	rim.mrtNode = mrt({ normal: vec3(0, 0, -1) });
	const tall = scale.mul(TALL).div(pixel);
	rim.positionNode = grown(tall.mul(RIM[2]).clamp(RIM[0], RIM[1]));
	rim.maskNode = base.maskNode;
	made.push(follower(scene, mesh, hull, rim, BEHIND));
	return made;
}

function follower(scene: THREE.Scene, mesh: THREE.InstancedMesh, geometry: THREE.BufferGeometry, material: THREE.Material, order: number): THREE.InstancedMesh {
	const made = new THREE.InstancedMesh(geometry, material, 1);
	made.instanceMatrix = mesh.instanceMatrix;
	made.count = 0;
	made.frustumCulled = false;
	made.renderOrder = order;
	scene.add(made);
	return made;
}
