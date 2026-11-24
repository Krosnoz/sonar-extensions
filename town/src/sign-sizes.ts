// The sizes the subjects' signs and the figures' names take over the town (./signs.ts), and the room the page leaves them.
import { controlsAbove } from "./sign-controls";
import { GAP } from "./sign-geometry";
import { LOOKS, applyLook } from "./sign-looks";
import { measureNames } from "./sign-names";
import { topOf } from "./size";

export type Sizes = {
	level: number;
	// Each sign's size in each of its forms (LOOKS), with its room.
	sizes: Map<string, [number, number][]>;
	// Each figure's name, whole then cut (.world-cut), with its room.
	named: [number, number][][];
	width: number;
	height: number;
	top: number;
	blocked: number[][];
	// The page's controls over the town, with their room: no sign, line or anchor goes under them.
	floating: number[][];
	// How far from the screen's edges a sign and its anchor stand: the design system's margin (--gutter).
	margin: number;
};

// Each sign's size as the level shows it, read once per level: the names are the user's, of any length. A fixed size
// let long names cover their neighbours. `marks`: the signs, each back in its own form (`state.look`) once measured.
export const signSizes = (
	layer: HTMLElement,
	marks: { node: HTMLElement; state: { look: string } }[],
	names: { node: HTMLElement }[],
): ((level: number) => Sizes) & { resigned: () => void; renamed: (at: number) => void } => {
	let measured: Sizes | null = null;
	// The figures' names, read only once the nearest level, the one that shows them, is reached, and kept from level to
	// level: a name's size does not change with the level. Read at each level, the 10 000 names of a big town laid the
	// page out twice at every change of level, and froze the zoom for half a second each time.
	let named: [number, number][][] | null = null;
	// Read again when the screen turns or the town shows after being out of sight, and once the page's fonts load. Not on a
	// label's own resize: a sign shortened for room resizes it at every frame.
	const forget = (): void => void ([measured, named] = [null, null]);
	new ResizeObserver(forget).observe(layer);
	document.fonts.addEventListener("loadingdone", forget);
	const sized = (level: number): Sizes => {
		// The layer's size is not read here, at every frame: the observer above forgets the sizes when it changes.
		if (measured?.level !== level || !measured.width) {
			// Under the page's top bar nothing shows: the town's top padding, as the camera reads it (./size.ts).
			const top = layer.parentElement ? topOf(layer.parentElement) : 0;
			const bar = top > 0 ? [[-Infinity, -Infinity, Infinity, top]] : [];
			const sizes = new Map(
				LOOKS.map((look) => {
					for (const { node } of marks) applyLook(node, look);
					return [look, marks.map(({ node }): [number, number] => [node.offsetWidth + GAP, node.offsetHeight + GAP])] as const;
				}),
			);
			if (level >= 2) named ??= measureNames(names.map(({ node }) => node));
			for (const { node, state } of marks) applyLook(node, state.look);
			const floating = controlsAbove(layer);
			measured = {
				level,
				sizes,
				named: named ?? [],
				width: layer.clientWidth,
				height: layer.clientHeight,
				top,
				blocked: [...floating, ...bar],
				floating,
				margin: parseFloat(getComputedStyle(layer).getPropertyValue("--gutter")) || 0,
			};
		}
		return measured;
	};
	// While the town is open (./live.ts): a sign says other counts, the signs are read again; the name `at` says another
	// agent, it is read again alone, once the names have been read.
	return Object.assign(sized, {
		resigned: (): void => void (measured = null),
		renamed: (at: number): void => {
			if (named) named[at] = measureNames([names[at]!.node])[0]!;
		},
	});
};
