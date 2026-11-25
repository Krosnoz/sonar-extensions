// The styles Sonar kept before the town left it for this extension: each project's settings file holds them under
// `world`, until the extension takes them (ServerApi's `projects.left` and `projects.forget`). Taken at each start:
// - a style the user chose in the extension stays, whatever the former settings say;
// - else the former value takes its place, a style the extension only drew included;
// - a former value without a style chosen nor drawn changes nothing;
// - a former value that is no world is set aside in styles.json (./style-store.ts), never lost.
// The field leaves the projects' files once styles.json is written, never before. Taken again, the same values give
// the same styles. A Sonar that still knows the field gives none; an older one has no `left`: nothing to take.

import type { ServerApi } from "@sonar/extension";
import { type Kept, keyOf } from "./style-store";
import { type World, worldOf } from "./world";

export const FIELD = "world";

type Left = readonly { readonly project: string; readonly value: unknown }[];

// The styles once the former values are taken.
export function takenIn(kept: Kept, left: Left): Kept {
	const projects: Record<string, World> = { ...kept.projects };
	const setAside: Record<string, unknown> = { ...kept.setAside };
	for (const { project: name, value } of left) {
		const project = keyOf(name);
		const former = worldOf(value);
		if (!former) setAside[project] = value;
		else if (!projects[project]?.style && (former.style || former.drawn)) projects[project] = former;
	}
	return { projects, setAside };
}

// `save` writes styles.json and keeps what it wrote; it rejects when it could not write.
export async function takeLeft(api: ServerApi, kept: Kept, save: (next: Kept) => Promise<void>): Promise<void> {
	const { left, forget } = api.projects;
	if (!left) return;
	const found = await left(FIELD);
	if (!found.length) return;
	await save(takenIn(kept, found));
	await forget?.(FIELD);
	api.log(`The towns' styles of ${found.length} project(s) taken from Sonar's settings.`);
}
