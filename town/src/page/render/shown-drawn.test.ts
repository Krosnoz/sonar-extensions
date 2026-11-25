// The town's canvas after the probe: it shows again only once a frame of the construction where it is was drawn hidden
// and put on the screen. Shown with the probe's last frame in it, it showed the whole town over the page's cards for
// 300 ms with motion reduced, then the camera jumped (13/11).

import { expect, test } from "bun:test";
import { shownDrawn } from "./shown-drawn";

test("the canvas shows again after a frame of the construction drawn hidden, never before", async () => {
	const canvas = { style: { visibility: "hidden" } };
	const seen: string[] = [];
	await shownDrawn(
		canvas,
		() => seen.push(`drawn ${canvas.style.visibility}`),
		async () => {
			seen.push(`frame ${canvas.style.visibility}`);
		},
	);
	expect(seen).toEqual(["drawn hidden", "frame hidden"]);
	expect(canvas.style.visibility).toBe("");
});
