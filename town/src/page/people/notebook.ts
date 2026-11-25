// An inhabitant's card: while the pointer rests on an inhabitant, what its session is doing; a click pins it as its
// notebook, with what happened to it lately and the way to its session. The one thing of the town that acts on a
// session, and only to open it. What it says: ./note-card.ts; who stands under the pointer: ./note-under.ts; the
// gestures it hears: ./note-pointer.ts.
// The card never jumps: it comes out of its inhabitant, glides from one to the next while what it says fades over, and
// unfolds line by line when pinned (../sonar/motion.ts). With reduced motion it is in place at once.
import { el } from "../sonar/dom";
import type { Figure } from "../render/kit";
import { reducedMotion } from "../sonar/look";
import { arrive, cssEase, DUR, EASE, EASE_IN_OUT, morph } from "../sonar/motion";
import { keyOf, moreOf, nowOf, pastKeyOf, pastOf, renew, type Said, shutOf } from "./note-card";
import { listens, type Pointed } from "./note-pointer";
import { boxOf, onScreen, under, upOf, type Project } from "./note-under";
import { sonar } from "../sonar/sonar";

type Size = { width: number; height: number };
type Held = Pointed & {
	// The figure under the pointer and since when (ms). Figures are ranks in the town's; -1: none.
	over: number;
	since: number;
	// Whose card shows.
	shown: number;
	// When the last card went, and when the pointer last was on the inhabitant of the one that shows (ms).
	left: number;
	kept: number;
	// What the card says: of which session (null: nothing yet), pinned or not, and its key (./note-card.ts#keyOf).
	handle: string | null;
	wasPinned: boolean;
	drawn: string;
	// The key of its notebook's past (./note-card.ts#pastKeyOf), and the name the card hides over its inhabitant's head.
	past: string;
	carded: HTMLElement | null;
	// Where the card stands, and its height once its body is whole: it says where it stands while it unfolds.
	at: [number, number];
	high: number;
};

// As Sonar's tooltips: the wait before a card, none when another one showed just before.
const [DELAY, WARM] = [350, 300];
// How long a card stays after the pointer left its inhabitant, in ms: between two bodies of a crowd it blinked, and
// the next one's card glides from it instead of coming anew.
const LINGER = 150;
// The card's room: over the head with at least ROOM px above it, else under the feet; MARGIN px from the screen's
// sides, and its tail no nearer than TAIL px to its corners.
const [ROOM, MARGIN, TAIL] = [56, 12, 18];

// The card's body changes what it holds: its height goes from the one it shows to the new one (../sonar/motion.ts#morph),
// so the card grows or shrinks instead of jumping.
function changed(card: HTMLElement, body: HTMLElement, held: Held, change: () => void): void {
	const from = body.offsetHeight;
	for (const animation of body.getAnimations()) animation.cancel();
	change();
	held.high = card.offsetHeight;
	morph(body, () => undefined, from);
}

// The card over its figure's head, or under its feet when it fits better there; kept whole on the screen. Its tail
// stays on the figure while its height changes.
function placed(card: HTMLElement, figure: Figure, project: Project, size: Size, held: Held): [number, number] {
	const { x, top, feet } = boxOf(figure, project, upOf(project));
	const [wide, high] = [card.offsetWidth, card.offsetHeight];
	// The room left once the card is whole, over the head and under the feet.
	const [above, below] = [top - 10 - held.high - ROOM, size.height - MARGIN - (feet + 12 + held.high)];
	const over = above >= 0 || above >= below;
	const left = Math.round(Math.min(size.width - wide - MARGIN, Math.max(MARGIN, x - wide / 2)));
	const at: [number, number] = [left, Math.round(Math.min(size.height - MARGIN - high, Math.max(ROOM, over ? top - 10 - high : feet + 12)))];
	card.style.translate = `${at[0]}px ${at[1]}px`;
	card.classList.toggle("under", !over);
	card.style.setProperty("--tail", `${Math.round(Math.min(wide - TAIL, Math.max(TAIL, x - left)))}px`);
	return at;
}

// Its card says its name: the name over its head would lie under the card. One name is written, not each of the
// town's: a class is written only when it changes (../signs/name-places.ts).
function named(layer: HTMLElement, held: Held, handle: string | null): void {
	held.carded?.classList.remove("world-carded");
	held.carded = handle === null ? null : layer.querySelector<HTMLElement>(`.world-name[data-handle="${CSS.escape(handle)}"]`);
	held.carded?.classList.add("world-carded");
}

// What the card said of the one it leaves fades over what it says of the next: the card is never empty.
function fadedOver(body: HTMLElement, ghost: Node | undefined): void {
	if (!(ghost instanceof HTMLElement) || reducedMotion()) return;
	ghost.classList.add("world-card-ghost");
	body.append(ghost);
	void ghost
		.animate([{ opacity: 1 }, { opacity: 0 }], { duration: DUR.stateOut * 1000, easing: cssEase(EASE), fill: "forwards" })
		.finished.catch(() => undefined)
		.then(() => ghost.remove());
}

// What the card holds follows who it shows, and whether its notebook is pinned. Returns whether it went from an
// inhabitant to another: it then glides there (#frame).
function written(card: HTMLElement, body: HTMLElement, said: Said, held: Held): boolean {
	const pinned = held.pinned >= 0;
	const close = (): void => void (held.pinned = -1);
	const more = (): HTMLElement => moreOf(said, () => sonar().openSession(said.handle));
	const whole = (): void => body.replaceChildren(nowOf(said, pinned ? shutOf(close) : null), ...(pinned ? [more()] : []));
	const [key, past] = [keyOf(said), pastKeyOf(said)];
	const moved = held.handle !== null && held.handle !== said.handle;
	if (held.handle === null) {
		// It comes: whole at once. Its entrance is the card's own (world.css).
		for (const animation of body.getAnimations({ subtree: true })) animation.cancel();
		whole();
		held.high = card.offsetHeight;
	} else if (moved) {
		const ghost = body.firstElementChild?.cloneNode(true);
		changed(card, body, held, whole);
		if (body.firstElementChild instanceof HTMLElement) arrive(body.firstElementChild, 0);
		fadedOver(body, ghost);
	} else if (pinned && !held.wasPinned) {
		// Pinned: its cross and its past come under what it said, which stays where it is.
		changed(card, body, held, () => {
			const shut = shutOf(close);
			body.querySelector(".world-card-head")?.append(shut);
			arrive(shut, 0);
			body.append(more());
		});
	} else if (pinned !== held.wasPinned) changed(card, body, held, whole);
	else if (key !== held.drawn || (pinned && past !== held.past))
		// Its session changed, as often as an agent takes another tool: the card says so, and its cross and its button
		// stay the nodes they are, under a press or the keyboard.
		changed(card, body, held, () => {
			const now = body.querySelector(".world-card-now");
			if (now) renew(now, said);
			if (pinned && past !== held.past) body.querySelector(".world-card-past")?.replaceWith(pastOf(said));
		});
	[held.handle, held.wasPinned, held.drawn, held.past] = [said.handle, pinned, key, past];
	return moved;
}

// Whose card shows now: the pinned one's; else the one under the pointer once it has rested there, or at once while
// a card is warm (one shows, or one just went); a card stays a moment after the pointer left its inhabitant.
function chosen(held: Held, over: number, now: number): number {
	if (over !== held.over) [held.over, held.since] = [over, now];
	if (held.pinned >= 0) return held.pinned;
	const warm = now - held.left < WARM || held.shown >= 0;
	if (over >= 0 && (warm || now - held.since >= DELAY)) {
		held.kept = now;
		return over;
	}
	return held.shown >= 0 && now - held.kept < LINGER ? held.shown : -1;
}

// The card goes as it is: what it holds stays while it fades.
function gone(card: HTMLElement, layer: HTMLElement, held: Held, now: number): void {
	if (held.shown >= 0) held.left = now;
	if (held.handle !== null) named(layer, held, null);
	[held.pinned, held.whose, held.shown, held.handle] = [-1, null, -1, null];
	card.classList.remove("shown", "world-pinned");
	// Its cross and its button stay in it, unseen: neither the keyboard nor a screen reader finds them, and the keyboard
	// that was on one of them leaves it at once.
	card.inert = true;
	const focused = document.activeElement;
	if (focused instanceof HTMLElement && card.contains(focused)) focused.blur();
}

type Scene = { host: HTMLElement; card: HTMLElement; body: HTMLElement; layer: HTMLElement; figures: Figure[]; size: Size; inView: (lot: number) => boolean };

// Whose card shows this frame, with its figure and its session as the page holds it; undefined: nobody's.
function seen(
	{ host, layer, figures, size, inView }: Scene,
	held: Held,
	project: Project,
	now: number,
): { shown: number; figure: Figure; said: Said } | undefined {
	const pinned = figures[held.pinned];
	// One that took the place of the pinned one in the town is not the one whose notebook was pinned; one that left the
	// screen, or that the camera now sees from afar, has nobody for its notebook to point at.
	if (pinned && (pinned.agent.handle !== held.whose || !onScreen(pinned, project, size, inView))) held.pinned = -1;
	const over = held.pointer && layer.classList.contains("shown") ? under(figures, project, held.pointer, inView) : -1;
	// A hand over an inhabitant, read again at each frame: the town moves under a pointer that rests.
	host.classList.toggle("world-pointing", over >= 0);
	const shown = chosen(held, over, now);
	const figure = figures[shown];
	const handle = figure && !figure.away ? figure.agent.handle : undefined;
	// A session of this PC only: one of a linked computer has no notebook. A Sonar that does not say it: of this PC.
	const session = handle === undefined ? null : sonar().session(handle);
	return figure && handle !== undefined && session && !session.remote ? { shown, figure, said: { handle, name: figure.agent.name, session } } : undefined;
}

// A frame of the notebook: who is under the pointer, whose card shows, and where. Nothing is worked out while the
// pointer is on no part of the town and no card shows.
function frame(scene: Scene, held: Held, project: Project): void {
	if (!held.pointer && held.shown < 0 && held.pinned < 0) {
		// Nobody is under a pointer that left: back on the same inhabitant, it rests there anew before its card comes.
		held.over = -1;
		return;
	}
	const { card, body, layer, size } = scene;
	const now = performance.now();
	const found = seen(scene, held, project, now);
	if (!found) return gone(card, layer, held, now);
	const { shown, figure, said } = found;
	const was = held.at;
	const moved = written(card, body, said, held);
	if (shown !== held.shown) named(layer, held, said.handle);
	held.shown = shown;
	held.at = placed(card, figure, project, size, held);
	if (moved && !reducedMotion()) glided(card, was, held.at);
	card.classList.add("shown");
	card.classList.toggle("world-pinned", held.pinned >= 0);
	card.inert = held.pinned < 0;
}

// From an inhabitant to another, the card glides, it does not jump: from where it shows, which is on its way when the
// pointer swept over a third one.
function glided(card: HTMLElement, was: [number, number], at: [number, number]): void {
	const flying = new DOMMatrixReadOnly(getComputedStyle(card).transform);
	for (const animation of card.getAnimations()) if (animation.id === "glide") animation.cancel();
	card.animate([{ transform: `translate(${was[0] + flying.e - at[0]}px, ${was[1] + flying.f - at[1]}px)` }, { transform: "none" }], {
		id: "glide",
		duration: DUR.move * 1000,
		easing: cssEase(EASE_IN_OUT),
	});
}

// The notebook over the town in `layer`: its frame, called after each of the town's with where a point of the town
// shows in `host`, and `dispose`, which takes its listeners back. `inView`: whether a crowd is on the screen (../render/lots.ts).
export function notebook(
	host: HTMLElement,
	layer: HTMLElement,
	figures: Figure[],
	size: Size,
	inView: (lot: number) => boolean,
): { frame: (seconds: number, project: Project) => void; dispose: () => void } {
	const card = el("div", "world-card");
	const body = el("div", "world-card-body");
	card.append(body);
	card.inert = true;
	layer.append(card);
	const held: Held = {
		pointer: null,
		down: null,
		over: -1,
		since: 0,
		shown: -1,
		pinned: -1,
		whose: null,
		left: -Infinity,
		kept: -Infinity,
		handle: null,
		wasPinned: false,
		drawn: "",
		past: "",
		carded: null,
		at: [0, 0],
		high: 0,
	};
	const scene: Scene = { host, card, body, layer, figures, size, inView };
	let last: Project | null = null;
	const off = new AbortController();
	listens(scene, held, () => last, off.signal);
	return {
		frame: (_seconds, project) => {
			last = project;
			frame(scene, held, project);
		},
		dispose: () => {
			off.abort();
			card.remove();
			named(layer, held, null);
			host.classList.remove("world-pointing");
		},
	};
}
