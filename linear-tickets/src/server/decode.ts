// The reading of what Linear answers, field by field as it comes: a reader gives undefined for what it cannot read,
// and one such field makes the whole answer unreadable.

export type Read<A> = (value: unknown) => A | undefined;

export const fieldOf = (value: unknown, key: string): unknown => (typeof value === "object" && value !== null ? Reflect.get(value, key) : undefined);

// The named fields of `value` when each one is a text.
export function textsOf<Key extends string>(value: unknown, ...keys: Key[]): Record<Key, string> | undefined {
	const entries = keys.map((key) => [key, fieldOf(value, key)] as const);
	return entries.every(([, text]) => typeof text === "string") ? (Object.fromEntries(entries) as Record<Key, string>) : undefined;
}

// Each node of a GraphQL connection (`{ nodes: [...] }`).
export function nodesOf<A>(connection: unknown, read: Read<A>): A[] | undefined {
	const nodes = fieldOf(connection, "nodes");
	if (!Array.isArray(nodes)) return undefined;
	const items = nodes.map(read);
	return items.every((item) => item !== undefined) ? items : undefined;
}
