// Days in the user's time zone, as "YYYY-MM-DD" strings, counted as Sonar counts them.

export const dayOf = (ms: number): string => {
	const date = new Date(ms);
	return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
};

// The day `back` days before the one of `now`, counted from its noon: a day of 23 or 25 hours (change of time) neither
// skips a day nor gives the same one twice.
export const daysAgo = (now: number, back: number): string => dayOf(new Date(now).setHours(12, 0, 0, 0) - back * 86_400_000);
