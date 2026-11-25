// Jev's switch and its monthly cap, kept in the extension's settings (Sonar's settings file, under its id): on unless
// `on` is false, $2 a month unless `monthlyUsd` says otherwise, as Sonar's plugin; `monthlyUsd: null`, no cap.

import type { Json, ServerApi } from "@sonar/extension";

export type JevSettings = { readonly on: boolean; readonly monthlyUsd: number | null };

const MONTHLY_USD = 2;
const isCap = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value) && value >= 0;

// A value saved by hand may be anything: what cannot be read takes its default. null is no cap.
export function settingsOf(saved: Json): JevSettings {
	const fields = typeof saved === "object" && saved !== null && !Array.isArray(saved) ? (saved as { readonly [key: string]: Json }) : {};
	const monthlyUsd = fields["monthlyUsd"];
	return { on: fields["on"] !== false, monthlyUsd: monthlyUsd === null || isCap(monthlyUsd) ? monthlyUsd : MONTHLY_USD };
}

export const readSettings = async (api: ServerApi): Promise<JevSettings> => settingsOf(await api.settings.read());

// A change from the page: `on` a boolean, `monthlyUsd` a finite number from 0, or null for no cap; anything else
// refused with a 400.
export async function changeSettings(api: ServerApi, body: Json | undefined): Promise<JevSettings> {
	const change = typeof body === "object" && body !== null && !Array.isArray(body) ? (body as { readonly [key: string]: Json }) : null;
	const on = change?.["on"];
	const monthlyUsd = change?.["monthlyUsd"];
	if (!change || (on !== undefined && typeof on !== "boolean") || (monthlyUsd !== undefined && monthlyUsd !== null && !isCap(monthlyUsd)))
		throw Object.assign(new Error("Send { on?: boolean, monthlyUsd?: a number from 0, or null for no cap }."), { status: 400 });
	const next = { ...(await readSettings(api)), ...(on === undefined ? {} : { on }), ...(monthlyUsd === undefined ? {} : { monthlyUsd }) };
	await api.settings.write(next);
	return next;
}
