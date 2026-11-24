// The style of a project's town, as the user chose it or as it was drawn for that project: the one place the town reads
// it. None yet: the town takes a style from the project's name (./styles.ts#styleFor). The extension's server part will
// keep each project's style and answer it here, kept once read (./style-kept.ts).

import type { WorldStyle } from "./styles";

export async function townStyle(_project: string): Promise<WorldStyle | undefined> {
	return undefined;
}
