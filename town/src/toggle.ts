// The "Visualisation" icon of the Map: it turns the page itself into the town, and back. three.js and the town load at
// the pointer on the icon only (Bun splits the page at each `import()`): a page that never reaches it never downloads them.
// The town stays until the icon is touched again: another tab hides it and stops drawing it, the Map shows it again as
// it was. Another project, or the projects' home, ends it.

import type { MapSession } from "@sonar/extension";
import { el, iconButton } from "./dom";
import { dark, reducedMotion } from "./look";
import type { Morph } from "./morph";
import { cssEase, DUR, EASE_IN_OUT } from "./motion";
import { offered, remembered, Unheld } from "./offered";
import { sonar } from "./sonar";
import { offerSounds } from "./sound-lines";
import { readMap, wantedOf } from "./sources";
import { worldTexts as texts } from "./texts";
import { townStyle } from "./town-style";

// The longest an opening may take, from the click to the town built, in milliseconds. It takes 11 to 16 s on a recent
// computer, from 10 to 10 000 agents (14/11): a machine 3 times slower opens it in 48 s at most, and still does. Past
// it, the machine does not hold the town: a processor 20 times slower left the map pale for more than 4 minutes, without
// the town nor a word. `sonar:town-limit` sets it for a test.
const OPENING_LIMIT = 60_000;
const openingLimit = (): number => Number(localStorage.getItem("sonar:town-limit")) || OPENING_LIMIT;

let town: Morph | null = null;
// The project the town was built for.
let built: string | null = null;
// A touch while the page breaks up or comes back waits for the end: the two runs would share the same cards.
let busy = false;
const buttons: HTMLButtonElement[] = [];
const host = Object.assign(document.createElement("div"), { id: "town" });
// Sonar's toast, signed with the town's name as an extension's.
const toast = (text: string, tone?: "info" | "error"): void => sonar().ui.toast(text, tone);

// The Map shows (its tab chosen, a project open).
const onMap = (): boolean => sonar().map.shown().on;

function mark(shown: boolean): void {
	const label = shown ? texts.close : texts.open;
	for (const button of buttons) {
		button.setAttribute("aria-pressed", String(shown));
		button.setAttribute("aria-label", label);
		sonar().ui.tip(button, label);
	}
}

// Each icon's spinner while it turns.
const spinners = new Map<HTMLButtonElement, HTMLElement>();

// While the town is prepared (a few seconds, the page still), the icon turns.
function preparing(on: boolean): void {
	for (const button of buttons) {
		button.toggleAttribute("aria-busy", on);
		spinners.get(button)?.remove();
		spinners.delete(button);
		if (!on) continue;
		// Sonar's spinner, before the glyph, which hides behind it (styles/base.css).
		const spinner = el("i", "ui-spinner");
		spinners.set(button, spinner);
		button.prepend(spinner);
	}
}

// The map's icon goes down to the bottom right corner while the town shows, and back up among the map's tools: its place
// is written at once, then it slides there on transform, measured before and after (as ../fleet/canvas/glide.ts).
function corner(on: boolean, slide = true): void {
	const icon = buttons[0];
	if (!icon || icon.classList.contains("cornered") === on) return;
	const before = icon.getBoundingClientRect();
	icon.classList.toggle("cornered", on);
	const after = icon.getBoundingClientRect();
	const [dx, dy] = [before.left - after.left, before.top - after.top];
	if (!slide || reducedMotion() || Math.hypot(dx, dy) < 1) return;
	icon.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: "none" }], { duration: DUR.drawer * 1000, easing: cssEase(EASE_IN_OUT) });
}

// What the map would draw now, kept while the town comes, goes or is out of sight.
let late: readonly MapSession[] | null = null;

// The page is whole again: the Map, uncovered, draws what changed under the town.
function whole(): void {
	host.classList.remove("moving");
	late = null;
	sonar().map.cover(false);
}

// The town follows the fleet (./live.ts) once it has arrived, while it shows. What changed meanwhile waits, and is
// there at once when the town is looked at again. What is told is drawn from the next frame: the town asks for it
// again, as it did when the page's body changed with the fleet (a frame asked before may never come, as under a test's
// held clock).
function told(sessions: readonly MapSession[]): void {
	if (!town || host.classList.contains("moving") || !onMap() || document.hidden) return void (late = sessions);
	town.follow(wantedOf(sessions), late !== null);
	town.hide(false);
	late = null;
}

async function open(): Promise<void> {
	const { map } = sonar();
	const { project } = map.shown();
	const sources = readMap(map.cards());
	// No agent, no place to build: the town shows only what the page shows.
	if (sources.length === 0) {
		toast(texts.empty);
		return;
	}
	// The cards just read stay the Map's until the page is whole again (PageMap's `cover`). And while the town comes or
	// goes, it takes no gesture (./gestures.ts): a drag turned it under the cubes still flying.
	map.cover(true, told);
	host.classList.add("moving");
	mark(true);
	preparing(true);
	corner(true);
	document.body.classList.add("town");
	// Past its time limit, the opening stops where it is: while the town is prepared, at the next step of its build;
	// while it arrives, the page whole at once.
	const stop = new AbortController();
	const timer = setTimeout(() => stop.abort(new Unheld(`town: opening past ${openingLimit()} ms`)), openingLimit());
	try {
		// The town is built in the style its project's settings keep (./styles.ts#styleFor), read while its code loads.
		const [{ morphIn }, style] = await Promise.all([import("./morph"), project ? townStyle(project) : undefined]);
		// Empty while the server cannot be read: the style then comes from the project's name.
		host.dataset["style"] = style ?? "";
		stop.signal.throwIfAborted();
		const opened = await morphIn(sources, host, dark() ? "dark" : "light", stop.signal);
		[town, built] = [opened, project];
		void opened.arrived.then(() => {
			clearTimeout(timer);
			// Not a town sent back while it came: it goes on moving.
			if (town !== opened) return;
			host.classList.remove("moving");
			if (late) told(late);
		});
		stop.signal.addEventListener("abort", () => town === opened && untimely(), { once: true });
	} catch (error) {
		clearTimeout(timer);
		mark(false);
		corner(false);
		document.body.classList.remove("town");
		whole();
		throw error;
	} finally {
		preparing(false);
	}
	// Another tab was chosen while the town was prepared.
	follow();
}

async function close(): Promise<void> {
	const leaving = town;
	if (!leaving) return;
	town = null;
	mark(false);
	corner(false);
	// While the town leaves, a touch waits for its end (`busy`): the icon says so, as while the town is prepared. Without
	// a sign, a click there was dropped and seemed lost (14/11).
	preparing(true);
	host.classList.add("moving");
	try {
		await leaving.back();
	} finally {
		preparing(false);
		whole();
	}
	document.body.classList.remove("town");
}

async function toggle(): Promise<void> {
	if (busy) return;
	busy = true;
	try {
		await (town ? close() : open());
	} catch (error) {
		host.replaceChildren();
		// This machine does not hold the town (./offered.ts): said once, and its icon goes for a day. Told by its name: the
		// town's own files load apart from this one.
		if (error instanceof Error && error.name === "Unheld") unheld();
		// The browser gives no graphics card to the page (WebGPU and WebGL 2 both refused).
		else toast(texts.failed, "error");
	} finally {
		busy = false;
	}
}

function unheld(): void {
	remembered();
	host.dataset["offered"] = "false";
	for (const button of buttons) button.hidden = true;
	toast(texts.unheld, "error");
}

// The opening passed its time limit while the town arrived: the page whole at once, as another project leaves it.
function untimely(): void {
	leave();
	host.replaceChildren();
	unheld();
}

// The page whole at once, and the town gone: another project, or the projects' home.
function leave(): void {
	town?.end();
	town = null;
	mark(false);
	corner(false, false);
	document.body.classList.remove("town");
	whole();
}

// The project's settings keep another style than the one its town was built in: the page whole at once, and the next
// opening builds the style kept.
export function restyled(name: string, style: string): void {
	if (town && built === name && host.dataset["style"] !== style) leave();
}

// The view changed: the town shows on the Map only, as it was left.
function follow(): void {
	// While the town is prepared or leaves, there is none to show or hide: `open` follows once it is there.
	if (!town) return;
	const { on: shown, project } = sonar().map.shown();
	if (built !== project) return leave();
	town.hide(!shown);
	if (shown && late) told(late);
	if (document.body.classList.contains("town") !== shown) document.body.classList.toggle("town", shown);
}

// The town's files load as the pointer comes onto the icon, or the keyboard to it: the click finds them there. A page
// whose icon is never reached still never downloads them.
const early = (): void => void import("./morph").catch(() => undefined);

function made(className: string): HTMLButtonElement {
	const button = iconButton("cube", texts.open, `icon town-toggle ${className}`);
	button.setAttribute("aria-pressed", "false");
	// Shown once the machine is known to draw the town (./offered.ts).
	button.hidden = true;
	button.addEventListener("click", () => void toggle());
	button.addEventListener("pointerenter", early, { once: true });
	button.addEventListener("focus", early, { once: true });
	buttons.push(button);
	return button;
}

// The icon in the map's tools, and one in a corner on a phone, whose map shows no tools (../page.css). The town and the
// phone's icon are in the Map's layer, which Sonar lays before a session's panel: an open panel makes them inert, as the
// rest of the page. Both icons are made first: the map's is the first of `buttons` (`corner`).
export function wireTown(): void {
	const [mapIcon, phoneIcon] = [made("town-map"), made("town-phone")];
	const { slots } = sonar();
	slots.part({ screen: "map", place: "tools", mount: (node) => void node.append(mapIcon) });
	slots.part({ screen: "map", place: "layer", mount: (node) => void node.append(host, phoneIcon) });
	void offered().then((yes) => {
		// The settings show the town's sounds where the town is offered only: before its icon, which plays them.
		if (yes) offerSounds();
		// The answer, read by the page tests.
		host.dataset["offered"] = String(yes);
		for (const button of buttons) button.hidden = !yes;
	});
	sonar().map.onShown(follow);
	// A window that shows again: what its agents did meanwhile is there at once, not played late.
	document.addEventListener("visibilitychange", () => late && told(late));
	// The graphics card lost or refused the drawing at every tier (./drawer.ts): the page comes back and says so, rather
	// than a blank town.
	host.addEventListener("town-failed", () => {
		leave();
		toast(texts.failed, "error");
	});
}
