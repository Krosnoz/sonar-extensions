// What an inhabitant at work holds says what its agent does now: a book while it reads or searches, a hammer while it
// writes, a console while it runs a command; with any other tool, its crate. Nothing is made up: the tool is the last
// one its session used, and what a tool does is what its agent's catalog says of it (../sonar/sources.ts#actOf).
import { max, sin, vec3 } from "three/tsl";
import { merge, type Node, type Vec3, type Vec4 } from "../render/nodes";
import { CARRIED, b, type G } from "../render/shapes";

// How long what was held takes to give its place to the next, in seconds of the town.
export const SWAP = 0.35;

// The state a figure's shader reads (./bodies.ts): one at work says what it holds too (../sonar/sources.ts#actOf), in
// tenths. It stays between the bounds of ../render/nodes.ts#working.
export const codeOf = (state: number, act: number): number => (state === 1 ? 1 + act * 0.1 : state);

// How high the arm that holds the hammer is, and the hammer with it.
export const swing = (time: Node, data: Vec4): Node => max(sin(time.mul(9).add(data.z.mul(40))), 0).mul(0.14);
const swung =
	(time: Node) =>
	(data: Vec4): Vec3 =>
		vec3(0, swing(time, data), 0);

// The things are drawn in the figure's own frame (it faces +z): they take its place, its turn and its size. Each has a
// piece lit with the state's colour, as the crate of ./figures.ts.
// An open book before the chest.
const book = (): G =>
	merge([
		b("#3a2a20", 0.3, 0.025, 0.19, 0, 0.3, 0.17),
		b("#ffffff", 0.13, 0.025, 0.16, -0.07, 0.32, 0.17, CARRIED),
		b("#ffffff", 0.13, 0.025, 0.16, 0.07, 0.32, 0.17, CARRIED),
	]);
// A hammer in the right hand.
const hammer = (): G => merge([b("#8a5a3c", 0.035, 0.24, 0.035, 0.135, 0.24, 0.08), b("#ffffff", 0.16, 0.08, 0.08, 0.135, 0.46, 0.08, CARRIED)]);
// A console in both hands, its screen lit.
const terminal = (): G => merge([b("#2c303b", 0.3, 0.05, 0.2, 0, 0.27, 0.19), b("#ffffff", 0.26, 0.17, 0.02, 0, 0.32, 0.28, CARRIED)]);

// The book, the hammer and the console, each with how its part moves: the hammer follows its arm.
export const tools = (time: Node): { model: G; moves?: (data: Vec4) => Vec3 }[] => [
	{ model: book() },
	{ model: hammer(), moves: swung(time) },
	{ model: terminal() },
];
