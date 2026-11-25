// How each subject's building differs from the others: its style, its wall's tint, its roof, its ground floor and, in a
// city, its height. Two subjects of one style drew their traits by their rank alone (`index % 2`, `index % 4`): the third
// and the seventh subject were the same brick tower under the same tiles, over the same shops, seven storeys high, only
// the brick's tint apart. Each subject now takes, among the traits its style allows, those that differ most from every
// subject of its style before it: two buildings differ by two traits at least while the town has such a choice.
import { MODERNS } from "./storeys";

const TINTS = [
	["#efe2c8", "#e8d3b0", "#f2e9dd", "#e3c9a8"],
	["#b5553f", "#c97b4a", "#a8483a", "#cf9a62"],
	["#dfe5ea", "#cfd8dc", "#e9e4da", "#c4d3d6"],
];
export const styleOf = (index: number): number => (index * 2 + Math.floor(index / 3)) % 3;

// What a subject draws by its own name (./looks.ts#looksOf): its modern facade, its flat roof, its mansard's tone.
type Look = { flat: number; tone: number; modern: number };
// `roof`: 0 the mansard, 1 the flat roof, 2 the tiles (./roofs.ts). `ground`: the ground floor's style. `extra`: storeys
// over the fewest a city gives a subject's building.
export type Design = { tint: string; roof: number; ground: number; extra: number };

// Whether `score` comes before `other`, the first value that differs deciding.
const above = (score: number[], other: number[]): boolean => {
	const at = score.findIndex((value, n) => value !== other[n]);
	return at >= 0 && score[at]! > other[at]!;
};

// `floors`: the storeys each subject's building has; `tall`: whether the town adds storeys of its own (in a city every
// subject has as many storeys, and the height tells nothing). `near`: whether two subjects are seen together; those
// count first, as a style's traits cannot keep all of its subjects of a large town two traits apart.
export function designsOf(looks: Look[], floors: number[], tall: boolean, near: (a: number, b: number) => boolean = () => true): Design[] {
	const made: { index: number; style: number; traits: (string | number)[] }[] = [];
	return looks.map((look, index) => {
		const style = styleOf(index);
		const facade = style === 2 ? MODERNS[look.modern]! : style;
		const roofs = style === 0 ? [0] : style === 1 ? [1, 2] : [1];
		const grounds = style === 2 ? [2] : [0, 1];
		const extras = tall ? [0, 1, 2] : [0];
		const before = made.filter((each) => each.style === style);
		const designs = TINTS[style]!.flatMap((tint) =>
			roofs.flatMap((roof) => grounds.flatMap((ground) => extras.map((extra): Design => ({ tint, roof, ground, extra })))),
		);
		let best: { design: Design; traits: (string | number)[]; score: number[] } | undefined;
		for (const design of designs) {
			const roofId = design.roof === 0 ? `mansard ${look.tone}` : design.roof === 1 ? `flat ${look.flat}` : "tiles";
			// Outside a city the storeys are not a trait: a subject's merges raise its building (../sites/merge-floors.ts), and one
			// more storey gave it another tint, roof or ground floor at the town's next opening.
			const traits = [facade, roofId, tall ? floors[index]! + design.extra : 0, design.tint, design.ground];
			const apart = (list: typeof before): number => Math.min(5, ...list.map((each) => each.traits.filter((value, at) => value !== traits[at]).length));
			// The fewest traits it differs by from a neighbour of its style before it, then from any, then how often its tint
			// was taken, then the fewest storeys added, then the first tint.
			const score = [
				apart(before.filter((each) => near(each.index, index))),
				apart(before),
				-before.filter((each) => each.traits[3] === design.tint).length,
				-design.extra,
				-TINTS[style]!.indexOf(design.tint),
			];
			if (!best || above(score, best.score)) best = { design, traits, score };
		}
		made.push({ index, style, traits: best!.traits });
		return best!.design;
	});
}
