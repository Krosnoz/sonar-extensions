// The server entry: Sonar calls start(api) when it starts, with the extension switched on.
// One route for the page (GET and POST /note) and one tool for the agents (pinned-note_read).

import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { Json, ServerApi } from "@sonar/extension";

export const NOTE_MOST = 20_000;

type Note = { text: string; savedAt: number | null };

export function start(api: ServerApi) {
	// dataDir is kept between the extension's versions.
	const file = join(api.dataDir, "note.json");
	const read = async (): Promise<Note> => {
		try {
			return JSON.parse(await readFile(file, "utf8")) as Note;
		} catch {
			return { text: "", savedAt: null };
		}
	};

	api.routes.get("/note", read);
	api.routes.post("/note", async ({ body }) => {
		const text = (body as { text?: Json } | null)?.text;
		// A status from 400 to 499 goes back to the page as it is.
		if (typeof text !== "string" || text.length > NOTE_MOST)
			throw Object.assign(new Error(`The note must be a text of ${NOTE_MOST} characters at most.`), { status: 400 });
		const note = { text, savedAt: Date.now() };
		await writeFile(file, JSON.stringify(note));
		return note;
	});

	api.tools.add({
		name: "read",
		description: "Read the note the user pinned for every agent: what they want each agent to know before it works.",
		readOnly: true,
		input: { type: "object", properties: {}, additionalProperties: false },
		run: async () => (await read()).text.trim() || "No note is pinned yet.",
	});
}
