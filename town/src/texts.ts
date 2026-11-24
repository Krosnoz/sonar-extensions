// The town's texts, in the language the page reads (PageApi's `language`): written here in English, in French in
// ./i18n-fr.ts. The entry says the language once (./start.ts): until then, English.

import { french } from "./i18n-fr";

const english = {
	// The icon that turns the page into the town, and back.
	open: "Visualisation",
	close: "Back to the page",
	working: (n: number) => `${n} at work`,
	waiting: (n: number) => `${n} waiting for you`,
	reviewing: (n: number) => `${n} to review`,
	// A subject's open pull request, as its sign's gauge reads aloud: its checks that ended, or that one fails; one
	// merged, as a session's pull requests say it.
	pull: (number: number, done: number, total: number) => (total ? `PR #${number}: ${done} of ${total} checks done` : `PR #${number}`),
	pullFails: (number: number) => `PR #${number}: a check fails`,
	pullMerged: (number: number) => `#${number} · merged`,
	// The compass: it appears when the town is turned or tilted, and brings it back to its heading and height.
	compass: "Straighten the view",
	// An inhabitant's notebook, pinned by a click: nothing happened to its session lately; the way to its session; its
	// cross.
	noteNone: "Nothing noted yet",
	noteOpen: "Open the session",
	noteClose: "Close the notebook",
	// The map shows no agent: there is nothing to build.
	empty: "No agent on the map: the town would be empty.",
	// The town needs the graphics card: shown when the browser gives none.
	failed: "The town cannot be drawn in this browser.",
	// The town is drawn whole or not at all: shown once, when this machine's graphics card does not hold it.
	unheld: "This machine cannot draw the whole town: its icon comes back tomorrow.",
	// The town's section of Settings › Sounds (./sound-lines.ts): its title, and its lines.
	soundsTitle: "The town",
	sounds: {
		"town-bricks": { name: "Bricks are laid", hint: "A block or a storey is being built" },
		"town-merges": { name: "A merge, a storey done", hint: "Merged work goes up into the building" },
		"town-pulls": { name: "A PR under test", hint: "Its scaffolding goes up; its tests fail" },
		"town-people": { name: "An inhabitant comes or goes", hint: "A session opens or closes" },
	},
};

// A translation: the same keys as the English, each whole. A key missing or added fails tsc.
type Whole<T> = T extends string ? string : T extends (...args: infer A) => infer R ? (...args: A) => Whole<R> : { readonly [K in keyof T]: Whole<T[K]> };
export type Translation = Whole<typeof english>;

export const worldTexts: Translation = { ...english };

export const speak = (language: "en" | "fr"): void => void Object.assign(worldTexts, language === "fr" ? french : english);
