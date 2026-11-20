// The reading of an extension's card (extension.json), in plain TypeScript: the core reads it before it runs any of
// the extension's code, and a tool of an extension's author may read it the same way. A card is taken whole or refused
// with its reason, as data: the core says the reason in the user's language.

import { CONTRACT, type Manifest, type ManifestKey, type ReadFamily } from "./contract";
import { isReadFamily } from "./rules";

// The ids an extension never takes: the core's words (its routes and files live under /api/ext/<id> and /ext/<id>),
// then the ids of the plugins Sonar ships. Written here, so that this package depends on nothing: a test of Sonar's
// keeps every id of PLUGIN_IDS (@sonar/domain) in it (tests/extension-manifest.test.ts).
export const RESERVED_IDS: readonly string[] = [
	"core",
	"sonar",
	"ext",
	"api",
	"jev",
	"voice",
	"accounts",
	"cloud",
	"merge-queue",
	"machine",
	"sleep",
	"stats",
	"github",
	"linear",
	"world",
];

export type Refusal =
	| { readonly kind: "not-object" }
	// A field missing, or not of its type.
	| { readonly kind: "field"; readonly field: string }
	| { readonly kind: "id"; readonly id: string }
	| { readonly kind: "reserved"; readonly id: string }
	| { readonly kind: "contract"; readonly contract: number; readonly served: number }
	// A file's path that is not relative to the extension's root, or that leaves it.
	| { readonly kind: "path"; readonly field: string; readonly path: string }
	// An icon that is not an image the page masks (ICON).
	| { readonly kind: "icon"; readonly path: string }
	// A read that is not a family of what Sonar measures (READ_FAMILIES of ./rules.ts).
	| { readonly kind: "read"; readonly read: string };

export type ManifestReading = { readonly manifest: Manifest } | { readonly refusal: Refusal };

const ID = /^[a-z][a-z0-9-]{1,39}$/;
const FILES = ["icon", "server", "page", "styles"] as const;
// The icon is served whenever the card is read, the extension off: an image only, never a page that would run.
const ICON = /\.(svg|png|webp)$/i;

type Fields = { readonly [key: string]: unknown };
const isFields = (value: unknown): value is Fields => typeof value === "object" && value !== null && !Array.isArray(value);
const isText = (value: unknown): value is string => typeof value === "string" && value.trim() !== "";
const isTexts = (value: unknown): value is readonly string[] => Array.isArray(value) && value.every(isText);
const isKey = (value: unknown): value is ManifestKey =>
	isFields(value) &&
	isText(value["name"]) &&
	(value["scope"] === "user" || value["scope"] === "project") &&
	(value["label"] === undefined || typeof value["label"] === "string");
// Forward slashes only, each part a name: no root, no drive, no "." nor "..", so that the path is the address the page
// asks.
const isRelative = (path: string) =>
	!path.includes("\\") && !path.includes(":") && path.split("/").every((part) => part !== "" && part !== "." && part !== "..");

const isKeys = (value: unknown): value is readonly ManifestKey[] => Array.isArray(value) && value.every(isKey);
const isReads = (value: unknown): value is readonly ReadFamily[] => Array.isArray(value) && value.every(isReadFamily);
const orAbsent = (check: (value: unknown) => boolean) => (value: unknown) => value === undefined || check(value);
// The fields beside the id and the contract, each with its check: the first that fails is named.
const CHECKS: readonly (readonly [string, (value: unknown) => boolean])[] = [
	["name", isText],
	["version", isText],
	["description", orAbsent((value) => typeof value === "string")],
	["keys", orAbsent(isKeys)],
	["calls", orAbsent(isTexts)],
	["paid", orAbsent((value) => typeof value === "boolean")],
	["reads", orAbsent(isTexts)],
	...FILES.map((field) => [field, orAbsent(isText)] as const),
];

export function readManifest(value: unknown): ManifestReading {
	if (!isFields(value)) return { refusal: { kind: "not-object" } };
	const { id, contract } = value;
	if (typeof id !== "string") return { refusal: { kind: "field", field: "id" } };
	if (!ID.test(id)) return { refusal: { kind: "id", id } };
	if (RESERVED_IDS.includes(id)) return { refusal: { kind: "reserved", id } };
	if (typeof contract !== "number") return { refusal: { kind: "field", field: "contract" } };
	if (contract !== CONTRACT) return { refusal: { kind: "contract", contract, served: CONTRACT } };
	const wrong = CHECKS.find(([field, valid]) => !valid(value[field]));
	if (wrong) return { refusal: { kind: "field", field: wrong[0] } };
	for (const field of FILES) {
		const path = value[field];
		if (typeof path === "string" && !isRelative(path)) return { refusal: { kind: "path", field, path } };
	}
	const { icon, reads } = value;
	if (typeof icon === "string" && !ICON.test(icon)) return { refusal: { kind: "icon", path: icon } };
	const unknown = isTexts(reads) ? reads.find((read) => !isReadFamily(read)) : undefined;
	if (unknown !== undefined) return { refusal: { kind: "read", read: unknown } };
	return { manifest: taken(value, id, contract) };
}

// The card's fields once checked, those it does not know left out.
function taken(fields: Fields, id: string, contract: number): Manifest {
	const { name, version, description, icon, server, page, styles, keys, calls, paid, reads } = fields;
	return {
		id,
		name: String(name),
		version: String(version),
		contract,
		...(typeof description === "string" ? { description } : {}),
		...(typeof icon === "string" ? { icon } : {}),
		...(typeof server === "string" ? { server } : {}),
		...(typeof page === "string" ? { page } : {}),
		...(typeof styles === "string" ? { styles } : {}),
		...(isKeys(keys) ? { keys } : {}),
		...(isTexts(calls) ? { calls } : {}),
		...(typeof paid === "boolean" ? { paid } : {}),
		...(isReads(reads) ? { reads } : {}),
	};
}
