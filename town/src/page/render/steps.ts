// A long work in steps: a generator that yields between two of them. Run in one go (the tests, a measure), or run a slice
// of time after another, the browser given its hand between them: built in one go, the town froze the page 2 to 3 s
// after the click on its icon (13/11).
// Elsewhere: React's scheduler gives the hand back every 5 ms (`shouldYieldToHost`); `scheduler.yield()` does it where
// the browser has it.

export type Steps<T> = Generator<void, T>;

export function finish<T>(steps: Steps<T>): T {
	let next = steps.next();
	while (!next.done) next = steps.next();
	return next.value;
}

// A task of the browser: a frame due is drawn before the next one.
export const handBack = (): Promise<void> => new Promise((done) => setTimeout(done, 0));

// `slice`: the milliseconds of work between two hands given back; a frame takes about 16.
export async function stepped<T>(steps: Steps<T>, slice = 25, now = (): number => performance.now(), hand = handBack): Promise<T> {
	const began = now();
	return slices(steps, slice, now, hand, began, steps.next());
}

// The steps run until `slice` ms passed since `began`; then the hand is given back, and the next slice begins.
async function slices<T>(
	steps: Steps<T>,
	slice: number,
	now: () => number,
	hand: () => Promise<void>,
	began: number,
	first: IteratorResult<void, T>,
): Promise<T> {
	let next = first;
	while (!next.done && now() - began <= slice) next = steps.next();
	if (next.done) return next.value;
	await hand();
	const again = now();
	return slices(steps, slice, now, hand, again, steps.next());
}
