// The states' colours: at rest, at work, waits for the user, to review. They are the page's (paintStates): at work and
// to review take the accent the user chose. Fixed here, a teal and a violet did not match the page's cards.
import { colourOf } from "./rim";

export const STATE = ["#b9ae9f", "#27c2a8", "#ff9838", "#a79ff5"];
const STATE_TOKENS = [null, "--tone-work", "--wait", "--tone-done"];
const hexOf = (css: string): string =>
	`#${colourOf(css)
		.map((value) => value.toString(16).padStart(2, "0"))
		.join("")}`;
export function paintStates(host: HTMLElement): void {
	const style = getComputedStyle(host);
	STATE_TOKENS.forEach((token, at) => {
		const value = token && style.getPropertyValue(token).trim();
		if (value) STATE[at] = hexOf(value);
	});
}
