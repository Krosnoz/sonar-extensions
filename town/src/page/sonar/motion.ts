// How the town's own parts move (its icon, an inhabitant's card): the curves and durations of Sonar's design system
// (styles/tokens.css), as the rest of the page moves. Under reduced motion, movement goes and the fades stay.

import { reducedMotion } from "./look";

// --ease, a strong ease-out, for what enters, leaves or answers a press; --ease-in-out, for what moves on screen.
export const EASE = [0.23, 1, 0.32, 1] as const;
export const EASE_IN_OUT = [0.77, 0, 0.175, 1] as const;
// The same curve for the Web Animations API and inline styles.
export const cssEase = (ease: readonly number[]): string => `cubic-bezier(${ease.join(", ")})`;
// The durations of tokens.css the town uses, in seconds. What leaves goes faster than what came.
export const DUR = { state: 0.2, stateOut: 0.15, move: 0.25, drawer: 0.3, stagger: 0.04 } as const;

// A row that arrives in a list already shown fades in where it stands; rows that arrive together come one after the
// other, 40 ms apart (past the sixth, with it). `backwards`: hidden while it waits its turn.
export function arrive(node: HTMLElement, order: number): void {
	node.animate([{ opacity: 0 }, { opacity: 1 }], {
		duration: DUR.state * 1000,
		easing: cssEase(EASE),
		delay: Math.min(order, 5) * DUR.stagger * 1000,
		fill: "backwards",
	});
}

// What a node holds changes: its height goes from the one it had to the new one, instead of jumping. Skipped under
// reduced motion. `from`: the height it had before, when it was measured earlier.
export function morph(node: HTMLElement, change: () => void, from = node.offsetHeight): void {
	change();
	const to = node.offsetHeight;
	if (reducedMotion() || from === to) return;
	node.style.overflow = "hidden";
	void node
		.animate({ height: [`${from}px`, `${to}px`] }, { duration: DUR.move * 1000, easing: cssEase(EASE_IN_OUT) })
		.finished.catch(() => undefined)
		.then(() => {
			node.style.overflow = "";
		});
}
