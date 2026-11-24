// A subject's pictogram over its roof: its state, as a vector shape of the design system (the page's icons, the tokens'
// colours, an ink hairline), never pixels. Its count is text beside it (./signs.ts), in the label's type. Its ring of
// points is the far marks' (./mark-cloud.ts).
import { sonar } from "./sonar";
import { STATE } from "./state-colours";

// The page's icon for each state (an icon of Sonar's set, by its name): waiting is the bell, to review the check, at
// work the spinner's arc.
const GLYPH: Record<string, string> = { wait: "bell", done: "check", work: "spinner" };
const COLOUR_AT: Record<string, number> = { work: 1, wait: 2, done: 3 };
const NS = "http://www.w3.org/2000/svg";

// An icon's strokes, without its own frame: read once per icon.
const read = new Map<string, { body: string; width: string }>();
const strokes = (name: string): { body: string; width: string } => {
	const known = read.get(name);
	if (known) return known;
	const svg = sonar().ui.icon(name).innerHTML;
	const found = { body: svg.slice(svg.indexOf(">") + 1, svg.lastIndexOf("</svg>")), width: /stroke-width="([\d.]+)"/.exec(svg)?.[1] ?? "1.8" };
	read.set(name, found);
	return found;
};

// `cell`: the town's pixel, in CSS pixels; the pictogram is nine of them wide.
export function sprite(kind: string, cell: number): SVGSVGElement {
	const size = 9 * cell;
	const unit = 24 / size;
	const colour = STATE[COLOUR_AT[kind]!]!;
	const glyph = strokes(GLYPH[kind]!);
	// A hairline of 1.5 CSS pixels in the 24-unit frame.
	const hairline = `stroke="var(--ink)" stroke-width="${1.5 * unit}"`;
	const drawn = (scale: number, stroke: string): string =>
		`<g transform="translate(${12 - 12 * scale} ${12 - 12 * scale}) scale(${scale})" fill="none" stroke="${stroke}" stroke-width="${glyph.width}" stroke-linecap="round" stroke-linejoin="round">${glyph.body}</g>`;
	let points = "";
	for (let k = 0; k < 10; k++)
		points += `<circle cx="${12 + 8.4 * Math.cos((k * Math.PI) / 5)}" cy="${12 + 8.4 * Math.sin((k * Math.PI) / 5)}" r="1.25" fill="${colour}"/>`;
	const body = `<circle cx="12" cy="12" r="${11.25 - 0.75 * unit}" fill="var(--surface)" ${hairline}/>${points}${drawn(0.44, "var(--ink)")}`;
	const svg = document.createElementNS(NS, "svg");
	svg.setAttribute("viewBox", "0 0 24 24");
	svg.setAttribute("width", String(size));
	svg.setAttribute("height", String(size));
	// Only the page's own icons and colours: nothing the user wrote.
	svg.innerHTML = body;
	return svg;
}
