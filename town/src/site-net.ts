// The net over what is left to lay of a storey a subject's merges lay (./town-blocks.ts, `rising`; ./merge-floors.ts).
// That storey stands whole under the roof: what is laid of it shows as built, and the rest as its bare volume under a
// building site's net, which gets smaller merge after merge: from afar, one green band says a site, where small
// scattered cubes read as a broken display (docs/decisions/0013-storey-being-laid-under-a-net.md).
import { abs, dot, float, fract, fwidth, length, min, mix, normalWorld, positionWorld, smoothstep, step, vec3 } from "three/tsl";
import { N, THREE, type Node, type Vec3, type Vec4 } from "./nodes";
import { GH, SH, tone } from "./shapes";

// The net's cloth and its mesh: a building site's green, whatever the user's accent, in the palette the models are
// drawn in.
const CLOTH = new THREE.Color(tone("#6dbb93"));
const MESH = new THREE.Color(tone("#2f7d5b"));
// One line of the net's mesh every that many cubes, and how much of that a line takes on each side.
const [EVERY, LINE] = [2, 0.09];

// Whether a point of a storey laid merge by merge is laid, and whether it is under the net, each 1 or 0. Its
// instance's state says the share laid, from the storey's foot (./rising.ts): the net is over the rest. A storey laid
// whole has a state over 1, and no net. A state under 0 is the roof on its way up over a storey nothing is laid of
// yet: the net stands as high as the roof, and nothing shows over it.
// The storeys of the subjects' buildings stand on one grid, from the top of the ground floor: a point's height in its
// storey is read there, just under the face, so that a storey's top face is its own and not the foot of the next.
function netted(data: Vec4): { laid: Node; under: Node } {
	const up = fract(
		positionWorld.y
			.sub(normalWorld.y.mul(0.5 / N))
			.sub(0.1 + GH)
			.div(SH),
	);
	const over = step(data.y.max(0), up);
	const roof = step(0, data.y).sub(data.y.min(0));
	return { laid: over.oneMinus(), under: over.mul(step(up, roof)) };
}

// The net's colour: its cloth, and the lines of its mesh along a face's two own axes. From afar the mesh melts into
// the cloth: lines finer than a pixel blinked as the town turned.
function netColour(): Vec3 {
	const mesh = positionWorld.mul(N / EVERY);
	const lines = step(min(fract(mesh), fract(mesh).oneMinus()), float(LINE));
	const drawn = dot(lines, abs(normalWorld).oneMinus())
		.min(1)
		.mul(smoothstep(0.5, 0.15, length(fwidth(mesh))));
	return mix(vec3(CLOTH.r, CLOTH.g, CLOTH.b), vec3(MESH.r, MESH.g, MESH.b), drawn.mul(0.75).add(0.12));
}

// What its net changes of a part's pixel: its colour, what is kept of it, the light it gives.
export type Net = { colour: (own: Vec3) => Vec3; kept: (whole: Node<"bool">) => Node<"bool">; light: (own: Vec3) => Vec3 };
const NONE: Net = { colour: (own) => own, kept: (whole) => whole, light: (own) => own };

// The net of a part's instances, by their state `data`; none for a part that is not a storey laid merge by merge
// (`rises` of ./parts.ts). `volume`: 1 on the storey's volume itself, which alone stands under the net, without a
// light of its own: no window, no balcony to come.
export function netOf(rises: boolean | undefined, data: Vec4, volume: Node): Net {
	if (!rises) return NONE;
	const { laid, under } = netted(data);
	return {
		colour: (own) => mix(own, netColour(), under),
		kept: (whole) => whole.and(laid.add(under.mul(volume)).greaterThan(0.5)),
		light: (own) => own.mul(under.oneMinus()),
	};
}
