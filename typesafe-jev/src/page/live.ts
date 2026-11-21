// What the server says live when Jev switches itself off (../server.ts, ../judge.ts): `{ kind: "cap", usd }` at its
// monthly cap, `{ kind: "credits" }` when TypeSafe has none left. Said as Sonar's plugin says it; anything else, nothing.

import type { Json } from "@sonar/extension";
import type { Texts } from "./texts";

export function stopText(data: Json, texts: Texts): string | null {
	if (typeof data !== "object" || data === null || Array.isArray(data)) return null;
	const { kind, usd } = data as { readonly [key: string]: Json };
	if (kind === "credits") return texts.stopped.credits;
	return kind === "cap" && typeof usd === "number" && Number.isFinite(usd) ? texts.stopped.cap(usd) : null;
}
