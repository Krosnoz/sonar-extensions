// The town's entry, as an extension's page entry (PageEntry of @sonar/extension): Sonar starts it with the extension's
// API alone (./sonar.ts). It places the town on the Map (./toggle.ts) and the block "Town" of a project's General
// screen (./town-style-section.ts), both where the machine is offered the town.

import type { PageApi } from "@sonar/extension";
import { lookAt } from "./look";
import { offered } from "./offered";
import { hold } from "./sonar";
import { speak } from "./texts";
import { wireTown } from "./toggle";
import { placeStyleSection } from "./town-style-section";

export function start(api: PageApi): void {
	lookAt(hold(api).look);
	speak(api.language);
	const here = offered();
	wireTown(here);
	placeStyleSection(here);
}
