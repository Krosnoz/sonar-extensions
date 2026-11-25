// The test browser draws on its processor, where the town is not offered (src/offered.ts): a page test
// asks by hand for a drawing a processor holds, a pixel for 2 to 4 of the screen's on each side and no pass
// (`sonar:town-draw`, src/drawer.ts).

import type { Page } from "playwright-core";

export async function lightTown(page: Page): Promise<void> {
	await page.addInitScript(() =>
		localStorage.setItem(
			"sonar:town-draw",
			JSON.stringify({ ratio: Math.max(0.5, devicePixelRatio / 4), samples: 0, mask: false, tone: false, glow: false, smooth: false }),
		),
	);
}
