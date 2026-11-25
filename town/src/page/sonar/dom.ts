// The town's interface basics: an element, typed by its tag, and an icon button of Sonar's set, whose glyph and tip
// come from the extension's API (PageUi of @sonar/extension): the button holds the glyph itself, as Sonar's own do.

import { sonar } from "./sonar";

export function el<K extends keyof HTMLElementTagNameMap>(tag: K, className = "", text = ""): HTMLElementTagNameMap[K] {
	const node = document.createElement(tag);
	if (className) node.className = className;
	if (text) node.textContent = text;
	return node;
}

// The glyph of an icon of Sonar's set, without the box the API wraps it in.
export const glyphOf = (name: string): Element | null => sonar().ui.icon(name).firstElementChild;

export function iconButton(icon: string, label: string, className = "icon"): HTMLButtonElement {
	const button = el("button", className);
	button.type = "button";
	button.setAttribute("aria-label", label);
	sonar().ui.tip(button, label);
	const glyph = glyphOf(icon);
	if (glyph) button.append(glyph);
	return button;
}
