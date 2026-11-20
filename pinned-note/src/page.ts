// The page entry: Sonar's page calls start(api) once per page load, with the extension switched on.
// One screen in Settings and one action of the command bar. Its parts are Sonar's own (api.ui and the classes of
// Sonar's design system), so that the screen looks like the rest, in both themes and at every width.

import type { PageApi } from "@sonar/extension";

// The extension brings its own texts, in the page's language.
const TEXTS = {
	en: {
		title: "Pinned note",
		hint: "Every agent can read this note with the tool pinned-note_read. Write what each one should know before it works.",
		label: "Note",
		placeholder: "How you work, what to avoid, who to ask…",
		save: "Save",
		saved: "Saved.",
		open: "Open the pinned note",
		openHint: "What every agent can read",
	},
	fr: {
		title: "Note épinglée",
		hint: "Chaque agent lit cette note par l'outil pinned-note_read. Écris ce que chacun doit savoir avant de travailler.",
		label: "Note",
		placeholder: "Ta façon de travailler, ce qu'il faut éviter, à qui demander…",
		save: "Enregistrer",
		saved: "Enregistrée.",
		open: "Ouvrir la note épinglée",
		openHint: "Ce que chaque agent peut lire",
	},
};
type Texts = (typeof TEXTS)["en"];
type Note = { text: string; savedAt: number | null };

export function start(api: PageApi) {
	const texts = TEXTS[api.language];
	api.slots.settingsScreen({
		title: texts.title,
		icon: "pin",
		mount: (node) => {
			const place = api.ui.el("div", "pinned-note");
			node.append(api.ui.el("p", "panel-hint", texts.hint), place);
			// Read each time the screen shows: dots while it waits, its failure with "Retry".
			return { enter: () => void api.ui.load(place, () => api.http.get("/note") as Promise<Note>, (note) => editor(api, texts, note)) };
		},
	});
	api.slots.command({ title: texts.open, icon: "pin", hint: texts.openHint, run: () => api.open({ title: texts.title }) });
}

function editor(api: PageApi, texts: Texts, note: Note): HTMLElement {
	const form = api.ui.el("form", "ui-fields");
	const field = api.ui.el("label", "ui-field", texts.label);
	const text = api.ui.el("textarea") as HTMLTextAreaElement;
	Object.assign(text, { name: "note", rows: 8, maxLength: 20_000, value: note.text, placeholder: texts.placeholder });
	field.append(text);
	const save = api.ui.el("button", "pill primary", texts.save) as HTMLButtonElement;
	save.type = "submit";
	const said = api.ui.el("p", "panel-hint");
	said.setAttribute("role", "status");
	const actions = api.ui.el("div", "pinned-note-actions");
	actions.append(save, said);
	form.append(field, actions);
	form.addEventListener("submit", (event) => {
		event.preventDefault();
		save.disabled = true;
		said.textContent = "";
		// Each action succeeds or says why.
		api.http.post("/note", { text: text.value }).then(
			() => (said.textContent = texts.saved),
			(error: Error) => (said.textContent = error.message),
		).finally(() => (save.disabled = false));
	});
	return form;
}
