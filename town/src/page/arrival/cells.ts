// A thing of the page cut into square cells, each of the colour the page shows there: its background, the colour of a
// text over it, a state's dot. Each cell gives a point of that colour, which takes off as the page's edge reaches it;
// the page itself is hidden behind the edge by its cover (./cover.ts).
// `t0`: when its point takes off.
export type Cell = { x: number; y: number; colour: [number, number, number]; text: boolean; t0: number; flies: boolean };

const probe = document.createElement("canvas").getContext("2d", { willReadFrequently: true })!;
const mixed = new Map<string, [number, number, number]>();
// The colour of layers painted one over the other, as the page paints them: the browser's own canvas reads every colour
// the page may write (oklab, color-mix, alpha).
// `ink`: a text over the layers; its glyphs cover about a third of a cell.
function paint(layers: string[], ink?: string): [number, number, number] {
	const key = `${layers.join("|")}|${ink}`;
	const known = mixed.get(key);
	if (known) return known;
	probe.clearRect(0, 0, 1, 1);
	for (const layer of layers) {
		probe.fillStyle = layer;
		probe.fillRect(0, 0, 1, 1);
	}
	if (ink) {
		probe.globalAlpha = 0.35;
		probe.fillStyle = ink;
		probe.fillRect(0, 0, 1, 1);
		probe.globalAlpha = 1;
	}
	const [r, g, b] = probe.getImageData(0, 0, 1, 1).data;
	const colour: [number, number, number] = [r!, g!, b!];
	mixed.set(key, colour);
	return colour;
}
const clearColour = (value: string): boolean => value === "transparent" || /rgba\(.*,\s*0\)$/.test(value) || /\/\s*0\)$/.test(value);
const inside = (r: DOMRect, x: number, y: number): boolean => x >= r.left && x < r.right && y >= r.top && y < r.bottom;
type Painted = { rect: DOMRect; colour: string };
// What the page really shows. The cards of an island seen from far are hidden by their opacity and their visibility,
// not by their display: taken for shown, each was cut on its own, and the island stayed whole where they stand (15/11).
export const shows = (element: Element): boolean => element.checkVisibility({ opacityProperty: true, visibilityProperty: true });

// The layers that paint something, in the page's order: what comes later paints over.
function layersOf(element: HTMLElement, fill?: string): Painted[] {
	return [element, ...element.querySelectorAll<HTMLElement>("*")]
		.filter((each) => each === element || shows(each))
		.map((each) => ({ rect: each.getBoundingClientRect(), colour: each === element && fill ? fill : getComputedStyle(each).backgroundColor }))
		.filter((each) => !clearColour(each.colour));
}

// Each line of text the element shows, with its colour.
function textsOf(element: HTMLElement): Painted[] {
	const texts: Painted[] = [];
	const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
	const range = document.createRange();
	for (let node = walker.nextNode(); node; node = walker.nextNode()) {
		const parent = node.parentElement;
		if (!parent || !node.textContent?.trim() || !shows(parent)) continue;
		range.selectNodeContents(node);
		const colour = getComputedStyle(parent).color;
		for (const line of range.getClientRects()) texts.push({ rect: line, colour });
	}
	return texts;
}

// `under`: the colour behind the element. `skip`: the parts it holds that are cut on their own (a zone's cards).
export function cut(element: HTMLElement, size: number, under: string, skip: DOMRect[], fill?: string): Cell[] {
	const rect = element.getBoundingClientRect();
	const scale = rect.width / Math.max(1, element.offsetWidth);
	const [cols, rows] = [Math.ceil(rect.width / size), Math.ceil(rect.height / size)];
	const radius = (parseFloat(getComputedStyle(element).borderTopLeftRadius) || 0) * scale;
	const layers = layersOf(element, fill);
	const texts = textsOf(element);
	const cells: Cell[] = [];
	for (let j = 0; j < rows; j++)
		for (let i = 0; i < cols; i++) {
			const [x, y] = [rect.left + (i + 0.5) * size, rect.top + (j + 0.5) * size];
			// Outside the rounded corners, or over a part cut on its own: the cell leaves the page without a cube.
			const [cx, cy] = [Math.max(rect.left + radius - x, x - (rect.right - radius), 0), Math.max(rect.top + radius - y, y - (rect.bottom - radius), 0)];
			const covered = skip.some((r) => inside(r, x, y));
			// Off the screen, a cell leaves without a point: nobody sees it go.
			const seen = x >= 0 && y >= 0 && x < innerWidth && y < innerHeight;
			const flies = Math.hypot(cx, cy) <= radius * 0.85 + 0.01 && !covered && seen && y < rect.bottom && x < rect.right;
			const paints = [under, ...layers.filter((layer) => inside(layer.rect, x, y)).map((layer) => layer.colour)];
			const text = texts.find((each) => inside(each.rect, x, y));
			cells.push({ x, y, colour: paint(paints, text?.colour), text: !!text, t0: Infinity, flies });
		}
	return cells;
}
