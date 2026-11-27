// What the checks of a port's answers (./ticket-answers.ts, ./code-host-answers.ts) share: reading a field of what an
// extension's plain JavaScript answered, and bounding it. Plain functions: the kit imports nothing of Sonar.

const URL_MOST = 2000;

export const fieldOf = (value: unknown, key: string): unknown => (typeof value === "object" && value !== null ? Reflect.get(value, key) : undefined);
export const text = (value: unknown, most: number): value is string => typeof value === "string" && value.length <= most;
export const named = (value: unknown, most: number): value is string => text(value, most) && value.length > 0;
export const isHttps = (value: unknown): value is string => {
	if (!named(value, URL_MOST)) return false;
	try {
		return new URL(value).protocol === "https:";
	} catch {
		return false;
	}
};

// Each item decoded, or undefined when one is refused, or the answer is no array of at most `most` items.
export function listOf<A>(answer: unknown, most: number, decode: (item: unknown) => A | undefined): A[] | undefined {
	if (!Array.isArray(answer) || answer.length > most) return undefined;
	const items = answer.map(decode);
	return items.every((each) => each !== undefined) ? items : undefined;
}
