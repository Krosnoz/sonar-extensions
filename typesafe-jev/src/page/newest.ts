// A reading the page may start again before the last one came back (a period chosen twice quickly, the key given while
// the part reads): each call gives the answer of the newest one started, whatever order the answers come back in. An
// older answer, back late, never draws a state the user left.

export function newest<Value>(read: () => Promise<Value>): () => Promise<Value> {
	let latest: Promise<Value> | null = null;
	const settle = async (asked: Promise<Value>): Promise<Value> => {
		try {
			const value = await asked;
			if (asked === latest) return value;
		} catch (error) {
			if (asked === latest) throw error;
		}
		return settle(latest ?? asked);
	};
	return () => {
		const asked = read();
		latest = asked;
		return settle(asked);
	};
}
