// The town's canvas shown again after the probe (./drawer.ts#compile), which drew the whole town built while it was
// hidden. Shown at once, the canvas kept the probe's last frame on the screen, the whole town over the page's cards,
// until the next frame was drawn: 300 ms with motion reduced, whose first frame builds everything (13/11). So it draws
// the construction where it is, still hidden, and shows only once the browser has put that frame on the screen.
export async function shownDrawn(
	canvas: { style: { visibility: string } },
	draw: () => void,
	frame: () => Promise<unknown> = () => new Promise(requestAnimationFrame),
): Promise<void> {
	draw();
	await frame();
	canvas.style.visibility = "";
}
