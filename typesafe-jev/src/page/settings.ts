// Jev's settings as GET /settings gives them (../server.ts), read by both parts of the page: the switch of Services and
// the note of the Agents tab. Each reading is told to both, so that a key given in Services hides the note, and Jev off
// by itself moves the switch, without a new page.

import type { Json, PageApi } from "@sonar/extension";

export type JevView = { readonly on: boolean; readonly key: string | null };
export type SettingsHub = ReturnType<typeof settingsHub>;

const viewOf = (answer: Json): JevView => {
	const fields = typeof answer === "object" && answer !== null && !Array.isArray(answer) ? (answer as { readonly [key: string]: Json }) : {};
	const key = fields["key"];
	return { on: fields["on"] !== false, key: typeof key === "string" && key ? key : null };
};

export function settingsHub(api: PageApi) {
	const heard = new Set<(jev: JevView) => void>();
	return {
		// Rejects with the reason when the reading fails.
		read: async (): Promise<JevView> => {
			const jev = viewOf(await api.http.get("/settings"));
			for (const listen of heard) listen(jev);
			return jev;
		},
		hear: (listen: (jev: JevView) => void) => void heard.add(listen),
	};
}
