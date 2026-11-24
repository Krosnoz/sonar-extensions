// What Sonar says of a session, as an extension's page has it (PageApi's `session`): the lines every screen of Sonar
// shows of it (its card on the Map, its row, its panel), drawn by Sonar. An extension that shows a session says it as
// the rest of the page does, in the user's language, and never reads a screen of Sonar to do so.

// Something that happened to a session. `when`: its time as Sonar writes one (its day too, past today). `text`: what
// happened, in the user's language.
export type SessionEvent = { readonly at: number; readonly when: string; readonly text: string };

export type PageSession = {
	// Changes when `says`, `state()` or `marks()` would say something else: an extension draws them again then, and
	// not at each frame. A duration `state()` shows runs by itself.
	readonly key: string;
	// What it asks the user, else what it last said; null while it said nothing.
	readonly says: string | null;
	// The line of its state: what it does or waits for, since when, with its last tool while it works. A new node at
	// each call.
	readonly state: () => HTMLElement;
	// Its badges on one line: its computer, the cloud, what waits for the user, its pull requests, its ticket. A new
	// node at each call; null without a badge.
	readonly marks: () => HTMLElement | null;
	// What happened to it lately, the latest last.
	readonly events: readonly SessionEvent[];
	// It runs on a computer linked to this PC (true), or on this PC (false). Absent from a Sonar older than it.
	readonly remote?: boolean;
};
