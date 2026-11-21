// The page entry (src/page.ts) on a page of its own, without Sonar: it takes the places Sonar names (isPartPlace), its
// toasts are ones Sonar shows (toastRefusal, toastPace), and its note of the Agents tab comes and goes as Sonar's plugin's
// (its jev/note.ts): shown while TypeSafe has no key, gone once the key is given, never back once its × hid it.

import { beforeEach, expect, test } from "bun:test";
import { isPartPlace, type Json, type PageApi, type PartSlot, toastPace, toastRefusal } from "@sonar/extension";
import { start } from "../src/page";

type Note = { hidden: boolean; text: string; action?: { label: string; run: () => void }; close?: () => void };

// A page as Sonar's gives it to the entry, with what the test reads back: the parts placed, the toasts shown, the
// screens opened, the routes read, the browser's storage.
function fakePage(language: "en" | "fr") {
	const parts: PartSlot[] = [];
	const toasts: { text: string; tone: string | undefined }[] = [];
	const opened: unknown[] = [];
	const reads: string[] = [];
	const listeners: ((data: Json) => void)[] = [];
	const stored = new Map<string, string>();
	const settings = { value: { on: true, key: null as string | null, monthlyUsd: 2 } as Json };
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
			note: (text: string, options: Omit<Note, "hidden" | "text"> = {}) => ({ hidden: false, text, ...options }),
		},
		http: {
			get: async (path: string) => {
				reads.push(path);
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
	return { api, parts, toasts, opened, reads, stored, settings, tell };
}

// The note the part of the Agents tab draws, entered as Sonar enters it once.
async function agentsNote(page: ReturnType<typeof fakePage>): Promise<{ note: Note; enter: () => Promise<void> }> {
	const kids: unknown[] = [];
	const part = page.parts.find((each) => each.screen === "agents");
	const shown = part?.mount({ append: (...nodes: unknown[]) => kids.push(...nodes) } as unknown as HTMLElement, {});
	const enter = async () => {
		shown?.enter?.();
		await Bun.sleep(0);
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

test("Jev off by itself: the plugin's words as an error toast, and its switch read again", async () => {
	page.tell({ kind: "cap", usd: 2 });
	page.tell({ kind: "credits" });
	page.tell({ kind: "other" });
	await Bun.sleep(0);
	expect(page.toasts).toEqual([
		{ text: "Jev is off: it cost $2 this month, its cap. Setting jevMonthlyUsd.", tone: "error" },
		{ text: "Jev is off: TypeSafe has no credits left. Turn it on again after the top-up.", tone: "error" },
	]);
	expect(page.reads.filter((path) => path === "/settings").length).toBe(2);
});

test("in French, the French words", () => {
	const french = fakePage("fr");
	start(french.api);
	french.tell({ kind: "credits" });
	expect(french.toasts).toEqual([{ text: "Jev est coupé : TypeSafe n'a plus de crédits. Rallume-le après la recharge.", tone: "error" }]);
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
	await Bun.sleep(0);
	expect(note.hidden).toBe(true);
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

test("a reading that fails leaves the note hidden, without a word", async () => {
	const failing = fakePage("en");
	(failing.api.http as unknown as { get: () => Promise<Json> }).get = () => Promise.reject(new Error("down"));
	start(failing.api);
	const { note } = await agentsNote(failing);
	expect(note.hidden).toBe(true);
	expect(failing.toasts).toEqual([]);
});
