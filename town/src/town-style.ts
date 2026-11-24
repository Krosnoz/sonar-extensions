// The style of a project's town, as the extension's server part keeps it (./server.ts): the user's choice, else the
// draw. A town opened for the first time asks the server for that draw, which keeps it. Read once per project and kept
// (./style-kept.ts).

import { sonar } from "./sonar";
import { keepStyle, styleKept } from "./style-kept";
import type { WorldStyle } from "./styles";
import { shownOf, type World, worldOf } from "./world";

const shown = (answer: unknown): WorldStyle | null => shownOf(worldOf(answer) ?? undefined);

// The draw, asked without a word: a server that cannot be reached or refuses gives none, and the next opening asks again.
const drawn = (project: string): Promise<WorldStyle | null> =>
	sonar()
		.http.post("/style", { project, style: "automatic" })
		.then(shown, () => null);

// The world the server keeps for the project; null when it cannot be read.
export const worldRead = (project: string): Promise<World | null> =>
	sonar()
		.http.get("/style", { project })
		.then(worldOf, () => null);

// None when the server cannot be read: the town then takes a style from the project's name (./styles.ts#styleFor).
export async function townStyle(project: string): Promise<WorldStyle | undefined> {
	const found = styleKept(project);
	if (found) return found;
	const world = await worldRead(project);
	if (!world) return undefined;
	const style = shownOf(world) ?? (await drawn(project));
	if (style) keepStyle(project, style);
	return style ?? undefined;
}
