// The block "Town" among the folded sections of a project's General screen (PartPlaces' "project-general"): on a
// machine that is offered the town only (../sonar/offered.ts), the others having no town to style. Read again each time the
// screen shows: the town's first opening may have drawn the style meanwhile. A Sonar without `ui.section` shows none.

import { el } from "../sonar/dom";
import { sonar } from "../sonar/sonar";
import { worldTexts } from "../sonar/texts";
import { worldRead } from "./town-style";
import { townStylePane } from "./town-style-pane";

export function placeStyleSection(offered: Promise<boolean>): void {
	const { slots, ui } = sonar();
	const section = ui.section;
	if (!section) return;
	slots.part({
		screen: "project-general",
		place: "sections",
		mount: (node, { project }) => {
			if (!project) return;
			const body = el("div");
			const part = section(worldTexts.style.title, body);
			part.node.dataset["block"] = "town-style";
			void offered.then((yes) => yes && node.append(part.node));
			const read = async () => {
				const world = await worldRead(project);
				if (world) return world;
				part.say("");
				throw new Error(worldTexts.style.noAnswer);
			};
			const draw = () => ui.load(body, read, (world) => townStylePane(project, world, part.say));
			const enter = async () => {
				if (await offered) await draw();
			};
			return { enter: () => void enter() };
		},
	});
}
