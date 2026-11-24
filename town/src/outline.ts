// three.js's pixel pass, drawn at one pixel of the drawing, with its own edges: a dark outline at the edge of each
// detail, as an illustration's ink, and a shade on its folds.
import { DepthStencilFormat, UnsignedInt248Type, type Camera, type Scene, type TextureNode, type UniformNode } from "three/webgpu";
import PixelationPassNode from "three/addons/tsl/display/PixelationPassNode.js";
import { Fn, If, uniform, float, uv, vec2, vec3, clamp, dot, smoothstep, sign, step, property, vec4, textureSize, max, min, mix } from "three/tsl";
import { typed, type Node, type Vec3 } from "./nodes";
import { PALE } from "./see-through";

// The ground's luminance, as drawn, over which the night's rim turns dark: a lamp's pool (0.4 to 0.5), not the paving
// out of it (0.21), so that a rim on the paving does not hesitate between both, pixel by pixel. The pale rim (0.85)
// stands at 3.1:1 at least under it, the dark one (0.02) at 4.1:1 at least past it.
const RIM_GROUND = 0.24;
// The dark rim, in its state's colour.
const RIM_DARK = 0.05;
// The ink: the depth step that draws a line, as a share of the camera's depth; the line's strength; the folds' shade.
const THRESHOLD = 0.00025;
const STRENGTH = 1;
const CREASE = 0.3;

// What each step of the pass's drawing reads of the pixel and of the pass's textures.
type Reads = {
	at: Node<"vec2">;
	invSize: Node<"vec2">;
	reach: UniformNode<"float">;
	depth: Node;
	normal: Vec3;
	threshold: Node;
	textureNode: TextureNode;
	depthNode: TextureNode;
	normalNode: TextureNode;
	sampleDepth: (where: Node<"vec2">) => Node;
	sampleNormal: (where: Node<"vec2">) => Vec3;
};

// The depth of the neighbour on side (x, y), and its fold with the pixel added to `creased`.
function side(r: Reads, creased: Node, x: number, y: number): Node {
	const there = r.at.add(vec2(x, y).mul(r.reach).mul(r.invSize));
	const other = r.sampleDepth(there).toConst();
	const otherNormal = r.sampleNormal(there);
	const turned = float(1).sub(dot(r.normal, otherNormal));
	const front = clamp(sign(other.sub(r.depth).mul(0.25).add(0.0000025)), 0, 1);
	const bias = clamp(smoothstep(-0.01, 0.01, dot(r.normal.sub(otherNormal), vec3(1, 1, 1))), 0, 1);
	creased.addAssign(turned.mul(front).mul(bias));
	return other;
}

// The night's rim (./see-through.ts) takes its value against the ground drawn round it: pale on a dark ground,
// dark on a light one (the paving, a lamp's pool), where the pale rim stood at 1.3:1. The ground is what lies
// round it, past the rim's width, in eight directions.
// Read on a rim's pixels only, and while the tier keeps it (./quality.ts): over the whole screen, by day too, it
// cost 25 of the 36 reads of each pixel. In a branch, each texture is read at its one level: a shader may not
// guess a level where neighbouring pixels may take the other way.
function darkRim(r: Reads, toned: UniformNode<"float">): Node {
	const dark = float(0).toVar();
	If(r.normalNode.sample(r.at).z.lessThanEqual(-0.5).and(toned.greaterThan(0)), () => {
		let seen: Node = float(0);
		let lit: Node = float(0);
		for (const [x, y] of [
			[1, 1],
			[-1, 1],
			[1, -1],
			[-1, -1],
			[1.4, 0],
			[-1.4, 0],
			[0, 1.4],
			[0, -1.4],
		]) {
			const there = r.at.add(vec2(x, y).mul(r.reach).mul(2.5).mul(r.invSize));
			// Neither the figure (nearer) nor a rim (pale, at the ground's depth: it counted as a light ground).
			const ground = step(r.depth.sub(r.threshold), r.depthNode.sample(there).level(float(0)).r).mul(step(-0.5, r.normalNode.sample(there).level(float(0)).z));
			seen = seen.add(ground);
			lit = lit.add(ground.mul(dot(r.textureNode.sample(there).level(float(0)).rgb, vec3(0.2126, 0.7152, 0.0722))));
		}
		dark.assign(step(1.5, seen).mul(step(RIM_GROUND, lit.div(max(seen, 1)))));
	});
	return dark;
}

export class OutlinePassNode extends PixelationPassNode {
	// A uniform: the drawing's density can change (./quality.ts) without the program being prepared again.
	reach: UniformNode<"float">;
	// 0: the night's rim keeps its pale colour on any ground (a low tier, ./quality.ts).
	toned: UniformNode<"float">;

	constructor(scene: Scene, camera: Camera, reach = 1) {
		super(scene, camera, 1, 0.3, 0.4);
		// A stencil with the depth: a silhouette behind a wall (./see-through.ts) is drawn once a pixel, its line round it.
		this.renderTarget.stencilBuffer = true;
		// The pass makes its depth texture in its constructor.
		const depthTexture = this.renderTarget.depthTexture!;
		depthTexture.format = DepthStencilFormat;
		depthTexture.type = UnsignedInt248Type;
		this.reach = uniform(reach);
		this.toned = uniform(1);
	}

	override setup() {
		const textureNode = this.getTextureNode("output");
		const depthNode = this.getTextureNode("depth");
		const normalNode = this.getTextureNode("normal");
		const at = uv();
		const sampleDepth = (where: Node<"vec2">) => depthNode.sample(where).r;
		const sampleNormal = (where: Node<"vec2">) => normalNode.sample(where).rgb.normalize();
		const threshold = float(THRESHOLD);
		const crease = float(CREASE);
		const strength = float(STRENGTH);
		return Fn(() => {
			const texel = textureNode.sample(at);
			// three.js types `textureSize` as a bare node, with no value type: it is a texture's size in whole pixels.
			const size = typed(textureSize(textureNode), "uvec2");
			const invSize = vec2(1).div(size).toConst();
			const depth = sampleDepth(at).toConst();
			const normal = sampleNormal(at).toConst();
			const near = property("float", "near");
			const creased = property("float", "creased");
			const r: Reads = { at, invSize, reach: this.reach, depth, normal, threshold, textureNode, depthNode, normalNode, sampleDepth, sampleNormal };
			const east = side(r, creased, 1, 0);
			const west = side(r, creased, -1, 0);
			const north = side(r, creased, 0, 1);
			const south = side(r, creased, 0, -1);
			// The pixel in front draws the line: its neighbours, on average, further away. Their difference to the
			// pixel's own depth, side against side, is 0 on any flat face however steep, so a slope seen from far never
			// draws a line that blinks as the town moves.
			near.assign(max(east.add(west).sub(depth.mul(2)), 0).add(max(north.add(south).sub(depth.mul(2)), 0)));
			// Faded in over a span, not switched: a line that just reaches the threshold is a pale one, not a jump.
			// An object narrower than twice the reach (a lamp post, an aerial) has the background on both its sides at every
			// pixel: all of it would be ink. The line is halved there, so that it keeps its colour.
			const thin = max(
				smoothstep(threshold, threshold.mul(2), min(east.sub(depth), west.sub(depth))),
				smoothstep(threshold, threshold.mul(2), min(north.sub(depth), south.sub(depth))),
			);
			const line = smoothstep(threshold, threshold.mul(2), near)
				.mul(strength)
				.mul(float(1).sub(thin.mul(0.5)));
			const fold = smoothstep(0.1, 0.25, creased).mul(crease);
			// An illustration's ink: the colour darkened, drawn towards one dark brown, so that a dark roof on a dark wall
			// still has its line by night.
			const ink = mix(texel.rgb.mul(vec3(0.45, 0.4, 0.42)), vec3(0.11, 0.08, 0.1), 0.4);
			const shaded = texel.rgb.mul(float(1).sub(fold));
			const lined = shaded.mul(float(1).sub(line)).add(ink.mul(line));
			const dark = darkRim(r, this.toned);
			const tint = clamp(texel.rgb.sub(PALE).div(1 - PALE), 0, 1);
			const coloured = mix(lined, tint.mul(RIM_DARK), dark);
			return vec4(coloured, texel.a);
		})();
	}
}
