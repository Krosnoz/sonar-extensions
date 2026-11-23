// The page's numbers (src/page/format.ts) in French: thousands parted by a space that is seen, as Sonar's page writes
// them. The narrow space (U+202F) is drawn about a pixel wide at the page's small sizes: "7 122" read "7122".

import { expect, test } from "bun:test";
import { formatsOf } from "../src/page/format";
import { english } from "../src/page/texts";
import { french } from "../src/page/texts-fr";

test("in French, every number parts its thousands by a no-break space of the usual width", () => {
	const format = formatsOf("fr-FR", french);
	expect([
		format.whole.format(7122),
		format.one.format(1234.5),
		format.money.format(7122.5),
		format.percent.format(12.5),
		format.signedPercent.format(12.5),
		format.signedPoints.format(1500),
	]).toEqual(["7 122", "1 234,5", "7 122,50 $", "1 250 %", "+1 250 %", "+1 500"]);
});

test("in English, numbers stay as they were", () => {
	const format = formatsOf("en-US", english);
	expect([format.whole.format(7122), format.money.format(7122.5), format.percent.format(12.5)]).toEqual(["7,122", "$7,122.50", "1,250%"]);
});
