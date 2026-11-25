// The pointer's gestures an inhabitant's notebook hears (./notebook.ts): where the mouse rests, a click that pins a
// notebook or closes it, Escape. The town's own gestures stay the town's (../camera/gestures.ts): a drag pins nothing.
import type { Figure } from "../render/kit";
import { under, type Project } from "./note-under";

export type Pointed = {
	// Where the pointer rests over the town, in the host's pixels; null: on nothing a card comes for.
	pointer: [number, number] | null;
	// Where a button went down; null once the pointer went past a tap's reach: a drag is no click.
	down: [number, number] | null;
	// Whose notebook is pinned, as its rank in the town's figures (-1: none), and its session: another one may take its
	// place in the town.
	pinned: number;
	whose: string | null;
};
type Place = { host: HTMLElement; card: HTMLElement; layer: HTMLElement; figures: Figure[]; inView: (lot: number) => boolean };

// How far a pressed pointer may travel and still click, in CSS pixels (as ../camera/gestures.ts).
const TAP = 6;

// On the card, a subject's sign or the compass: a control of the town, which hides the inhabitants under it.
function onControl(event: Event): boolean {
	return event.target instanceof Element && !!event.target.closest("button, .world-card");
}

// The gestures are heard until `signal`. `last`: where a point of the town showed at the last frame.
export function listens({ host, card, layer, figures, inView }: Place, held: Pointed, last: () => Project | null, signal: AbortSignal): void {
	const heard = { signal };
	const at = (event: MouseEvent): [number, number] => {
		const box = host.getBoundingClientRect();
		return [event.clientX - box.left, event.clientY - box.top];
	};
	// The pointer is on nobody a card comes for: no hand, and the next frame may have nothing to work out.
	const off = (): void => {
		held.pointer = null;
		host.classList.remove("world-pointing");
	};
	// A control of its own: the town's gestures took the pointer on it, and its buttons had no click (../camera/gestures.ts). A
	// press that starts on it and ends on the town is no click on the town.
	card.addEventListener(
		"pointerdown",
		(event) => {
			event.stopPropagation();
			held.down = null;
		},
		heard,
	);
	host.addEventListener(
		"pointermove",
		(event) => {
			const [x, y] = at(event);
			// A press that went past a tap's reach is a drag, wherever it ends: it turns or slides the town.
			if (held.down && event.buttons !== 0 && Math.hypot(x - held.down[0], y - held.down[1]) >= TAP) held.down = null;
			// No card comes under a drag.
			if (event.pointerType === "mouse" && event.buttons === 0 && !onControl(event)) held.pointer = [x, y];
			else off();
		},
		heard,
	);
	host.addEventListener("pointerleave", off, heard);
	host.addEventListener("pointerdown", (event) => void (held.down = at(event)), heard);
	host.addEventListener(
		"click",
		(event) => {
			const project = last();
			if (onControl(event) || !held.down || !project || !layer.classList.contains("shown")) return;
			held.down = null;
			// On an inhabitant, its notebook; anywhere else, none.
			held.pinned = under(figures, project, at(event), inView);
			held.whose = figures[held.pinned]?.agent.handle ?? null;
		},
		heard,
	);
	window.addEventListener(
		"keydown",
		(event) => {
			// Escape that closed a menu or the command bar over the town, or that ended a text being composed, is theirs.
			if (event.key === "Escape" && !event.defaultPrevented && !event.isComposing) held.pinned = -1;
		},
		heard,
	);
}
