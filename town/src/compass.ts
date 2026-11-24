// The compass: only while the camera is turned or tilted; its needle turns with the heading. It brings the camera back
// to the default heading nearest (a whole turn from it), and to the default height, never to the angle of the arrival.
import type { View } from "./kit";
import { reducedMotion } from "./look";
import { sonar } from "./sonar";
import { worldTexts as texts } from "./texts";

export type Heading = { yaw: number; pitch: number };
export type Compass = {
	// Called at each frame: the compass shows while the camera is off its heading or its height.
	follow: (view: View) => void;
	dispose: () => void;
};

// `home`: the heading and height it brings back; `aimed`: the ones the camera eases to, which it sets; `orient`: turns
// the camera at once, with motion reduced; `running`: whether the town still draws.
export function compass(host: HTMLElement, home: Heading, aimed: Heading, orient: (yaw: number, pitch: number) => void, running: () => boolean): Compass {
	const button = document.createElement("button");
	button.type = "button";
	button.className = "icon world-compass";
	button.setAttribute("aria-label", texts.compass);
	sonar().ui.tip(button, texts.compass);
	button.innerHTML =
		'<svg viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><path d="M12 2.5 16 12H8z" fill="currentColor"/><path d="M12 21.5 8 12h8z" fill="none"/></svg>';
	host.append(button);
	const straighten = (): void => {
		aimed.yaw = home.yaw + Math.round((aimed.yaw - home.yaw) / (2 * Math.PI)) * 2 * Math.PI;
		aimed.pitch = home.pitch;
		if (reducedMotion()) orient(aimed.yaw, aimed.pitch);
	};
	button.addEventListener("click", straighten);
	// N, on a computer, as the compass; not while typing, and only while the town shows.
	const onKey = (event: KeyboardEvent): void => {
		const target = event.target instanceof HTMLElement ? event.target : null;
		if (event.key.toLowerCase() !== "n" || event.ctrlKey || event.metaKey || event.altKey || !running() || button.inert || host.classList.contains("away"))
			return;
		if (target?.closest("input, textarea, select, [contenteditable]")) return;
		straighten();
	};
	window.addEventListener("keydown", onKey);
	const needle = button.querySelector("svg")!;
	let shown: boolean | null = null;
	return {
		// Its needle turns with the town.
		follow(view) {
			const off =
				Math.abs(view.yaw - home.yaw - Math.round((view.yaw - home.yaw) / (2 * Math.PI)) * 2 * Math.PI) > 0.01 || Math.abs(view.pitch - home.pitch) > 0.01;
			if (off !== shown) {
				shown = off;
				// Not `on`: that class of `.icon` is the orange live orb.
				button.classList.toggle("turned", off);
				button.inert = !off;
			}
			if (off) needle.style.transform = `rotate(${view.yaw}rad)`;
		},
		dispose() {
			window.removeEventListener("keydown", onKey);
			button.remove();
		},
	};
}
