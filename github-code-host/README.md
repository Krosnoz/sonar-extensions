# GitHub: an extension for Sonar

GitHub as Sonar's code host (the port `codeHost`). The extension tells Sonar what GitHub knows; Sonar keeps the rest: the cache of the readings, the watch of a pull request, the issues taken, the velocity, the branches followed. A Sonar that does not know the port `codeHost` does not run it.

It goes through the extension contract alone: it imports nothing of Sonar, and has no dependency when it runs. It has no page part.

## What it needs

- A GitHub personal access token for each project, the key `token`: create it on github.com (Settings › Developer settings › Personal access tokens › Tokens (classic)), with the `repo` scope, then give it in Sonar's Settings › Services. A project without a key reaches no pull request, and nothing is asked to GitHub for it.
- `git` on the computer's `PATH`: the repository of a project is read from the `origin` remote of its folder.
- It calls `api.github.com` alone. It writes one thing on GitHub: a pull request, when Sonar asks it to open one.
- Sonar tries a key before it saves it: the extension answers the account the token opens, the projects whose repository it sees, and those that have no repository on GitHub. A token GitHub refuses is not saved. A Sonar older than this trial saves the key without trying it.
- It gives the git of a project's sessions its token, for `github.com`, under the user name `x-access-token`.

## A project's repository

The `origin` remote of the project's main folder, when it is an https or ssh address of `github.com`. A session's pull request is found by the `origin` of its own folder. A folder's remote is read once, then kept until Sonar starts again.

The field `github` (`owner/name`) of a project's settings file comes first when Sonar hands it to the extension. Sonar hands over only a field it does not know itself ([`projects.left`](../vendor/sonar-extension/src/contract.ts)): **while Sonar keeps its own setting `github`, the extension gets nothing of it, and the remote alone counts.**

## What it asks GitHub

Each call is one or a few requests to GitHub's GraphQL API ([`src/server/api.ts`](src/server/api.ts)), with the project's token. Values go in the request's variables, never in its text.

| Call | Asks | Answers |
| --- | --- | --- |
| `ready` | nothing | whether the project has a key |
| `repository` | nothing | `owner/name`, or null |
| `account` | the token's user | their login |
| `pullByUrl` | the pull request at the address | its state, checks, reviews and comments; null when GitHub does not show it |
| `pullOfBranch` | the last 5 pull requests of the branch | the open one, else the latest; null without one, or for a folder outside GitHub |
| `issues` | the 20 oldest open issues with the label, then the rights of each person who put it | those whose label was put last by a person who can write in the repository |
| `openPull` | the open pull request of the branch, else creates one | its number and address |
| `pullState` | the pull request | `OPEN`, `MERGED` or `CLOSED` |
| `merged` | GitHub's search, 100 a page, 5 pages at most | the author's pull requests merged since the day |
| `tracked` | all the branches in one request | for each: the open pull requests toward it (50), the merges since the moment (30 at most), and the commits of the branch before it that it lacks |
| `gitAccess` | nothing | the token, for `github.com` |

Texts longer than Sonar takes are cut: a title at 500 characters, a body at 65,536, a name or a label at 200.

## When a call fails

- GitHub answers 401: the call rejects with an Error bearing `refused: true`, and GitHub's message. Sonar tells a refused key from a GitHub out of reach.
- No key, no repository where one is needed, GitHub out of reach, any other status, an error in its answer: the call rejects with a plain Error. Its messages are in English, or GitHub's own.
- An answer it cannot read: the call rejects, except for a pull request (`pullByUrl`, `pullOfBranch`), which is then none.

## What it keeps

Nothing: no setting, no file. The keys are in Sonar's secrets.

## Where things are

Laid out as every extension of this repository ([its README](../README.md#how-it-is-laid-out)).

| Path | What is there |
| --- | --- |
| [`extension.json`](extension.json) | The card: what Sonar shows of the extension, and what it asks for. |
| [`src/server.ts`](src/server.ts) | The server part: its entry. |
| [`src/server/`](src/server/) | GitHub as Sonar's code host. Start with [`provider.ts`](src/server/provider.ts); the request to GitHub is in [`api.ts`](src/server/api.ts), the reading of its answers in [`decode.ts`](src/server/decode.ts), a project's repository in [`repository.ts`](src/server/repository.ts) and [`remote.ts`](src/server/remote.ts), then one file by subject: [`pull.ts`](src/server/pull.ts), [`pull-reads.ts`](src/server/pull-reads.ts), [`checks.ts`](src/server/checks.ts), [`issues.ts`](src/server/issues.ts), [`open-pull.ts`](src/server/open-pull.ts), [`merged.ts`](src/server/merged.ts), [`tracked.ts`](src/server/tracked.ts) and its [`tracked-query.ts`](src/server/tracked-query.ts), [`account.ts`](src/server/account.ts), [`trial.ts`](src/server/trial.ts). |
| [`tests/`](tests/) | The tests, the fake GitHub they call ([`fake-github.ts`](tests/fake-github.ts)) and the repositories they make ([`folders.ts`](tests/folders.ts)). |
| [`scripts/build.ts`](scripts/build.ts) | The build. |

## Develop it

1. `bun install`, then `bun run check` (the types) and `bun test`.
2. `bun run build` writes `dist/` (the extension's folder: its card, `server.js` bundled and `icon.svg`) and `release/` (`extension.json` with the archive's SHA-256, and `extension.tar.gz`).

The tests run the server entry on the contract's testing kit (`@sonar/extension/testing`), without Sonar, against a fake GitHub in memory and git repositories made in a temporary folder. They never call GitHub. The contract is not on npm yet: the repository's one copy lives in [`../vendor/`](../vendor/README.md).

## Install it in Sonar

In Sonar: Settings › Extensions › Add, then `Krosnoz/sonar-extensions/github-code-host`. Sonar shows its card, then installs it switched off. Switch it on: it runs from Sonar's next start. While it runs, it serves Sonar's code host in place of the GitHub plugin that some versions of Sonar ship. It keeps its keys apart from the plugin's: give each project its token to the extension.

## Publish it

Set the `version` in `extension.json`. The next release of the repository publishes it with the other extensions: see the repository's [README](../README.md).

## License

MIT
