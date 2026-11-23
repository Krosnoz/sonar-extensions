// The texts and formats of the page's language: amounts, counts and days as Sonar's plugin writes them (Sonar's
// usage/format.ts and ui/time.ts).

import { english, type Texts } from "./texts";
import { french } from "./texts-fr";

export type Kit = ReturnType<typeof kitOf>;

// French parts its thousands by a narrow space (U+202F), which the page's font draws about a pixel wide at its small
// sizes: "7 122" read "7122". A no-break space of the usual width (U+00A0) is seen, as Sonar's page writes them
// (its ui/numbers.ts).
const seen = (written: string) => written.replace(/(\d) (?=\d)/g, "$1 ");

export function kitOf(language: "en" | "fr") {
	const locale = language === "fr" ? "fr-FR" : "en-US";
	const money = new Intl.NumberFormat(locale, { style: "currency", currency: "USD", currencyDisplay: "narrowSymbol", maximumFractionDigits: 2 });
	// Small amounts paid (a few cents): three decimals, else everything would show "$0.00".
	const cents = new Intl.NumberFormat(locale, {
		style: "currency",
		currency: "USD",
		currencyDisplay: "narrowSymbol",
		minimumFractionDigits: 3,
		maximumFractionDigits: 3,
	});
	// A cap the user wrote: "$3", "$2.5", without decimals it does not have.
	const cap = new Intl.NumberFormat(locale, { style: "currency", currency: "USD", currencyDisplay: "narrowSymbol", minimumFractionDigits: 0, maximumFractionDigits: 2 });
	const whole = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 });
	const compact = new Intl.NumberFormat(locale, { notation: "compact", maximumFractionDigits: 1 });
	// "Saturday, November 21"; "sam." in French, its dot left out under a bar.
	const fullDay = new Intl.DateTimeFormat(locale, { weekday: "long", day: "numeric", month: "long" });
	const shortWeekday = new Intl.DateTimeFormat(locale, { weekday: "short" });
	const texts: Texts = language === "fr" ? french : english;
	return {
		texts,
		paid: (value: number) => seen((value < 1 ? cents : money).format(value)),
		cap: (value: number) => seen(cap.format(value)),
		whole: (value: number) => seen(whole.format(value)),
		compact: (value: number) => seen(compact.format(value)),
		fullDay: (at: Date) => fullDay.format(at),
		shortWeekday: (at: Date) => shortWeekday.format(at),
	};
}
