// Jev's cost by day as Sonar's plugin draws it (Sonar's usage/format.ts#bars and usage/bar-reading.ts), with the
// extension's own classes (../page.css): a bar a day, rounded on top, 2 px apart, today in the full colour; over the
// chart, the day and the exact amount of the bar read. The bar under the pointer, touched or chosen with the arrow keys
// is read, the others dim; at rest, the line reads today.

import type { PageUi } from "@sonar/extension";
import type { Chart } from "./figures";

function reading(ui: PageUi, chart: Chart, bars: HTMLElement, columns: readonly HTMLElement[]): HTMLElement {
	const line = ui.el("div", "jev-reading");
	// Said again by a screen reader when the arrows choose another bar (the chart is a group, not an image, for that).
	line.setAttribute("aria-live", "polite");
	const when = ui.el("span");
	const amount = ui.el("b");
	line.append(when, amount);
	let shown = chart.rest;
	const show = (index: number) => {
		const bar = chart.bars[index];
		if (!bar) return;
		shown = index;
		when.textContent = bar.label;
		amount.textContent = bar.amount;
		bars.classList.toggle("picked", index !== chart.rest);
		columns.forEach((column, at) => column.classList.toggle("on", at === index && index !== chart.rest));
	};
	show(chart.rest);
	columns.forEach((column, index) => {
		column.addEventListener("pointerenter", () => show(index));
		// A touch keeps its bar: on a phone, the pointer leaves as soon as the finger lifts.
		column.addEventListener("pointerdown", () => show(index));
	});
	bars.addEventListener("pointerleave", (event) => {
		if (event.pointerType === "mouse") show(chart.rest);
	});
	bars.tabIndex = 0;
	bars.addEventListener("keydown", (event) => {
		const step = event.key === "ArrowLeft" ? -1 : event.key === "ArrowRight" ? 1 : 0;
		if (!step) return;
		event.preventDefault();
		show(Math.min(chart.bars.length - 1, Math.max(0, shown + step)));
	});
	bars.addEventListener("blur", () => show(chart.rest));
	return line;
}

export function chartOf(ui: PageUi, chart: Chart): HTMLElement {
	const bars = ui.el("div", "jev-bars");
	bars.setAttribute("role", "group");
	bars.setAttribute("aria-label", chart.said);
	const columns = chart.bars.map((bar, at) => {
		const column = ui.el("div", at === chart.rest ? "jev-bar now" : "jev-bar");
		const fill = ui.el("i");
		// Sized once, as the chart is drawn: a scale would stretch its dots and its rounded top.
		fill.style.setProperty("--v", String(bar.share));
		column.append(fill, ui.el("span", "jev-tick", bar.tick));
		return column;
	});
	bars.append(...columns, reading(ui, chart, bars, columns));
	const section = ui.el("section", "jev-chart");
	section.append(ui.el("h3", "u-label", chart.title), bars);
	return section;
}
