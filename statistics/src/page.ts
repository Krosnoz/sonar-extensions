// The page entry: Sonar's page calls start(api) once per page load, with the extension switched on. It draws its blocks
// in the statistics' screens Sonar keeps, at the places they name: Sonar's (Settings › Statistics) at its top, in its
// accounts' block and at its bottom; a project's (its settings › Statistics) whole. Its parts are Sonar's own (api.ui and
// the classes of Sonar's design system), so that the blocks look as Sonar's, in both themes and at every width.

import type { PageApi } from "@sonar/extension";
import { globalStatsParts } from "./page/global-screen";
import { keep } from "./page/kit";
import { takeSonarMode } from "./page/mode";
import { projectStatsPart } from "./page/project-screen";

export function start(api: PageApi) {
	keep(api);
	takeSonarMode();
	for (const part of [...globalStatsParts(), projectStatsPart]) api.slots.part(part);
}
