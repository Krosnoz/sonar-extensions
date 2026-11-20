// Amounts, counts, durations and days in the page's language, as Sonar's page writes them (its usage/format.ts and
// ui/time.ts): built once, as the page entry starts (./kit.ts).

import type { Texts } from "./texts";

export type Formats = ReturnType<typeof formatsOf>;

export function formatsOf(locale: string, texts: Texts) {
	const money = new Intl.NumberFormat(locale, { style: "currency", currency: "USD", currencyDisplay: "narrowSymbol", maximumFractionDigits: 2 });
	const whole = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 });
	const one = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 });
	const percent = new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: 0 });
	const signedPercent = new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: 0, signDisplay: "always" });
	const signedPoints = new Intl.NumberFormat(locale, { maximumFractionDigits: 0, signDisplay: "always" });
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
