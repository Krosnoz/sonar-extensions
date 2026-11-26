// The keys of the testing kit (./testing.ts), as Sonar treats them: only those its card declares are read and tried, a
// project's read with its project.

import type { Manifest } from "./card";
import type { ServerApi } from "./contract";
import { checkedKeyTrial, type KeyTrialRun } from "./key-trial";

const keyOf = (name: string, project: string | undefined) => JSON.stringify([name, project ?? null]);

export function keysOf(manifest: Manifest) {
	const given = new Map<string, string>();
	const trials = new Map<string, KeyTrialRun>();
	const declared = (name: string) => {
		const key = manifest.keys?.find((each) => each.name === name);
		if (!key) throw new Error(`The key "${name}" is not declared by the extension's card.`);
		return key;
	};
	const api: ServerApi["keys"] = {
		read: async (name, project) => {
			const key = declared(name);
			if (key.scope === "project" && !project) throw new Error(`The key "${name}" is kept per project: name the project.`);
			return given.get(keyOf(name, key.scope === "project" ? project : undefined))?.trim() || null;
		},
		trial: (name, run) => {
			declared(name);
			if (typeof run !== "function") throw new Error(`The trial of the key "${name}" must be a function.`);
			trials.set(name, run);
		},
	};
	// The bench's own: the keys a test gives, and the trials it calls.
	const bench = {
		setKey: (name: string, value: string, project?: string) => void given.set(keyOf(name, project), value),
		keyTrial: (name: string): KeyTrialRun | null => {
			const run = trials.get(name);
			return run ? checkedKeyTrial(run) : null;
		},
	};
	return { api, bench };
}
