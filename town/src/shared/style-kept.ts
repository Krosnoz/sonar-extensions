// By project: the style of its town the server part keeps, as ../page/style/town-style.ts read it before the town is built, or as
// the block "Town" saved it. Apart from both: the page's entry reads the style, the town's own code (loaded on demand)
// draws it.

import type { WorldStyle } from "./styles";

const kept = new Map<string, WorldStyle>();
export const keepStyle = (project: string, style: WorldStyle): void => void kept.set(project, style);
export const styleKept = (project: string): WorldStyle | undefined => kept.get(project);
