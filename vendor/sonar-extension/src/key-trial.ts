// The trial of a key an extension gives (ServerApi's keys.trial of ./contract.ts), checked the same way by Sonar
// (apps/server/src/extensions/) and by the kit (./testing-keys.ts). The extension's code is plain JavaScript: its answer
// is checked as it came. Plain functions: the kit imports nothing of Sonar.

// Gets a key as typed, not saved yet, and answers the account it opens. A rejection by an Error with `refused: true`
// (./rules.ts#isRefused) says the service refused the key; any other, that it could not be tried.
export type KeyTrialRun = (value: string) => Promise<{ readonly account: string }>;

// The account's words at most: they fill a row's title.
const ACCOUNT_MOST = 200;

const keyTrialCannotRead = "The extension's key trial answered with what Sonar cannot read";

// The account a trial answered: a text with a visible character, within its bound; undefined otherwise.
export function accountOf(answer: unknown): string | undefined {
	const account: unknown = typeof answer === "object" && answer !== null ? Reflect.get(answer, "account") : undefined;
	return typeof account === "string" && account.length <= ACCOUNT_MOST && account.trim() ? account : undefined;
}

// The trial as the kit gives it to a test: the key trimmed as Sonar trims it, an answer Sonar refuses failing with
// Sonar's words. A rejection passes as it is. It holds no delay over the trial: Sonar does.
export const checkedKeyTrial =
	(run: KeyTrialRun): KeyTrialRun =>
	async (value) => {
		const account = accountOf(await run(value.trim()));
		if (account === undefined) throw new Error(keyTrialCannotRead);
		return { account };
	};
