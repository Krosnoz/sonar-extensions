// The statistics' blocks: a question with its verdict, then its figures, each with its gap and a bar a week. What a
// figure counts is its tip (on hover, on a touch); the tile says so in words only when it has no value to show.

import { type Figure, gapOf, seriesOf, valueOf, type Week } from "./figures";
import { kit } from "./kit";
import { CHEVRON } from "./look";
import { tileFrame, waitingTile } from "./tile";
import { verdictHead } from "./verdict";

// A tone counted by the question's verdict.
export type Tone = "good" | "bad" | "";

// A bar a week; the weeks compared in full color, the others a grid of Ping's dots. A week that measured nothing has no
// bar. A bar's height is its share (--v): a scale would stretch its dots.
function spark(figure: Figure, weeks: readonly Week[], shown: ReadonlySet<string>): HTMLElement {
	const { ui } = kit();
	const values = seriesOf(figure, weeks);
	const max = Math.max(...values.map((value) => Math.abs(value ?? 0)), Number.EPSILON);
	const node = ui.el("span", "stats-spark");
	node.setAttribute("aria-hidden", "true");
	for (const [at, value] of values.entries()) {
		const bar = ui.el("i", shown.has(weeks[at]?.start ?? "") ? "now" : "");
		bar.style.setProperty("--v", String(value === null ? 0 : Math.max(0.04, Math.abs(value) / max)));
		node.append(bar);
	}
	return node;
}

// A figure over the weeks compared, against the weeks before. A figure no week measured says so under its dash, with the
// first week it measured when there is one.
export function figureTile(figure: Figure, weeks: readonly Week[], now: readonly Week[], before: readonly Week[]): { node: HTMLElement; tone: Tone } {
	const { ui, texts, format } = kit();
	const value = valueOf(figure, now);
	const { gap, tone } = gapOf(figure, value, valueOf(figure, before));
	const first = weeks.find((week) => valueOf(figure, [week]) !== null);
	const missing = value === null ? (first ? texts.notMeasured(format.day.format(new Date(`${first.start}T12:00:00`))) : texts.unmeasured) : "";
	// A gap that rounds to nothing reads "=", not "-0".
	const shown = gap === null ? 0 : Math.round(gap * 100);
	const mark =
		gap === null
			? null
			: ui.el("b", `stats-gap ${tone}`, shown === 0 ? texts.same : figure.points ? `${format.signedPoints.format(shown)} pts` : format.signedPercent.format(gap));
	const node = tileFrame(figure.label, value === null ? "—" : figure.format(value), figure.hint, mark, missing);
	node.append(spark(figure, weeks, new Set(now.map((week) => week.start))));
	return { node, tone };
}

// A question: its title, its verdict from its figures' tones, a link to its details, its tiles.
export function question(title: string, tiles: readonly { node: HTMLElement; tone: Tone }[], link?: { label: string; go: () => void }): HTMLElement {
	const { ui } = kit();
	const head = verdictHead(title, {
		bad: tiles.filter((tile) => tile.tone === "bad").length,
		good: tiles.some((tile) => tile.tone === "good"),
		compared: tiles.some((tile) => tile.node.querySelector(".stats-gap")),
	});
	if (link) {
		const button = ui.el("button", "stats-link", link.label) as HTMLButtonElement;
		button.type = "button";
		button.insertAdjacentHTML("beforeend", CHEVRON);
		button.addEventListener("click", link.go);
		head.append(button);
	}
	const grid = ui.el("div", "u-tiles stats-tiles");
	grid.append(...tiles.map((tile) => tile.node));
	const node = ui.el("section", "u-section stats-block");
	node.append(head, grid);
	return node;
}

// A question being read: its title, then its tiles as the skeleton's lines: a label, a value and the bars each.
export function waitingQuestion(title: string, tiles = 4): HTMLElement {
	const { ui } = kit();
	const grid = ui.el("div", "u-tiles stats-tiles");
	for (let at = 0; at < tiles; at += 1) grid.append(waitingTile());
	const node = ui.el("section", "u-section stats-block");
	node.append(ui.el("h3", "", title), grid);
	node.setAttribute("aria-busy", "true");
	return node;
}
