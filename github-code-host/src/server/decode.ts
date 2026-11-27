// The reading of what GitHub answers, field by field as it comes (a reader gives undefined for what it cannot read),
// and the bounds Sonar sets on an answer: it refuses the whole answer for one text over its bound.

export type Read<A> = (value: unknown) => A | undefined;

export const TITLE_MOST = 500;
export const BODY_MOST = 65_536;
// An author, a check's name, a label.
export const WORD_MOST = 200;
export const REF_MOST = 255;

export const fieldOf = (value: unknown, key: string): unknown => (typeof value === "object" && value !== null ? Reflect.get(value, key) : undefined);

export const textOf = (value: unknown): string | undefined => (typeof value === "string" ? value : undefined);
export const numberOf = (value: unknown): number | undefined => (typeof value === "number" ? value : undefined);
// A field GitHub may leave out: false when it is there and is no text.
export const isTextOrAbsent = (value: unknown): value is string | undefined => value === undefined || typeof value === "string";

// The named fields of `value` when each one is a text.
export function textsOf<Key extends string>(value: unknown, ...keys: Key[]): Record<Key, string> | undefined {
	const entries = keys.map((key) => [key, fieldOf(value, key)] as const);
	return entries.every(([, text]) => typeof text === "string") ? (Object.fromEntries(entries) as Record<Key, string>) : undefined;
}

// Each node of a GraphQL connection (`{ nodes: [...] }`), or undefined when one cannot be read.
export function nodesOf<A>(connection: unknown, read: Read<A>): A[] | undefined {
	const nodes = fieldOf(connection, "nodes");
	if (!Array.isArray(nodes)) return undefined;
	const items = nodes.map(read);
	return items.every((item) => item !== undefined) ? items : undefined;
}

// A connection GitHub may leave out, or give as null: none of its nodes then.
export const nodesOrNone = <A>(connection: unknown, read: Read<A>): A[] | undefined =>
	connection === undefined || connection === null ? [] : nodesOf(connection, read);
