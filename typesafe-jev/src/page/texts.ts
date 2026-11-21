// The page's texts in English, chosen by the page's language (./kit.ts); their French is in ./texts-fr.ts. The words are
// those of Sonar's plugin `jev`, so that the screen stays the same once Jev moved to this extension.

export const english = {
	jevOn: "Jev on",
	jevNeedsKey: "Jev needs a TypeSafe key",
	periods: { "1": "Today", "7": "7 days", "30": "30 days" },
	cost: "Jev · judgments",
	costHint: (calls: string, tokens: string, estimated: boolean) => `${calls} calls · ${tokens} tokens${estimated ? " · partly estimated" : ""}`,
	perDay: (max: string) => `Per day · max ${max}`,
	price: "Jev at $0.042 per million input tokens, read at each call.",
	// A chart's bar, as a screen reader says it.
	barSaid: (label: string, value: string) => `${label}: ${value}`,
	note: {
		body: "Without a TypeSafe key, decisions come in their order of arrival. The map shows neither urgency nor “same topic” links.",
		open: "Open Services",
	},
	// Jev switched off by itself: its monthly cap reached, or TypeSafe out of credits.
	stopped: {
		cap: (usd: number) => `Jev is off: it cost $${usd} this month, its cap. Setting jevMonthlyUsd.`,
		credits: "Jev is off: TypeSafe has no credits left. Turn it on again after the top-up.",
	},
};

export type Texts = typeof english;
