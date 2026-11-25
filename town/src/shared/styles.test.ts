// The style of a project's town (./styles.ts#styleFor): the one its settings keep once it is read (./style-kept.ts), one
// its name picks until then. The six styles are the six names a project's settings may hold.

import { expect, test } from "bun:test";
import type { WorldStyle } from "./styles";

// The names a project's settings in Sonar held (WORLD_STYLES of Sonar's domain), which the extension takes over: each
// one must stay a style the town draws.
const WORLD_STYLES: readonly WorldStyle[] = ["riverside", "brick", "sun", "neon", "fjord", "oasis"];

await import("../page/test-page");
const { STYLES, styleFor } = await import("./styles");
const { keepStyle } = await import("./style-kept");

test("each style a project's settings may hold is a style the town draws", () => {
	expect(STYLES.map((style) => style.name).toSorted()).toEqual([...WORLD_STYLES].toSorted());
});

test("a town takes the style its project's settings keep, and one from its name before it is read", () => {
	const named = styleFor("alpha").name;
	expect(styleFor("alpha").name).toBe(named);
	const other = WORLD_STYLES.find((style) => style !== named)!;
	keepStyle("alpha", other);
	expect(styleFor("alpha").name).toBe(other);
	expect(styleFor("beta").name).toBe(styleFor("beta").name);
});
