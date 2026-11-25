// How the page looks, as the town reads it (PageLook of @sonar/extension): its theme and whether movement goes, by the
// user's choice in Sonar or their device's. Given by the entry (../start.ts), read live at each call. Before it, in the
// tests that build the town without a page: light, and movement on.

import type { PageLook } from "@sonar/extension";

let look: Pick<PageLook, "dark" | "reducedMotion"> = { dark: () => false, reducedMotion: () => false };

export const lookAt = (given: Pick<PageLook, "dark" | "reducedMotion">): void => void (look = given);

export const reducedMotion = (): boolean => look.reducedMotion();
export const dark = (): boolean => look.dark();
