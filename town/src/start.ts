// The town's entry, as an extension's page entry (PageEntry of @sonar/extension): the core starts it as it starts an
// extension's (./plugin.ts), and the town takes Sonar's parts from the API it is given alone (./sonar.ts).

import type { PageApi } from "@sonar/extension";
import { lookAt } from "./look";
import { hold } from "./sonar";
import { speak } from "./texts";
import { wireTown } from "./toggle";

export function start(api: PageApi): void {
	lookAt(hold(api).look);
	speak(api.language);
	wireTown();
}
