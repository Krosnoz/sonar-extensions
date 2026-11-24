// The bubble of who waits for the user, as a model: a ball, a tail that points down to its left, and on the ball its
// mark, "!". The camera looks down on the town (./grid.ts#PITCH): the mark and the tail are laid on the ball as that
// camera sees it, the mark in the middle of the ball's disc and flat to the screen. Laid on the ball's side, as a
// wall's detail, the mark stood under the middle of the disc, half of it sunk in the ball. A bubble is turned to the
// camera's heading when it is drawn (./heaps.ts#facing): the model's +z is towards the camera.
import { PITCH } from "./grid";
import { BALL } from "./heaps";
import { THREE, merge } from "./nodes";
import { ball, box, piece, type G } from "./shapes";

// A bubble is smaller than a head (0.6 of its first size): by night, at full size over a crowd, it hid the head of the
// inhabitant standing behind.
const BANG = 0.6;
// The ball's radius before that: the model is drawn at its first size, then brought to BANG.
const R = BALL / BANG;

// The mark's stroke and its dot, their middles on the ball's disc: the stroke's width, each one's height and where it
// stands. Together they are as tall as half the disc, and stand in its middle.
const [STROKE, DOT] = [
	[0.135, 0.045],
	[0.055, -0.085],
] as const;
const WIDE = 0.055;
// How deep the mark is, and how far its face stands out of the ball's nearest point: its back is in the ball at its
// ends too, where the ball's surface is 0.04 further.
const [DEEP, PROUD] = [0.07, 0.012];

// The mark, its face flat to the camera.
const mark = (): G[] =>
	[STROKE, DOT].map(([high, up]) =>
		piece(
			box(WIDE, high, DEEP)
				.translate(0, up, R + PROUD - DEEP / 2)
				.rotateX(-PITCH),
			"#ffffff",
			0,
		),
	);

// The tail: a cone from inside the ball to a point past its edge, down and to the left on the screen, of `sides` sides.
function tail(sides: number): G {
	const [left, down] = [0.5, 0.866];
	// The screen's "down" in the model's frame is (0, -cos, sin) of the camera's pitch.
	const toward = new THREE.Vector3(-left, -down * Math.cos(PITCH), down * Math.sin(PITCH));
	const [wide, long, from] = [0.09, 0.17, 0.14];
	const cone = new THREE.ConeGeometry(wide, long, sides).applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), toward));
	const at = toward.multiplyScalar(from + long / 2);
	return piece(cone.translate(at.x, at.y, at.z), "#ffffff", 1);
}

const sized = (parts: G[]): G => merge(parts.map((part) => part.scale(BANG, BANG, BANG)));

// The bubble over the head of one that waits.
export const bang = (): G => sized([piece(ball(R), "#ffffff", 1), tail(8), ...mark()]);

// The large bubble of a group that waits (./heaps.ts): the same ball and tail with no mark, its count written on it
// (./mark-heaps.ts). Drawn over three times larger, it is rounder: one a place, against one an agent.
export const round = (): G => sized([piece(new THREE.SphereGeometry(R, 32, 20), "#ffffff", 1), tail(16)]);
