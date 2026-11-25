// The towns' styles the server part keeps, in `<dataDir>/styles.json`:
//   { "projects": { "<project>": { "style": <style or null>, "drawn": <style or null> } },
//     "setAside": { "<project>": <a value Sonar's settings held that is no world> } }
// `setAside` keeps what the taking over of the former settings could not read (./style-left.ts): set apart, not lost.
// The file is written whole, to a file beside it then renamed over it: a reading never finds it half written.

import { readFile, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { Json } from "@sonar/extension";
import { type World, worldOf } from "./world";

export type Kept = { readonly projects: Readonly<Record<string, World>>; readonly setAside: Readonly<Record<string, unknown>> };

const EMPTY: Kept = { projects: {}, setAside: {} };

// A project's key in the styles: its name as Sonar wrote its settings file's, each character outside letters, digits,
// ".", "_" and "-" written "_". Sonar gives a project it does not list by that name (`projects.left`), and two names
// it kept in one file share one town style, as they did.
export const keyOf = (project: string): string => project.replace(/[^a-zA-Z0-9._-]/g, "_");

// What the file holds. None yet: nothing kept. A file that cannot be read is moved aside, and the styles start empty.
export async function readKept(dataDir: string, log: (message: string) => void): Promise<Kept> {
	const path = join(dataDir, "styles.json");
	const text = await readFile(path, "utf8").catch((error: NodeJS.ErrnoException) => {
		if (error.code === "ENOENT") return null;
		throw error;
	});
	if (text === null) return EMPTY;
	try {
		return keptOf(JSON.parse(text));
	} catch {
		const aside = join(dataDir, `styles.unreadable-${Date.now()}.json`);
		await rename(path, aside);
		log(`styles.json could not be read: moved to ${aside}, the towns' styles start empty.`);
		return EMPTY;
	}
}

// A project whose world cannot be read is set aside, as a former setting would be.
function keptOf(data: { projects?: Record<string, unknown>; setAside?: Record<string, unknown> }): Kept {
	const projects: Record<string, World> = {};
	const setAside: Record<string, unknown> = { ...data.setAside };
	for (const [name, value] of Object.entries(data.projects ?? {})) {
		const world = worldOf(value);
		if (world) projects[name] = world;
		else setAside[name] = value;
	}
	return { projects, setAside };
}

export async function writeKept(dataDir: string, kept: Kept): Promise<void> {
	const path = join(dataDir, "styles.json");
	const data: { [key: string]: Json } = { projects: kept.projects };
	if (Object.keys(kept.setAside).length) data["setAside"] = kept.setAside as Json;
	await writeFile(`${path}.next`, `${JSON.stringify(data, null, "\t")}\n`);
	await rename(`${path}.next`, path);
}
