// The town's people change while it is open (../people/live.ts): its names and its subjects' signs say them as they are now.
import type { World } from "../render/kit";
import type { namePlaces } from "./name-places";
import type { nameOf } from "./sign-nodes";
import type { Mark } from "./sign-place";
import type { signSizes } from "./sign-sizes";

// What the signs keep from a frame to the next (./signs.ts), as far as their texts go.
type Said = {
	marks: Mark[];
	sorted: Mark[];
	names: ReturnType<typeof nameOf>[];
	placeNames: ReturnType<typeof namePlaces>;
	sizesAt: ReturnType<typeof signSizes>;
};

// Returns what each frame calls first: the labels are written again when the town's people changed since the last one.
export function resaid(layer: HTMLElement, world: World, sg: Said): () => void {
	let said = world.revision();
	// How many agents the town shows, how many of those at work hold a crate, a book, a hammer and a console
	// (../people/tools.ts), and how many agents wait in each large bubble (../people/heaps.ts), read by the tests.
	const counted = (): void => {
		const agents = world.anchors.flatMap(({ topic }) => topic.agents);
		const held = [0, 0, 0, 0];
		for (const agent of agents) if (agent.state === 1) held[agent.act ?? 0]!++;
		const heaps = world.heaps.filter((heap) => heap.on).map((heap) => heap.count);
		Object.assign(layer.dataset, { agents: String(agents.length), held: held.join(" "), heaps: heaps.join(" ") });
	};
	counted();
	return () => {
		if (world.revision() === said) return;
		said = world.revision();
		// How many times they changed, read by the tests.
		layer.dataset["changed"] = String(said);
		counted();
		for (const [at, name] of sg.names.entries()) if (name.again()) sg.sizesAt.renamed(at);
		sg.placeNames.sort();
		if (!sg.marks.filter((mark) => mark.again()).length) return;
		sg.sorted = sg.marks.toSorted((a, b) => b.priority - a.priority);
		sg.sizesAt.resigned();
	};
}
