// Jev's settings as GET /settings gives them (../server.ts), read by both parts of the page: the switch and the cap of
// Services, and the note of the Agents tab. Each reading is told to both, so that a key given in Services hides the note,
// Jev off by itself moves the switch, and a cap saved moves the month's gauge, without a new page.

import type { Json, PageApi } from "@sonar/extension";
import { newest } from "./newest";

// `monthlyUsd`: the monthly cap, null without one.
export type JevView = { readonly on: boolean; readonly key: string | null; readonly monthlyUsd: number | null };
export type SettingsHub = ReturnType<typeof settingsHub>;

const viewOf = (answer: Json): JevView => {
	const fields = typeof answer === "object" && answer !== null && !Array.isArray(answer) ? (answer as { readonly [key: string]: Json }) : {};
	const [key, cap] = [fields["key"], fields["monthlyUsd"]];
	return { on: fields["on"] !== false, key: typeof key === "string" && key ? key : null, monthlyUsd: typeof cap === "number" ? cap : null };
};

export function settingsHub(api: PageApi) {
	const heard = new Set<(jev: JevView) => void>();
	const readView = newest(async () => viewOf(await api.http.get("/settings")));
	const tell = (jev: JevView) => {
		for (const listen of heard) listen(jev);
		return jev;
	};
	return {
		// Rejects with the reason when the reading fails.
		read: async (): Promise<JevView> => tell(await readView()),
		// The settings a change answered (POST /settings answers as GET), told as a reading.
		told: (answer: Json): JevView => tell(viewOf(answer)),
		hear: (listen: (jev: JevView) => void) => void heard.add(listen),
	};
}
