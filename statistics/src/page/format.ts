// Amounts, counts, durations and days in the page's language, as Sonar's page writes them (its usage/format.ts and
// ui/time.ts): built once, as the page entry starts (./kit.ts).

import type { Texts } from "./texts";

export type Formats = ReturnType<typeof formatsOf>;

export function formatsOf(locale: string, texts: Texts) {
	// French parts its thousands by a narrow space (U+202F), which the page's font draws about a pixel wide at its small
	// sizes: "7 122" read "7122". A no-break space of the usual width (U+00A0) is seen, as Sonar's page writes them
	// (its ui/numbers.ts).
	const number = (options: Intl.NumberFormatOptions) => {
		const made = new Intl.NumberFormat(locale, options);
		return { format: (value: number) => made.format(value).replace(/(\d) (?=\d)/g, "$1 ") };
	};
	const money = number({ style: "currency", currency: "USD", currencyDisplay: "narrowSymbol", maximumFractionDigits: 2 });
	const whole = number({ maximumFractionDigits: 0 });
	const one = number({ maximumFractionDigits: 1 });
	const percent = number({ style: "percent", maximumFractionDigits: 0 });
	const signedPercent = number({ style: "percent", maximumFractionDigits: 0, signDisplay: "always" });
	const signedPoints = number({ maximumFractionDigits: 0, signDisplay: "always" });
	// "15/10" in French, "10/15" in English.
	const day = new Intl.DateTimeFormat(locale, { day: "2-digit", month: "2-digit" });
	const duration = (ms: number): string => {
		const minutes = Math.max(0, Math.round(ms / 60_000));
		if (minutes < 60) return texts.minutes(minutes);
		const hours = Math.floor(minutes / 60);
		return hours < 48 ? texts.hoursMinutes(hours, String(minutes % 60).padStart(2, "0")) : texts.days(Math.round(hours / 24));
	};
	return { money, whole, one, percent, signedPercent, signedPoints, day, duration };
}
