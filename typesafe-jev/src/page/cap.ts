// Jev's monthly cap in its part of Services (./services.ts), under the switch: Sonar's number field (`ui.number`, on a
// Sonar that has it), then the month's gauge, the extension's own (../page.css), as Sonar's bar of an account's limit.
//
// The gauge follows the cap the settings tell (./settings.ts: a cap saved, without a new page) and the month's spending
// each reading of the usage brings (./usage-reading.ts, every 10 s while the part shows). The field is drawn again for a
// cap or a key changed elsewhere, and for its alert once a reading of the usage says the cap reached or no longer:
// never under the user's hand, and not for its own saving, whose "Saved" Sonar says in the field's line.

import type { PageApi } from "@sonar/extension";
import { monthOf } from "./figures";
import type { Kit } from "./kit";
import type { JevView, SettingsHub } from "./settings";

type Field = { readonly value: number | null; readonly alert: string | undefined; readonly disabled: boolean };

export type CapPart = ReturnType<typeof capPart>;

export function capPart(api: PageApi, kit: Kit, settings: SettingsHub) {
	const { ui } = api;
	const state = { cap: null as number | null, usd: 0, keyed: false };
	// What shows while the part does: the field as drawn, and the gauge.
	let field: { row: HTMLElement; drawn: Field } | null = null;
	let gauge: ReturnType<typeof gaugeOf> | null = null;

	const wanted = (): Field => ({
		value: state.cap,
		alert: monthOf(state.usd, state.cap, kit).reached ? kit.texts.capReached : undefined,
		disabled: !state.keyed,
	});
	// Saved: told to the settings' listeners, the gauge among them. Refused: an empty Error, so that Sonar says its own
	// words, as the switch's.
	const change = (value: number | null) =>
		api.http.post("/settings", { monthlyUsd: value }).then(
			(answer) => {
				if (field) field.drawn = { ...field.drawn, value };
				settings.told(answer);
			},
			() => Promise.reject(new Error("")),
		);
	const rowOf = (drawn: Field): HTMLElement | null => {
		if (!ui.number) return null;
		const row = ui.number(kit.texts.monthlyCap, drawn.value, change, {
			hint: kit.texts.capHint,
			min: 0,
			step: 0.5,
			placeholder: kit.texts.capNone,
			disabled: drawn.disabled,
			...(drawn.alert === undefined ? {} : { alert: drawn.alert }),
		});
		field = { row, drawn };
		return row;
	};
	// `alertToo`: a reading of the usage, which may change the alert.
	const redraw = (alertToo: boolean) => {
		gauge?.paint(state.usd, state.cap);
		if (!field) return;
		const [next, drawn] = [wanted(), field.drawn];
		const same = next.value === drawn.value && next.disabled === drawn.disabled;
		if (same && (!alertToo || next.alert === drawn.alert)) return;
		const focused = globalThis.document?.activeElement;
		if (focused && typeof field.row.contains === "function" && field.row.contains(focused)) return;
		const { row } = field;
		const fresh = rowOf(next);
		if (fresh) row.replaceWith(fresh);
	};

	settings.hear((jev: JevView) => {
		state.cap = jev.monthlyUsd;
		state.keyed = jev.key !== null;
		redraw(false);
	});

	return {
		// The field, when this Sonar has one, and the gauge, for the settings and the month's spending read.
		draw: (jev: JevView, usd: number): HTMLElement[] => {
			Object.assign(state, { cap: jev.monthlyUsd, usd, keyed: jev.key !== null });
			gauge = gaugeOf(api, kit);
			gauge.paint(usd, state.cap);
			const row = rowOf(wanted());
			return row ? [row, gauge.node] : [gauge.node];
		},
		// The month's spending, as a reading of the usage brings it.
		month: (usd: number) => {
			state.usd = usd;
			redraw(true);
		},
		leave: () => {
			field = null;
			gauge = null;
		},
	};
}

// "This month", the bar of the month's spending against its cap (none without a cap), and its figure. The bar is kept
// from one painting to the next, so that its fill slides (../page.css).
function gaugeOf({ ui }: PageApi, kit: Kit) {
	const node = ui.el("div", "jev-month");
	const label = ui.el("span", "jev-month-label", kit.texts.thisMonth);
	const meter = ui.el("span", "jev-meter");
	meter.setAttribute("role", "meter");
	meter.setAttribute("aria-label", kit.texts.thisMonth);
	meter.setAttribute("aria-valuemin", "0");
	const fill = ui.el("span", "jev-meter-fill");
	meter.append(fill);
	const figure = ui.el("b", "jev-month-figure");
	let barred: boolean | null = null;
	const paint = (usd: number, cap: number | null) => {
		const month = monthOf(usd, cap, kit);
		figure.textContent = month.text;
		if (month.share === null || cap === null) {
			if (barred !== false) node.replaceChildren(label, figure);
			barred = false;
			return;
		}
		meter.className = month.tone ? `jev-meter ${month.tone}` : "jev-meter";
		meter.setAttribute("aria-valuemax", String(cap));
		meter.setAttribute("aria-valuenow", String(Math.min(usd, cap)));
		meter.setAttribute("aria-valuetext", month.text);
		fill.style.setProperty("--used", String(month.share));
		if (barred !== true) node.replaceChildren(label, meter, figure);
		barred = true;
	};
	return { node, paint };
}
