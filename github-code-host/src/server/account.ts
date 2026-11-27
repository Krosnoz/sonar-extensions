// What a token opens: its account, and whether it sees a repository.

import type { AskGitHub } from "./api";
import { fieldOf, textOf } from "./decode";
import type { Repository } from "./remote";

export async function loginOf(ask: AskGitHub): Promise<string> {
	const login = textOf(fieldOf(fieldOf(await ask("query { viewer { login } }"), "viewer"), "login"));
	if (login === undefined) throw new Error("GitHub: unreadable account");
	return login;
}

// GitHub answers an error for a repository it hides: any failure counts as not seen.
export const sees = (ask: AskGitHub, repository: Repository): Promise<boolean> =>
	ask("query($owner: String!, $name: String!) { repository(owner: $owner, name: $name) { id } }", { ...repository }).then(
		(data) => textOf(fieldOf(fieldOf(data, "repository"), "id")) !== undefined,
		() => false,
	);
