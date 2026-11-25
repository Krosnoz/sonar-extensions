// The town's entry, as an extension's page entry (PageEntry of @sonar/extension): Sonar starts it with the extension's
// API alone (./sonar/sonar.ts). It places the town on the Map (./sonar/toggle.ts) and the block "Town" of a project's General
// screen (./style/town-style-section.ts), both where the machine is offered the town.

import type { PageApi } from "@sonar/extension";
import { lookAt } from "./sonar/look";
import { offered } from "./sonar/offered";
import { hold } from "./sonar/sonar";
import { speak } from "./sonar/texts";
import { wireTown } from "./sonar/toggle";
import { placeStyleSection } from "./style/town-style-section";

export function start(api: PageApi): void {
	lookAt(hold(api).look);
	speak(api.language);
	const here = offered();
	wireTown(here);
	placeStyleSection(here);
}
