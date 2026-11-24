// The Map as an extension's page sees it (PageApi's `map` of ./contract.ts): its cards with their session, and the
// cover an extension lays over it to draw another view of the same agents. Types only; the page fills them.

// A pull request of a session, as the Map's chip says it. `ci`: what its checks say; `done` of `total`: those that ended.
export type MapPull = {
	readonly url: string;
	readonly number: number;
	readonly state: "open" | "merged" | "closed";
	readonly ci: "passed" | "failed" | "pending" | "none";
	readonly done: number;
	readonly total: number;
};

// A session as the Map shows it, by its card.
export type MapSession = {
	readonly handle: string;
	readonly name: string;
	// Its subject, the island its card stands in. `unfiled`: no subject holds it yet.
	readonly topic: string;
	readonly unfiled: boolean;
	// It waits for the user, works, is finished and to review, or rests.
	readonly state: "wait" | "work" | "done" | "rest";
	// The tasks it delegated, true for one at work.
	readonly tasks: readonly boolean[];
	readonly pulls: readonly MapPull[];
	// Its subject's merges, as Sonar counts them.
	readonly merges: number;
	// Its last tool, and what it does as its agent says it ("read", "edit", "shell"), null for one it does not class.
	readonly tool: { readonly name: string; readonly kind: string | null } | null;
};

// The Map, for an extension that draws another view of it.
export type PageMap = {
	// Whether the Map shows (its tab chosen, a project open), and that project.
	readonly shown: () => { readonly on: boolean; readonly project: string | null };
	// Told when either changes; returns what stops the listening.
	readonly onShown: (listen: () => void) => () => void;
	// The Map's cards as the page shows them now, each with its node: its place and its look are the Map's, and what is
	// inside it is the core's, not the contract's. `island`: the block of its subject on the Map, which the cards of one
	// subject share; absent from a Sonar older than it.
	readonly cards: () => readonly { readonly session: MapSession; readonly node: HTMLElement; readonly island?: HTMLElement }[];
	// Covers the Map (`on`): it keeps its drawing as it is, its tools and its minimap hidden, while the extension draws
	// over it in its "layer"; `watch` is told what the Map would draw, at each change. Uncovered, the Map draws what
	// changed meanwhile. One extension covers it at a time: another's call throws. Cut or removed, it uncovers.
	readonly cover: (on: boolean, watch?: (sessions: readonly MapSession[]) => void) => void;
	// Hides the Map's drawing under the extension's cover (`on`), for a cover nothing shows through: its cards keep their
	// places. Drawn again at `hide(false)`, and by itself when the cover ends. Throws while the extension does not cover
	// the Map. Absent from a Sonar older than it.
	readonly hide?: (on: boolean) => void;
	// What the page keeps floating over the Map and its cover (Ping's dock), those that show, as boxes in the window: a
	// cover keeps its own parts clear of them. Absent from a Sonar older than it.
	readonly floating?: () => readonly DOMRect[];
};
