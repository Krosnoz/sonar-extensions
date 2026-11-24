// By night the lamps' light on the canals and rivers: a soft, broken streak by each lamp of the quays, as a cozy game
// paints them. The streak is a glitter path (S. Lagarde, "Water drop 4a – Reflecting wet world"): the ripples'
// slopes stretch a light's image along the line of sight, longer as the view grazes the water, a short glint seen from
// above. It is broken into dashes of uneven width and length by warped sines, and thins out and fades towards its ends,
// as a noise breaks a stylized water's strands (Moritz Grauer, "Stylized Water for Unity URP, v2"). Regular bands of one
// period, cut off at one length, read as a striped rug beside the lamp.
// A lamp stands on its quay: the lantern's true mirror image, towards the camera, falls on the quay or beyond the water
// for half of them. The streak is stretched both ways along the line of sight from the lamp's foot, so that each lamp
// lights the water beside it, whichever way the camera looks.
// The lamps' map of ./lamplight.ts already holds where each lamp stands: the water reads it along the line of sight,
// nothing is drawn apart.
import {
	cameraPosition,
	clamp,
	dot,
	float,
	Fn,
	fwidth,
	If,
	max,
	mix,
	normalWorld,
	positionView,
	positionWorld,
	pow,
	sin,
	smoothstep,
	step,
	vec2,
	vec3,
} from "three/tsl";
import { SURFACE } from "./course";
import type { Lamplight } from "./lamplight";
import { THREE, typed, type Node, type Vec3 } from "./nodes";

// A lantern's height over the water (1.76 over the road, the water 0.6 under it).
const HEIGHT = 2.3;
// The streak's half length, as a share of the lantern's mirrored distance.
const LENGTH = 0.75;
// Where along the line of sight the streak samples the map, as shares of its half length, both ways from the pixel. A
// farther share is fainter and thinner, so the streak tapers to nothing at both ends.
const TAPS = [-1, -0.5, 0, 0.5, 1];
// The share past which nothing is left of the streak.
const END = 1.3;
// The ripples across the streak: their mean period on the water, and their slow drift (they must not blink).
const [PERIOD, DRIFT] = [0.36, 0.6];
// How bright the streak is, against the lamps' pools on the ground.
const STRENGTH = 3;
// The lantern's gold (./street-furniture.ts#lamp): the map's amber, warmed further, read salmon on the navy water.
const GOLD = new THREE.Color("#ffd27a");

// The streaks' light at a pixel of the water, by night (zero off the water). Off the water none of it is computed: its
// five reads of the map and its waves ran in every pixel of the town, for nothing (2.9 ms of a frame of 19.7 on a screen
// 1 920 wide at 1 000 agents, 14/11).
export function reflection(lit: Lamplight, water: Node, time: Node): Vec3 {
	const streaked = Fn(() => {
		// The water's flat top only, never a quay's wall.
		const surface = water
			.mul(smoothstep(0.85, 0.95, normalWorld.y))
			.mul(step(positionWorld.y, SURFACE + 0.1))
			.toVar();
		// Read in every pixel: in the branch, a pixel whose neighbour skips it has no slope to read.
		const pixel = fwidth(positionView.x).toVar();
		const out = vec3(0).toVar();
		If(surface.greaterThan(0), () => void out.assign(streak(lit, time, pixel).mul(surface)));
		return out;
	});
	return typed(streaked(), "vec3");
}

// A streak's light at a pixel of the water; `pixel`: what a pixel of the screen spans there.
function streak(lit: Lamplight, time: Node, pixel: Node): Vec3 {
	// The camera is orthographic and far: the way to it from any pixel is its way. Its slope gives how far from the
	// lamp's foot the lantern mirrors; seen from above the ripples stretch the image less still.
	const towards = cameraPosition.sub(positionWorld);
	const flat = towards.xz.normalize();
	const slope = towards.xz.length().div(towards.y.max(0.01));
	const reach = float(HEIGHT * LENGTH)
		.mul(slope)
		.mul(smoothstep(0.3, 1.4, slope).mul(0.6).add(0.4));
	const across = vec2(flat.y, flat.x.negate());
	const along = dot(positionWorld.xz, flat);
	const side = dot(positionWorld.xz, across);
	// The streak wavers sideways a little, along its length and in time.
	const waver = across.mul(sin(along.mul(9).add(time.mul(1.3))).mul(0.06));
	// The map near a lamp's foot, sharpened: its pool is 2.25 wide, the streak about half a metre at its head, sharper
	// (thinner) and fainter at each farther share.
	let glow: Node = float(0);
	for (const share of TAPS) {
		const kept = lit.at(positionWorld.xz.sub(flat.mul(reach.mul(share))).add(waver));
		const peak = clamp(dot(kept, vec3(0.2126, 0.7152, 0.0722)).mul(1.4), 0, 1);
		const far = Math.abs(share) / END;
		glow = max(glow, pow(peak, 2 + 3 * far).mul((1 - far) ** 1.5));
	}
	// Bands across the streak whose period wanders along and across it, so that their widths differ; a second wave
	// across breaks each band into dashes of uneven length. They fade to their mean where a band is under about three
	// pixels: thinner, they blinked as the town turned.
	const phase = along
		.mul((2 * Math.PI) / PERIOD)
		.add(sin(along.mul(1.7).add(side.mul(1.3)).add(0.7)).mul(2.2))
		.add(sin(side.mul(2.9).sub(along.mul(0.7))).mul(1.4))
		.add(time.mul(DRIFT));
	const bands = smoothstep(0.3, 0.95, sin(phase).mul(0.5).add(0.5));
	const breaks = smoothstep(
		0.15,
		0.6,
		sin(side.mul(4.1).add(sin(along.mul(2.7)).mul(2)))
			.mul(0.5)
			.add(0.5),
	);
	const broken = bands.mul(mix(float(0.15), float(1), breaks));
	const ripples = mix(float(0.3), broken, smoothstep(PERIOD / 2.5, PERIOD / 5, pixel));
	return vec3(GOLD.r, GOLD.g, GOLD.b).mul(glow.mul(ripples).mul(STRENGTH));
}
