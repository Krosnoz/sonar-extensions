// By project: the style of its town its settings keep, as ./town-style.ts read it before the town is built. Apart from
// both: the page's first code reads the settings, the town's own code (loaded on demand) draws the style.

import type { WorldStyle } from "./styles";

const kept = new Map<string, WorldStyle>();
export const keepStyle = (project: string, style: WorldStyle): void => void kept.set(project, style);
export const styleKept = (project: string): WorldStyle | undefined => kept.get(project);
