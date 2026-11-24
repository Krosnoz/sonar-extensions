// The town's box on the screen, read once and at each change of its size: read in a frame, after the page's styles
// changed in the same frame, it forces the browser to lay the page out again.
export type Size = { width: number; height: number; left: number; top: number };

// The Map's frame on the screen: Sonar lays its Map over the whole window, under its top bar too. What the town cuts
// of the page, and covers as it leaves.
export const mapFrame = (): DOMRect => new DOMRect(0, 0, document.documentElement.clientWidth, document.documentElement.clientHeight);

// How much of the town the page's top bar covers: the host's top padding (styles/world-icon.css).
export const topOf = (host: HTMLElement): number => Number.parseFloat(getComputedStyle(host).paddingTop) || 0;

// The page's floating controls over the town, under its top bar (the town's button, the voice's orb, the compass), in CSS pixels from
// the town's box: read on the page, so that a control added or moved is avoided too. A control counts when it shows and
// nothing covers its middle.
export function controlsOver(host: HTMLElement): { left: number; top: number; right: number; bottom: number }[] {
	const box = host.getBoundingClientRect();
	const bar = box.top + topOf(host);
	return [...document.querySelectorAll<HTMLElement>("button, a[href], [role=button]")]
		.filter((each) => !each.closest(".world-layer") && each.checkVisibility({ opacityProperty: true, visibilityProperty: true }))
		.map((each) => [each, each.getBoundingClientRect()] as const)
		.filter(([, at]) => at.width > 0 && at.top >= bar && at.bottom <= box.bottom && at.right > box.left && at.left < box.right)
		.filter(([each, at]) => each.contains(document.elementFromPoint((at.left + at.right) / 2, (at.top + at.bottom) / 2)))
		.map(([, at]) => ({ left: at.left - box.left, top: at.top - box.top, right: at.right - box.left, bottom: at.bottom - box.top }));
}

export function sizeOf(host: HTMLElement): { size: Size; stop: () => void } {
	const size: Size = { width: 0, height: 0, left: 0, top: 0 };
	const read = (): void => {
		const box = host.getBoundingClientRect();
		Object.assign(size, { width: host.clientWidth, height: host.clientHeight, left: box.left, top: box.top });
	};
	read();
	const observer = new ResizeObserver(read);
	observer.observe(host);
	return { size, stop: () => observer.disconnect() };
}
