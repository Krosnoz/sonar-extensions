// Jev's part of Services (src/page/services.ts) on a page of its own, without Sonar and without a browser: nodes of a
// few fields stand for the DOM, and `ui.load` draws as Sonar's earliest one did, each reading in its turn, so that the
// part shows the newest state whatever order its readings come back in. Its usage is read again while it shows, in
// place, and never once it left or its extension was cut.

import { afterEach, beforeEach, expect, test } from "bun:test";
import type { Json, PageApi, PartSlot } from "@sonar/extension";
import type { UsageReport } from "../src/cost";
import { kitOf } from "../src/page/kit";
import { servicesPart } from "../src/page/services";
import { settingsHub } from "../src/page/settings";

class Node {
	children: Node[] = [];
	parent: Node | null = null;
	root = false;
	data: { [key: string]: unknown } = {};
	constructor(
		readonly tag: string,
		public className = "",
		public text = "",
	) {}
	attributes: { [name: string]: string } = {};
	setAttribute(name: string, value: string) {
		this.attributes[name] = value;
	}
	readonly style = {
		values: {} as { [name: string]: string },
		setProperty(name: string, value: string) {
			this.values[name] = value;
		},
	};
	readonly classList = {
		toggle: (name: string, on: boolean) => {
			const names = new Set(this.className.split(" ").filter(Boolean));
			if (on) names.add(name);
			else names.delete(name);
			this.className = [...names].join(" ");
		},
	};
	append(...nodes: Node[]) {
		for (const node of nodes) {
			node.parent?.children.splice(node.parent.children.indexOf(node), 1);
			node.parent = this;
			this.children.push(node);
		}
	}
	replaceChildren(...nodes: Node[]) {
		for (const child of this.children) child.parent = null;
		this.children = [];
		this.append(...nodes);
	}
	replaceWith(next: Node) {
		const parent = this.parent;
		if (!parent) return;
		parent.children[parent.children.indexOf(this)] = next;
		next.parent = parent;
		this.parent = null;
	}
	// false: not drawn, as in a folded group.
	rendered = true;
	checkVisibility(): boolean {
		return this.rendered && (this.parent?.checkVisibility() ?? true);
	}
	get isConnected(): boolean {
		return this.root || (this.parent?.isConnected ?? false);
	}
	get textContent(): string {
		return [this.text, ...this.children.map((child) => child.textContent)].filter(Boolean).join(" ");
	}
	set textContent(text: string) {
		this.replaceChildren();
		this.text = text;
	}
	find(className: string): Node | undefined {
		if (this.className.split(" ").includes(className)) return this;
		for (const child of this.children) {
			const found = child.find(className);
			if (found) return found;
		}
		return undefined;
	}
}

// A reading the test answers when it wants: a slow one comes back after a quicker one.
type Pending = { path: string; query: { [key: string]: string } | undefined; answer: (value: Json) => void; fail: (error: Error) => void };

const oneDay = (calls: number, estimated = false): Json => ({
	days: [{ day: "2026-11-21", calls, tokens: calls * 1000, usd: calls / 1000, estimated }],
	month: { usd: 0, monthlyUsd: 2 },
}) satisfies UsageReport as unknown as Json;

// The month's spending against its cap, as GET /usage gives it.
const spent = (usd: number, monthlyUsd: number | null): Json => ({
	days: [{ day: "2026-11-21", calls: 10, tokens: 10_000, usd: 0.01, estimated: false }],
	month: { usd, monthlyUsd },
});

// `number`: false for a Sonar older than ui.number.
function fakePage({ number = true } = {}) {
	const pending: Pending[] = [];
	const posted: Json[] = [];
	const listeners: ((data: Json) => void)[] = [];
	const stored = new Map<string, string>();
	const post = { refuse: false };
	const ui = {
		el: (tag: string, className = "", text = "") => new Node(tag, className, text),
		cloud: () => undefined,
		segmented: (options: { id: string }[], chosen: string, choose: (id: string) => void) => {
			const node = new Node("div", "ui-seg");
			node.data = { options, chosen, choose };
			return node;
		},
		toggle: (label: string, on: boolean, change: (on: boolean) => Promise<void>, options: { hint?: string; disabled?: boolean }) => {
			const node = new Node("div", "ui-toggle", label);
			node.data = { on, change, ...options };
			return node;
		},
		...(number
			? {
					number: (label: string, value: number | null, change: (value: number | null) => Promise<unknown>, options: object) => {
						const node = new Node("div", "ui-number", label);
						node.data = { value, change, ...options };
						return node;
					},
				}
			: {}),
		load: async (place: Node, read: () => Promise<unknown>, draw: (value: unknown) => Node | Node[]) => {
			place.replaceChildren(new Node("div", "dots"));
			try {
				const value = await read();
				place.replaceChildren(...[draw(value)].flat());
			} catch (error) {
				place.replaceChildren(new Node("div", "read-failure", (error as Error).message));
			}
		},
	};
	const api = {
		language: "en",
		ui,
		http: {
			get: (path: string, query?: { [key: string]: string }) => new Promise<Json>((answer, fail) => pending.push({ path, query, answer, fail })),
			post: async (path: string, body: Json) => {
				if (post.refuse) throw new Error("refused");
				posted.push({ path, body });
				// As the server answers: its settings after the change.
				const cap = (body as { monthlyUsd?: Json }).monthlyUsd;
				return { on: true, key: "…1234", monthlyUsd: cap === undefined ? 2 : cap };
			},
		},
		live: {
			on: (listen: (data: Json) => void) => {
				listeners.push(listen);
				return () => undefined;
			},
		},
		storage: { read: (key: string) => stored.get(key) ?? null, write: (key: string, value: string) => void stored.set(key, value) },
	} as unknown as PageApi;
	const kit = kitOf("en");
	const part: PartSlot = servicesPart(api, kit, settingsHub(api));
	const screen = new Node("div");
	screen.root = true;
	const shown = part.mount(screen as unknown as HTMLElement, {}) ?? {};
	const jevPart = () => screen.children[0] as Node;
	const tell = (data: Json) => {
		for (const listen of listeners) listen(data);
	};
	return { pending, posted, stored, post, screen, shown, jevPart, tell };
}

// The readings settle on the microtasks' turns: waits on a state, never on a time.
async function until(state: () => boolean): Promise<void> {
	for (let turn = 0; turn < 200 && !state(); turn++) await new Promise((done) => setImmediate(done));
	expect(state()).toBe(true);
}

// The part's timers, run by the test: a step of its reading again is the test's to take.
let timers: Map<number, () => void>;
const real = { setTimeout: globalThis.setTimeout, clearTimeout: globalThis.clearTimeout };
beforeEach(() => {
	timers = new Map();
	let next = 0;
	globalThis.setTimeout = ((run: () => void) => {
		timers.set(++next, run);
		return next;
	}) as unknown as typeof setTimeout;
	globalThis.clearTimeout = ((id: number) => void timers.delete(id)) as typeof clearTimeout;
});
afterEach(() => Object.assign(globalThis, real));

// The page's document: shown or hidden (another tab, the phone's screen off), and who listens to its change.
const visibility = { state: "visible", listeners: new Set<() => void>() };
beforeEach(() => {
	visibility.state = "visible";
	visibility.listeners.clear();
	Object.assign(globalThis, {
		document: {
			get visibilityState() {
				return visibility.state;
			},
			addEventListener: (type: string, listen: () => void) => type === "visibilitychange" && visibility.listeners.add(listen),
			removeEventListener: (type: string, listen: () => void) => type === "visibilitychange" && visibility.listeners.delete(listen),
		},
	});
});
afterEach(() => void Reflect.deleteProperty(globalThis, "document"));
const showPage = (state: "visible" | "hidden") => {
	visibility.state = state;
	for (const listen of [...visibility.listeners]) listen();
};
const tick = () => {
	const due = [...timers.entries()];
	timers.clear();
	for (const [, run] of due) run();
};

const answer = (page: ReturnType<typeof fakePage>, path: string, value: Json) => {
	const at = page.pending.findIndex((each) => each.path === path);
	const [reading] = page.pending.splice(at, 1);
	reading?.answer(value);
};
const keyed: Json = { on: true, key: "…1234", monthlyUsd: 2 };

async function entered(settings: Json = keyed, usage: Json = oneDay(10), sonar = { number: true }) {
	const page = fakePage(sonar);
	page.shown.enter?.();
	answer(page, "/settings", settings);
	answer(page, "/usage", usage);
	await until(() => page.jevPart().find("u-tile") !== undefined);
	return page;
}
const switchOf = (page: ReturnType<typeof fakePage>) => page.jevPart().find("ui-toggle") as Node;
const hintOf = (page: ReturnType<typeof fakePage>) => page.jevPart().find("u-hint")?.text;

test("without a key, the part is greyed and the switch held off, its tip saying why", async () => {
	const page = await entered({ on: true, key: null, monthlyUsd: 2 });
	expect(page.jevPart().className).toContain("no-key");
	expect(switchOf(page).data).toMatchObject({ on: false, disabled: true, hint: "Jev needs a TypeSafe key" });
});

test("the switch saves at once; refused, it rejects, so that Sonar's switch goes back and says its words", async () => {
	const page = await entered();
	expect(switchOf(page).data["on"]).toBe(true);
	const change = switchOf(page).data["change"] as (on: boolean) => Promise<void>;
	await change(false);
	expect(page.posted).toEqual([{ path: "/settings", body: { on: false } }]);
	page.post.refuse = true;
	expect(change(true)).rejects.toThrow("");
});

test("the period chosen reads its days, and stays chosen in this browser", async () => {
	const page = await entered();
	expect(page.pending).toEqual([]);
	const seg = page.jevPart().find("ui-seg") as Node;
	expect(seg.data["chosen"]).toBe("7");
	(seg.data["choose"] as (id: string) => void)("30");
	expect(page.pending.map(({ query }) => query)).toEqual([{ days: "30" }]);
	answer(page, "/usage", oneDay(300));
	await until(() => hintOf(page) === "300 calls · 300K tokens");
	expect(page.stored.get("period")).toBe("30");
});

test("a day partly estimated says so under the cost", async () => {
	const page = await entered(keyed, oneDay(10, true));
	expect(hintOf(page)).toBe("10 calls · 10K tokens · partly estimated");
});

test("7, 30, then 7 days quickly: the slow reading of 30 days, back last, does not draw under 7 days", async () => {
	const page = await entered();
	const choose = (page.jevPart().find("ui-seg") as Node).data["choose"] as (id: string) => void;
	choose("30");
	choose("7");
	const [thirty, seven] = page.pending.splice(0, 2);
	seven?.answer(oneDay(7));
	await until(() => hintOf(page) === "7 calls · 7K tokens");
	thirty?.answer(oneDay(30));
	for (let turn = 0; turn < 20; turn++) await new Promise((done) => setImmediate(done));
	expect(hintOf(page)).toBe("7 calls · 7K tokens");
});

test("the key given during the first reading: the late answer without it does not grey the switch", async () => {
	const page = fakePage();
	page.shown.enter?.();
	const [firstSettings, firstUsage] = page.pending.splice(0, 2);
	// Sonar draws the part again once the key is saved.
	page.shown.leave?.();
	page.shown.enter?.();
	answer(page, "/settings", keyed);
	answer(page, "/usage", oneDay(10));
	await until(() => switchOf(page)?.data["on"] === true);
	firstSettings?.answer({ on: true, key: null, monthlyUsd: 2 });
	firstUsage?.answer(oneDay(10));
	for (let turn = 0; turn < 20; turn++) await new Promise((done) => setImmediate(done));
	expect(page.jevPart().className).not.toContain("no-key");
	expect(switchOf(page).data["on"]).toBe(true);
});

test("while it shows, the usage is read again and the cost changes in place, without the dots of a first reading", async () => {
	const page = await entered();
	tick();
	expect(page.pending.map(({ path }) => path)).toEqual(["/usage"]);
	expect(page.jevPart().find("dots")).toBeUndefined();
	answer(page, "/usage", oneDay(20));
	await until(() => hintOf(page) === "20 calls · 20K tokens");
	expect(timers.size).toBe(1);
});

test("a first reading slower than a step: the usage is still read again once it came", async () => {
	const page = fakePage();
	page.shown.enter?.();
	tick();
	for (let turn = 0; turn < 20; turn++) await new Promise((done) => setImmediate(done));
	answer(page, "/settings", keyed);
	answer(page, "/usage", oneDay(10));
	await until(() => hintOf(page) === "10 calls · 10K tokens");
	tick();
	await until(() => page.pending.some(({ path }) => path === "/usage"));
});

test("Jev off by itself, at its cap or out of credits: its usage is read again at once", async () => {
	const page = await entered();
	page.tell({ kind: "credits" });
	await until(() => page.pending.some(({ path }) => path === "/usage"));
});

test("once it left, or its extension cut, nothing reads again and no timer stays", async () => {
	const page = await entered();
	page.shown.leave?.();
	expect(timers.size).toBe(0);
	page.tell({ kind: "cap", usd: 2 });
	const cut = await entered();
	// Cut, Sonar takes its node out of the screen without a leave.
	cut.screen.replaceChildren();
	tick();
	for (let turn = 0; turn < 20; turn++) await new Promise((done) => setImmediate(done));
	expect(page.pending.filter(({ path }) => path === "/usage")).toEqual([]);
	expect(cut.pending).toEqual([]);
	expect(timers.size).toBe(0);
});

test("the page hidden, nothing reads again and no timer waits; shown again, the usage is read at once", async () => {
	const page = await entered();
	showPage("hidden");
	expect(timers.size).toBe(0);
	tick();
	expect(page.pending).toEqual([]);
	showPage("visible");
	expect(page.pending.map(({ path }) => path)).toEqual(["/usage"]);
	answer(page, "/usage", oneDay(20));
	await until(() => hintOf(page) === "20 calls · 20K tokens");
	expect(timers.size).toBe(1);
});

test("entered while the page is hidden, it waits for the page to show before reading again", async () => {
	visibility.state = "hidden";
	const page = await entered();
	expect(timers.size).toBe(0);
	showPage("visible");
	expect(page.pending.map(({ path }) => path)).toEqual(["/usage"]);
});

test("its group folded, a step reads nothing; unfolded, the next step reads", async () => {
	const page = await entered();
	page.jevPart().rendered = false;
	tick();
	for (let turn = 0; turn < 20; turn++) await new Promise((done) => setImmediate(done));
	expect(page.pending).toEqual([]);
	expect(timers.size).toBe(1);
	page.jevPart().rendered = true;
	tick();
	expect(page.pending.map(({ path }) => path)).toEqual(["/usage"]);
});

test("once it left, it no longer listens to the page shown or hidden", async () => {
	const page = await entered();
	page.shown.leave?.();
	expect(visibility.listeners.size).toBe(0);
	page.shown.enter?.();
	expect(visibility.listeners.size).toBe(1);
});

// Jev's monthly cap, under its switch: Sonar's number field (ui.number), then the month's gauge.
const capped: Json = { on: true, key: "…1234", monthlyUsd: 3 };
const REACHED = "Cap reached: raise it to turn Jev on again.";
const capRow = (page: ReturnType<typeof fakePage>) => page.jevPart().find("ui-number");
const changeOf = (page: ReturnType<typeof fakePage>) => capRow(page)?.data["change"] as (value: number | null) => Promise<unknown>;
// What the gauge shows: its figure, and its bar as a screen reader and the sheet read it (none without a cap).
function gaugeOf(page: ReturnType<typeof fakePage>) {
	const gauge = page.jevPart().find("jev-month");
	const meter = gauge?.find("jev-meter");
	return {
		figure: gauge?.find("jev-month-figure")?.textContent,
		meter: meter && {
			className: meter.className,
			used: meter.find("jev-meter-fill")?.style.values["--used"],
			aria: [meter.attributes["role"], meter.attributes["aria-valuenow"], meter.attributes["aria-valuemax"], meter.attributes["aria-valuetext"]],
		},
	};
}

test("the cap's field: Sonar's number field under the switch, with the cap saved and its words", async () => {
	const page = await entered(capped, spent(1.52, 3));
	expect(page.jevPart().children.map((child) => child.className)).toEqual(["ui-toggle", "ui-number", "jev-month", "jev-usage"]);
	expect(capRow(page)?.text).toBe("Monthly cap");
	expect(capRow(page)?.data).toMatchObject({
		value: 3,
		min: 0,
		step: 0.5,
		placeholder: "none",
		hint: "In dollars. Jev turns off when the month reaches it. Empty: no cap.",
		disabled: false,
	});
	expect(capRow(page)?.data["alert"]).toBeUndefined();
});

test("the gauge at 0 %, 80 %, 100 % and past its cap: its tone, its fill, what a screen reader says, and the alert at the cap", async () => {
	const cases = [
		[0, "jev-meter", "0", "0", "$0.000 of $3", undefined],
		[2.4, "jev-meter near", "0.8", "2.4", "$2.40 of $3", undefined],
		[3, "jev-meter full", "1", "3", "$3.00 of $3", REACHED],
		[3.6, "jev-meter full", "1", "3", "$3.60 of $3", REACHED],
	] as const;
	for (const [usd, className, used, now, figure, alert] of cases) {
		// oxlint-disable-next-line no-await-in-loop
		const page = await entered(capped, spent(usd, 3));
		expect(gaugeOf(page)).toEqual({ figure, meter: { className, used, aria: ["meter", now, "3", figure] } });
		expect(capRow(page)?.data["alert"]).toBe(alert);
	}
});

test("without a cap: no bar, the month's spending alone, the field empty", async () => {
	const page = await entered({ ...(capped as object), monthlyUsd: null }, spent(1.52, null));
	expect(gaugeOf(page)).toEqual({ figure: "$1.52, no cap", meter: undefined });
	expect(capRow(page)?.data).toMatchObject({ value: null });
	expect(capRow(page)?.data["alert"]).toBeUndefined();
});

test("a cap saved is posted, and the gauge follows it at once, without a new page; empty is no cap", async () => {
	const page = await entered(capped, spent(2.4, 3));
	const row = capRow(page);
	await changeOf(page)(5);
	expect(page.posted.at(-1)).toEqual({ path: "/settings", body: { monthlyUsd: 5 } });
	expect(gaugeOf(page)).toEqual({ figure: "$2.40 of $5", meter: { className: "jev-meter", used: "0.48", aria: ["meter", "2.4", "5", "$2.40 of $5"] } });
	// The field stays as written, its "Saved" said by Sonar.
	expect(capRow(page)).toBe(row);
	await changeOf(page)(null);
	expect(page.posted.at(-1)).toEqual({ path: "/settings", body: { monthlyUsd: null } });
	expect(gaugeOf(page)).toEqual({ figure: "$2.40, no cap", meter: undefined });
});

test("a cap refused rejects with an empty Error, so that Sonar says its own words; the gauge keeps its cap", async () => {
	const page = await entered(capped, spent(1.52, 3));
	page.post.refuse = true;
	const refused = await changeOf(page)(1).catch((error: unknown) => error);
	expect(refused).toBeInstanceOf(Error);
	expect((refused as Error).message).toBe("");
	expect(gaugeOf(page).figure).toBe("$1.52 of $3");
});

test("while it shows, the gauge follows the month's spending read again, and the field says the cap reached", async () => {
	const page = await entered(capped, spent(1.52, 3));
	tick();
	answer(page, "/usage", spent(3.02, 3));
	await until(() => gaugeOf(page).figure === "$3.02 of $3");
	expect(gaugeOf(page).meter?.className).toBe("jev-meter full");
	expect(capRow(page)?.data["alert"]).toBe(REACHED);
});

test("on a Sonar without ui.number: no field, the gauge alone", async () => {
	const page = await entered(capped, spent(1.52, 3), { number: false });
	expect(page.jevPart().children.map((child) => child.className)).toEqual(["ui-toggle", "jev-month", "jev-usage"]);
	expect(gaugeOf(page).figure).toBe("$1.52 of $3");
});

test("without a key, the field is held, as the switch", async () => {
	const page = await entered({ on: true, key: null, monthlyUsd: 3 }, spent(0, 3));
	expect(capRow(page)?.data["disabled"]).toBe(true);
});
