// The block "Town" of a project's General screen: the style of its town, a picture per style, and first the draw. A
// choice is saved at once by the extension's route (./server.ts), and says how it went. A save that fails puts the
// choice back where it was, with why. A town built in another style ends (./toggle.ts#restyled): its next opening
// builds the style chosen.

import { el, glyphOf } from "./dom";
import { sonar } from "./sonar";
import { keepStyle } from "./style-kept";
import type { WorldStyle } from "./styles";
import { worldTexts } from "./texts";
import { restyled } from "./toggle";
import { WORLD_STYLES, type World, worldOf } from "./world";

type Choice = WorldStyle | "automatic";

// A style's town, by day and by night: the page's theme shows one (./page.css), and only that one loads.
function pictures(style: WorldStyle): HTMLElement[] {
	return (["day", "night"] as const).map((time) => {
		const image = el("img", `town-${time}`);
		image.alt = "";
		image.loading = "lazy";
		image.src = `/ext/${sonar().id}/towns/${style}-${time}.webp`;
		return image;
	});
}

// As Sonar's own forms say a saving that waits, and one that failed.
function waiting(text: string): HTMLElement {
	const line = el("div", "phone-wait");
	line.append(el("span", "ui-spinner"), text);
	return line;
}
function failure(title: string, hint: string): HTMLElement {
	const box = el("div", "phone-fail");
	const head = el("strong");
	const glyph = glyphOf("alert");
	if (glyph) head.append(glyph);
	head.append(title);
	box.append(head, el("span", "u-hint", hint));
	return box;
}

// The choice saved, as the server keeps it; a refusal throws its reason. A server out of reach makes the browser's
// fetch throw a TypeError in its own words ("Failed to fetch"): it is said as a server that did not answer, as Sonar's
// own forms say it.
const saved = async (project: string, style: Choice): Promise<World> => {
	const answer = await sonar()
		.http.post("/style", { project, style })
		.catch((error: unknown) => {
			throw error instanceof TypeError ? new Error(worldTexts.style.noAnswer) : error;
		});
	const world = worldOf(answer);
	if (!world) throw new Error(worldTexts.style.noAnswer);
	return world;
};

// What the section says on its line.
const line = (each: World): string => {
	const texts = worldTexts.style;
	const style = each.style ?? each.drawn;
	return texts.values(each.style === null, style ? texts.names[style] : "");
};

// Each choice's picture and name. The draw shows the style drawn; before any draw, the six it draws among.
function drawTiles(tiles: readonly { choice: Choice; tile: HTMLElement }[], world: World, chosen: Choice): void {
	const texts = worldTexts.style;
	for (const { choice, tile } of tiles) {
		const shown = choice === "automatic" ? world.drawn : choice;
		const frame = el("span", shown ? "town-frame" : "town-frame town-all");
		frame.append(...(shown ? pictures(shown) : WORLD_STYLES.flatMap(pictures)));
		const check = el("span", "town-check");
		const glyph = glyphOf("check");
		if (glyph) check.append(glyph);
		frame.append(check);
		const name = el("span", "town-tile-name", choice === "automatic" ? texts.automatic : texts.names[choice]);
		if (choice === "automatic" && shown) name.append(el("small", "", texts.names[shown]));
		tile.replaceChildren(frame, name);
		tile.setAttribute("aria-checked", String(choice === chosen));
	}
}

// `project`: its name, for the server; `told`: what the section says on its line, at each change.
export function townStylePane(project: string, initial: World, told: (line: string) => void): HTMLElement[] {
	const texts = worldTexts.style;
	let world = initial;
	const grid = el("div", "town-tiles");
	grid.setAttribute("role", "radiogroup");
	grid.setAttribute("aria-label", texts.label);
	const state = el("div", "town-style-state");
	state.setAttribute("role", "status");
	const tiles = (["automatic", ...WORLD_STYLES] as const).map((choice) => {
		const tile = el("button", "town-tile");
		tile.type = "button";
		tile.setAttribute("role", "radio");
		tile.dataset["value"] = choice;
		if (choice === "automatic") tile.dataset["tip"] = texts.automaticTip;
		tile.addEventListener("click", () => void save(choice));
		return { choice, tile };
	});
	grid.append(...tiles.map((each) => each.tile));
	drawTiles(tiles, world, world.style ?? "automatic");
	told(line(world));

	async function save(next: Choice): Promise<void> {
		if (grid.getAttribute("aria-busy") === "true" || next === (world.style ?? "automatic")) return;
		grid.setAttribute("aria-busy", "true");
		drawTiles(tiles, world, next);
		told(line({ style: next === "automatic" ? null : next, drawn: world.drawn }));
		state.replaceChildren(waiting(texts.saving));
		const answer = await saved(project, next).then(
			(value) => ({ ok: true, value }) as const,
			(error: unknown) => ({ ok: false, error: error instanceof Error ? error.message : "" }) as const,
		);
		grid.removeAttribute("aria-busy");
		if (answer.ok) {
			world = answer.value;
			state.replaceChildren();
			const style = world.style ?? world.drawn;
			if (style) {
				keepStyle(project, style);
				restyled(project, style);
			}
		} else state.replaceChildren(failure(texts.failed, `${answer.error || texts.noAnswer} ${texts.kept(line(world))}`));
		drawTiles(tiles, world, world.style ?? "automatic");
		told(line(world));
	}

	return [el("p", "panel-hint town-style-hint", texts.hint), grid, state];
}
