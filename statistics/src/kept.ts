// A long computation served at once from its last value, while a new one runs apart: the screen that asks does not
// wait, and the next ask has what was computed meanwhile. One computation at a time per key; the first ask of a key
// waits for it. A failed computation keeps the last value, and the next ask tries again.

export function keptByKey<Key, Value>() {
	const kept = new Map<Key, Value>();
	const running = new Map<Key, Promise<Value>>();
	const compute = (key: Key, work: () => Promise<Value>): Promise<Value> => {
		const computing = work().then((value) => {
			kept.set(key, value);
			return value;
		});
		const done = () => void running.delete(key);
		running.set(key, computing);
		computing.then(done, done);
		return computing;
	};
	return {
		get: (key: Key, work: () => Promise<Value>): Promise<Value> => {
			const pending = running.get(key);
			if (!kept.has(key)) return pending ?? compute(key, work);
			const last = kept.get(key) as Value;
			if (!pending) compute(key, work).catch(() => undefined);
			return Promise.resolve(last);
		},
	};
}
