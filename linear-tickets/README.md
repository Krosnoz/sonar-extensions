# Linear: an extension for Sonar

Linear as Sonar's ticket tracker (the port `tickets`). The extension tells Sonar what Linear knows; Sonar keeps the rest: the cache, the links between sessions and tickets, the search of a ticket in a session's texts, the agents that write a ticket. A Sonar that does not know the port `tickets` does not run it.

It goes through the extension contract alone: it imports nothing of Sonar, and has no dependency when it runs. It has no page part.

## What it needs

- A Linear personal API key for each project, the key `key`: create it in Linear (Settings › API › Personal API keys), then give it in Sonar's Settings › Services. A project without a key reaches no ticket, and nothing is asked to Linear for it.
- It calls `api.linear.app`. It writes one thing in Linear: an issue's state, when Sonar asks it to.

## What it asks Linear

Each call is one request to Linear's GraphQL API ([`src/server/api.ts`](src/server/api.ts)), with the project's key, left after 10 s. Values go in the request's variables, never in its text.

| Call | Asks | Answers |
| --- | --- | --- |
| `ready` | nothing | whether the project has a key |
| `workspace` | the organization and its teams (200 at most) | its name and its teams' prefixes (`ABC` of `ABC-12`) |
| `tickets` | all the identifiers at once, archived issues too | one ticket per identifier, in their order; null for one Linear does not find |
| `candidates` | your open issues (50), and the open issues updated last (100) | yours first, each issue once |
| `states` | the states of the issue's team | in the order of the team's board |
| `setState` | the change of the issue's state | rejects when Linear says it did not make it |
| `check` | the workspace, with a key given | the workspace the key opens |

`tickets` finds the issues by a filter on their identifiers. Linear's `issue(id:)` would fail the whole request for one identifier it does not know. The limit: an issue moved to another team may not be found by its former identifier.

An identifier that is not of the form `ABC-12` is never sent: `tickets` answers null for it, `states` and `setState` reject. A title over 500 characters is cut there, Sonar's bound.

## When a call fails

- Linear answers 401 or 403: the call rejects with an Error bearing `refused: true`, and Linear's message. Sonar tells a refused key from a Linear out of reach.
- No key for the project, Linear out of reach or silent for 10 s, any other status, an answer it cannot read: the call rejects with a plain Error. Its messages are in English, or Linear's own.

## What it keeps

Nothing: no setting, no file. The keys are in Sonar's secrets.

## Where things are

Laid out as every extension of this repository ([its README](../README.md#how-it-is-laid-out)).

| Path | What is there |
| --- | --- |
| [`extension.json`](extension.json) | The card: what Sonar shows of the extension, and what it asks for. |
| [`src/server.ts`](src/server.ts) | The server part: its entry. |
| [`src/server/`](src/server/) | Linear as Sonar's ticket tracker. Start with [`provider.ts`](src/server/provider.ts); the request to Linear is in [`api.ts`](src/server/api.ts), the reading of its answers in [`decode.ts`](src/server/decode.ts), then one file by subject: [`tickets.ts`](src/server/tickets.ts), [`states.ts`](src/server/states.ts), [`workspace.ts`](src/server/workspace.ts). |
| [`tests/`](tests/) | The tests, and the fake Linear they call. |
| [`scripts/build.ts`](scripts/build.ts) | The build. |

## Develop it

1. `bun install`, then `bun run check` (the types) and `bun test`.
2. `bun run build` writes `dist/` (the extension's folder: its card, `server.js` bundled and `icon.svg`) and `release/` (`extension.json` with the archive's SHA-256, and `extension.tar.gz`).

The tests run the server entry on the contract's testing kit (`@sonar/extension/testing`), without Sonar, against a fake Linear on a local port ([`tests/fake-linear.ts`](tests/fake-linear.ts)). They never call Linear. The contract is not on npm yet: the repository's one copy lives in [`../vendor/`](../vendor/README.md).

## Install it in Sonar

In Sonar: Settings › Extensions › Add, then `Krosnoz/sonar-extensions/linear-tickets`. Sonar shows its card, then installs it switched off. Switch it on: it runs from Sonar's next start.

## Publish it

Set the `version` in `extension.json`. The next release of the repository publishes it with the other extensions: see the repository's [README](../README.md).

## License

MIT
