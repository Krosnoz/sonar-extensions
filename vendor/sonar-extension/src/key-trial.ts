// The trial of a key an extension gives (ServerApi's keys.trial of ./contract.ts), read the same way by Sonar
// (apps/server/src/extensions/) and by the kit (./testing-keys.ts). The extension's code is plain JavaScript: its answer
// is checked as it came, and nothing it says gives the key away. Plain functions: the kit imports nothing of Sonar.

import { isRefused } from "./rules";

// What a trial answers: the account the key opens, and among the project names given, those the key reaches and those
// it does not.
export type KeyTrialAnswer = { readonly account: string; readonly reaches?: readonly string[]; readonly outside?: readonly string[] };

// Gets a key as typed, not saved yet, and the names of the projects that may take it (none when Sonar tries a key saved,
// or one that stays with the user), and answers the account it opens. A rejection by an Error with `refused: true`
// (./rules.ts#isRefused) says the service refused the key; any other, that it could not be tried. `projects` is optional:
// a Sonar older than it, which serves the same contract, gives none.
export type KeyTrialRun = (value: string, projects?: readonly string[]) => Promise<KeyTrialAnswer>;

// The account's words at most: they fill a row's title.
const ACCOUNT_MOST = 200;
// The project names a list of a trial holds at most.
const REACH_MOST = 500;
// The characters of an extension's reason said to the user at most.
const REASON_MOST = 300;

const keyTrialCannotRead = "The extension's key trial answered with what Sonar cannot read";

// What the extension says of the key it tried, without the key: it may quote it, as typed or inside an address. An empty
// value would be found everywhere.
const hidden = (said: string, value: string) => (value ? said.replaceAll(value, "…").replaceAll(encodeURIComponent(value), "…") : said);

// The account a trial of `value` answered: a text with a visible character, within its bound; undefined otherwise.
export function accountOf(answer: unknown, value: string): string | undefined {
	const account: unknown = typeof answer === "object" && answer !== null ? Reflect.get(answer, "account") : undefined;
	return typeof account === "string" && account.length <= ACCOUNT_MOST && account.trim() ? hidden(account, value) : undefined;
}

// The lists of a trial's answer Sonar keeps: each one a list of names among those given. Another one is left out,
// without a word: the account stands without it.
export function reachOf(answer: unknown, projects: readonly string[]): { reaches?: readonly string[]; outside?: readonly string[] } {
	const given = new Set<unknown>(projects);
	const listed = (key: "reaches" | "outside") => {
		const list: unknown = typeof answer === "object" && answer !== null ? Reflect.get(answer, key) : undefined;
		return Array.isArray(list) && list.length <= REACH_MOST && list.every((name): name is string => given.has(name)) ? { [key]: [...list] } : {};
	};
	return { ...listed("reaches"), ...listed("outside") };
}

// Why a trial of `value` rejected, cut at its bound.
export const trialReason = (error: unknown, value: string): string =>
	hidden(error instanceof Error ? error.message : String(error), value).slice(0, REASON_MOST);

// The trial as the kit gives it to a test: the key trimmed as Sonar trims it, its account, its lists and its reason as
// Sonar reads them, a rejection keeping `refused`. An answer Sonar cannot read rejects without it, as any trial that
// failed. It holds no delay over the trial: Sonar does.
export const checkedKeyTrial =
	(run: KeyTrialRun) =>
	async (typed: string, projects: readonly string[] = []): Promise<KeyTrialAnswer> => {
		const value = typed.trim();
		let answer: unknown;
		try {
			answer = await run(value, projects);
		} catch (error) {
			const reason = trialReason(error, value);
			// Nothing to hide nor to cut: the error as it came.
			if (error instanceof Error && error.message === reason) throw error;
			throw Object.assign(new Error(reason), isRefused(error) ? { refused: true } : {});
		}
		const account = accountOf(answer, value);
		if (account === undefined) throw new Error(keyTrialCannotRead);
		return { account, ...reachOf(answer, projects) };
	};
