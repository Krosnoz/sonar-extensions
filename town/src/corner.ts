// The island's front corner, the one the camera faces: the streets along its edges met it in two dead ends, each
// closed by a low wall, with nothing joining them (12/11). Now the corner block's street turns: a road runs along the
// island's right edge, as the avenue does (./avenue.ts#avenueStrip), from the front street to the street of the block
// behind, which it joins. The corner reads as one road turning round the island.
import type { Block } from "./grid";

// "turn": the corner block, which carries the road along its right edge; "join": the block behind it, whose street the
// road joins (its far kerb and pavement open there); null for any other block.
export type Corner = "turn" | "join" | null;

// `exists`: whether a block stands at (i, j). `avenue`: the avenue's column, which already runs along the right edge when it
// is the last one. `canal`: the canal's row; a corner whose block behind is the canal's keeps its dead end, the canal
// leaving the island there.
export function cornerOf({ i, j }: Block, exists: (i: number, j: number) => boolean, avenue: number, canal: number): Corner {
	const turns = (i0: number, j0: number): boolean =>
		exists(i0, j0) && !exists(i0 + 1, j0) && !exists(i0, j0 + 1) && i0 !== avenue && exists(i0, j0 - 1) && !exists(i0 + 1, j0 - 1) && j0 - 1 !== canal;
	if (turns(i, j)) return "turn";
	return turns(i, j + 1) ? "join" : null;
}
