// The page entry (src/page.ts) on a page of its own, without Sonar: it takes the places Sonar names (isPartPlace), its
// toasts are ones Sonar shows (toastRefusal, toastPace), and its note of the Agents tab comes and goes as Sonar's plugin's
// (its jev/note.ts): shown while TypeSafe has no key, gone once the key is given, never back once its × hid it.

import { afterEach, beforeEach, expect, test } from "bun:test";
import { isPartPlace, type Json, type PageApi, type PartSlot, toastPace, toastRefusal } from "@sonar/extension";
import { start } from "../src/page";

// `told`: how many times the page set `hidden`, a reading of the settings told to the note.
type Note = { hidden: boolean; told: number; text: string; action?: { label: string; run: () => void }; close?: () => void };

// The readings settle on the microtasks' turns: waits on a state, never on a time.
async function until(state: () => boolean): Promise<void> {
	for (let turn = 0; turn < 200 && !state(); turn++) await new Promise((done) => setImmediate(done));
	expect(state()).toBe(true);
}

const fakeNote = (text: string, options: Omit<Note, "hidden" | "told" | "text">): Note => {
	let hidden = false;
	const note = { told: 0, text, ...options } as Note;
	Object.defineProperty(note, "hidden", {
		get: () => hidden,
		set: (value: boolean) => {
			hidden = value;
			note.told++;
		},
	});
	return note;
};

// A page as Sonar's gives it to the entry, with what the test reads back: the parts placed, the toasts shown, the
// screens opened, the routes read, the browser's storage.
// `older`: a Sonar from before ui.say, which has only the toast.
function fakePage(language: "en" | "fr", older = false) {
	const parts: PartSlot[] = [];
	const toasts: { text: string; tone: string | undefined }[] = [];
	const said: string[] = [];
	const opened: unknown[] = [];
	const reads: string[] = [];
	const listeners: ((data: Json) => void)[] = [];
	const stored = new Map<string, string>();
	// `down`: every reading fails; `failed`: how many did.
	const settings = { value: { on: true, key: null as string | null, monthlyUsd: 2 } as Json, down: false, failed: 0 };
	const pace = toastPace();
	const refuse = () => {
		throw new Error("not in this test");
	};
	const api = {
		contract: 1,
		id: "typesafe-jev",
		language,
		slots: {
			part: (part: PartSlot) => {
				if (!isPartPlace(part.screen, part.place)) throw new Error(`no place ${part.screen}/${part.place}`);
				parts.push(part);
			},
			settingsScreen: refuse,
			projectScreen: refuse,
			command: refuse,
		},
		ui: {
			toast: (text: string, tone?: string) => {
				const refusal = toastRefusal(text, tone);
				if (refusal) throw new Error(refusal);
				if (pace(Date.now())) toasts.push({ text, tone });
			},
			// Sonar refuses what it says as it refuses an error toast.
			...(older
				? {}
				: {
						say: (text: string) => {
							const refusal = toastRefusal(text, "error");
							if (refusal) throw new Error(refusal);
							said.push(text);
						},
					}),
			note: (text: string, options: Omit<Note, "hidden" | "told" | "text"> = {}) => fakeNote(text, options),
		},
		http: {
			get: async (path: string) => {
				reads.push(path);
				if (settings.down) {
					settings.failed++;
					throw new Error("down");
				}
				return settings.value;
			},
			post: refuse,
		},
		live: {
			on: (listen: (data: Json) => void) => {
				listeners.push(listen);
				return () => undefined;
			},
		},
		storage: { read: (key: string) => stored.get(key) ?? null, write: (key: string, value: string) => void stored.set(key, value) },
		open: (screen: unknown) => void opened.push(screen),
	} as unknown as PageApi;
	const tell = (data: Json) => {
		for (const listen of listeners) listen(data);
	};
	return { api, parts, toasts, said, opened, reads, stored, settings, tell };
}

// The note the part of the Agents tab draws, entered as Sonar enters it once.
async function agentsNote(page: ReturnType<typeof fakePage>): Promise<{ note: Note; enter: () => Promise<void> }> {
	const kids: unknown[] = [];
	const part = page.parts.find((each) => each.screen === "agents");
	const shown = part?.mount({ append: (...nodes: unknown[]) => kids.push(...nodes) } as unknown as HTMLElement, {});
	const told = () => (kids[0] as Note).told + page.settings.failed;
	// Entered, it reads the settings: done once the reading is told to the note, or failed.
	const enter = async () => {
		const before = told();
		shown?.enter?.();
		await until(() => told() > before);
	};
	await enter();
	return { note: kids[0] as Note, enter };
}

let page: ReturnType<typeof fakePage>;
beforeEach(() => {
	page = fakePage("en");
	start(page.api);
});

test("it draws in Services, in its key's group, and in the Agents tab's notes: places Sonar names", () => {
	expect(page.parts.map(({ screen, place }) => `${screen}/${place}`)).toEqual(["services/section", "agents/notes"]);
});

test("Jev off by itself: Ping says the plugin's words (ui.say), no toast beside, and its switch is read again", async () => {
	page.tell({ kind: "cap", usd: 2 });
	page.tell({ kind: "credits" });
	page.tell({ kind: "other" });
	expect(page.said).toEqual([
		"is off: it cost $2 this month, its cap. Turn it on again in Services, or raise its cap.",
		"is off: TypeSafe has no credits left. Turn it on again after the top-up.",
	]);
	expect(page.toasts).toEqual([]);
	expect(page.reads.filter((path) => path === "/settings").length).toBe(2);
});

test("in French, the French words", () => {
	const french = fakePage("fr");
	start(french.api);
	french.tell({ kind: "credits" });
	expect(french.said).toEqual(["est coupé : TypeSafe n'a plus de crédits. Rallume-le après la recharge."]);
});

test("on a Sonar from before ui.say, the same words as an error toast", () => {
	const older = fakePage("en", true);
	start(older.api);
	older.tell({ kind: "credits" });
	expect(older.toasts).toEqual([{ text: "is off: TypeSafe has no credits left. Turn it on again after the top-up.", tone: "error" }]);
});

test("without a TypeSafe key, the note shows, and its action opens Services", async () => {
	const { note } = await agentsNote(page);
	expect(note.hidden).toBe(false);
	expect(note.text).toBe("Without a TypeSafe key, decisions come in their order of arrival. The map shows neither urgency nor “same topic” links.");
	expect(note.action?.label).toBe("Open Services");
	note.action?.run();
	expect(page.opened).toEqual([{ core: "services" }]);
});

test("the key given, the note goes; the key removed, it comes back", async () => {
	page.settings.value = { on: true, key: "…1234", monthlyUsd: 2 };
	const { note, enter } = await agentsNote(page);
	expect(note.hidden).toBe(true);
	page.settings.value = { on: true, key: null, monthlyUsd: 2 };
	await enter();
	expect(note.hidden).toBe(false);
});

test("the key saved in Services while the note shows: the note goes without a new page", async () => {
	const { note } = await agentsNote(page);
	page.settings.value = { on: false, key: "…1234", monthlyUsd: 2 };
	page.tell({ kind: "credits" });
	await until(() => note.hidden);
});

test("its × hides it on this browser for good", async () => {
	const { note, enter } = await agentsNote(page);
	note.close?.();
	expect(page.stored.size).toBe(1);
	const again = fakePage("en");
	for (const [key, value] of page.stored) again.api.storage.write(key, value);
	start(again.api);
	expect((await agentsNote(again)).note.hidden).toBe(true);
	await enter();
	expect(note.hidden).toBe(true);
});

// The browser's own storage, where Sonar's plugin kept its × under "sonar:typesafe-note".
const browserStorage = (kept: { [key: string]: string }) => {
	const written: string[] = [];
	const localStorage = { getItem: (key: string) => kept[key] ?? null, setItem: (key: string) => void written.push(key) };
	return { localStorage, written };
};
afterEach(() => void Reflect.deleteProperty(globalThis, "localStorage"));

test("hidden by the × of Sonar's plugin, the note stays hidden; that key is only read", async () => {
	const browser = browserStorage({ "sonar:typesafe-note": "1" });
	Object.assign(globalThis, { localStorage: browser.localStorage });
	const { note } = await agentsNote(page);
	expect(note.hidden).toBe(true);
	note.close?.();
	expect(browser.written).toEqual([]);
});

test("the browser refusing its storage, the note shows all the same", async () => {
	Object.assign(globalThis, {
		localStorage: {
			getItem: () => {
				throw new Error("refused");
			},
		},
	});
	expect((await agentsNote(page)).note.hidden).toBe(false);
});

test("a reading that fails leaves the note hidden, without a word", async () => {
	const failing = fakePage("en");
	failing.settings.down = true;
	start(failing.api);
	const { note } = await agentsNote(failing);
	expect(note.hidden).toBe(true);
	expect(failing.toasts).toEqual([]);
});
