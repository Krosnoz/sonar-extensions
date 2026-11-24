// The town's blocks, the squares of a grid (laid out by ./layout.ts#cityGrid), and the view's angles.

// The height the background's points fall to under the town (./dots.ts).
export const WATER = -1.7;
// The true isometric view: the camera looks down by this angle, at 45° from the grid.
export const PITCH = Math.atan(Math.SQRT1_2);
export const R = Math.SQRT1_2;
// `topic` is -1 for a block without a subject. `quarter`: the subject whose crowd spills onto this block's square
// (./quarters.ts), on a block without a subject.
export type Block = { i: number; j: number; x: number; z: number; topic: number; quarter?: number };
// `of`: the block of a subject.
export type Grid = { all: Block[]; of: (topic: number) => Block };
