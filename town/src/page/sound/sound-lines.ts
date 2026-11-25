// The town's sounds as Settings › Sounds shows them: a section of its own after the core's (PageApi's `sounds`), four
// lines, each a switch on this device. The sounds themselves are ./town-sound.ts, which loads with the town, or at the
// first example the settings play.

import { sonar } from "../sonar/sonar";
import { worldTexts as texts } from "../sonar/texts";

export type TownLine = "town-bricks" | "town-merges" | "town-pulls" | "town-people";
const TOWN_LINES: readonly TownLine[] = ["town-bricks", "town-merges", "town-pulls", "town-people"];

// Where the town is offered only (../sonar/offered.ts): elsewhere, the settings show no line of it.
export function offerSounds(): void {
	sonar().sounds.group(
		texts.soundsTitle,
		TOWN_LINES.map((id) => ({
			id,
			name: texts.sounds[id].name,
			hint: texts.sounds[id].hint,
			hear: () => void import("./town-ear").then(({ townEar }) => townEar().example(id)).catch(() => undefined),
		})),
	);
}
