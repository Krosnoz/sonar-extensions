// Days and weeks in the user's time zone, as "YYYY-MM-DD" strings, counted as Sonar counts them.

export const DAY_MS = 86_400_000;

export const dayOf = (ms: number): string => {
	const date = new Date(ms);
	return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
};

// The start of a day, at midnight in the user's time zone.
export const startOfDay = (day: string): number => {
	const [year = 0, month = 1, date = 1] = day.split("-").map(Number);
	return new Date(year, month - 1, date).getTime();
};

// Mondays of the last `count` weeks, the current week included, oldest first.
export function lastMondays(count: number): string[] {
	const today = new Date();
	today.setHours(12, 0, 0, 0);
	const monday = new Date(today.getTime() - ((today.getDay() + 6) % 7) * DAY_MS);
	return Array.from({ length: count }, (_, i) => dayOf(monday.getTime() - (count - 1 - i) * 7 * DAY_MS));
}

// Index of the week a day falls in, -1 before the first one.
export const weekOf = (starts: readonly string[], day: string): number => starts.findLastIndex((start) => start <= day);

// The extension runs in Sonar's server: between two parts of a long computation, the server takes its other requests.
export const nextTurn = (): Promise<void> => new Promise((resolve) => setImmediate(resolve));
