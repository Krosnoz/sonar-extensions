# Statistics: an extension for Sonar

Week by week, over the last 9 weeks: whether the work goes faster, whether the agents work well, what it costs and how much of your time it takes. Every project's, and each project's, with each session's strip of the last 7 days.

It has a server part and a page part. The server part answers what Sonar's own statistics answer, field for field; the page part draws the same blocks as Sonar's own statistics, in the statistics' screens Sonar keeps. Both go through the extension contract alone: they import nothing of Sonar, and have no dependency when they run. It needs no key, calls no address and costs nothing.

## What it shows, and where

Its page part ([`src/page.ts`](src/page.ts), [`src/page/`](src/page/), its sheet [`src/page.css`](src/page.css)) places parts in the screens Sonar keeps for the statistics (Sonar's `slots.part`). Sonar offers these screens while a part is placed in them.

| Screen | Place | What it draws |
| --- | --- | --- |
| Settings › Statistics | `top` | The switch of the weeks compared (the last week, the last 4, since Sonar), then where your time and money go, a line per project (a line opens that project's statistics), then how you work (your time, the leverage, the sessions in parallel, the reply delay). |
| | `accounts` | Two tiles in the block "Your accounts and what they cost": the API equivalent of the agents' work, and its cost per merged PR. Their gaps count in that block's verdict. |
| | `bottom` | Whether Sonar keeps its agents in hand: merged first time, failed delegated tasks, trusted projects, stopped commands. |
| A project's settings › Statistics | `main` | The whole screen: whether the project moves faster, whether its agents work well (with a link to its Trust screen), what it costs, how much of your time it takes, then its sessions of the last 7 days on a strip. |

Each figure compares the weeks chosen with as many before, says which way it went, and shows a bar a week; what it counts is its tip. While a screen reads, its skeleton; a reading that fails says why, with "Retry". The choice of the weeks is kept in the browser; the one Sonar's own statistics kept is taken once.

## Its routes

Under `/api/ext/statistics`:

| Route | Answers | As Sonar's |
| --- | --- | --- |
| `GET /global` | Every project's weeks, and a line per project with its trust level | `GET /api/stats` |
| `GET /project?project=<name>` | A project's weeks, every project's cost each week, its trust | `GET /api/stats/project` |
| `GET /tasks?project=<name>` | The project's sessions of the last 7 days on a strip: work, waits, the user's messages and minutes | `GET /api/stats/tasks` |

`/global` and `/project` are long to compute: a second reading gets the last computation at once, and the next one has the computation made meanwhile. `updatedAt` says when it was computed. A route without its `project` answers 400.

The shapes are in [`src/shapes.ts`](src/shapes.ts).

## What it reads

Its card ([`extension.json`](extension.json)) declares every family it reads of what Sonar measures: `usage` (the agents' work by day, each session's timeline, the velocity), `presence` (the user's minutes), `tasks` (the delegated tasks), `sessions` (the sessions closed), `merges` (the merges landed), `commands` (the commands Sonar stopped) and `trust` (each project's trust).

## What differs when activity is not measured

The user may stop Sonar from measuring their activity (Sonar's setting `metrics`). The contract then gives none of these, and the extension shows them as not measured (`null`):

- the velocity (`usage.velocity()` is `null`): no PR nor commit is counted (`prs` and `commits` 0), and the lead time, the sessions in parallel and the reply delay are `null`;
- the reply delays (`repliesMs` is `null`): each week's `waitedMs` is `null`;
- the user's messages on a strip (`touches` is `null`): its `touches` and `interventions` are `null`.

The page shows each of these as not measured: a dash and "not measured yet" in its tile, and "you step in: not measured" in the legend of the strips, which have no mark of the user's messages.

Sonar's own statistics show the last computation instead: the waits and the messages it notes anyway, and the velocity until its next computation.

## What else differs from Sonar's own statistics

Measured against Sonar's own routes on the same data (Sonar's test `tests/server-extension-statistics.test.ts`):

- A project's trust (`/project`) has its level, its proofs and its verification's points and working points, not the other measures behind the proofs (failed points, the last check, the corrections, the turn ends sent back, the changes undone): the contract's `projects.trust` gives no more.
- The projects of `/global` come in the order of their first day of work; Sonar lists them in the order its index read their folders. The page sorts them by time and cost.
- The trust is read as Sonar measured it last, kept 10 s: just after a change, a computation may show the proofs of a few seconds before.
- Before Sonar has read its agents' files once since it started (`usage.days` gives `from: null`), no work is counted.

## Develop it

1. `bun install`, then `bun run check` (the types) and `bun test`.
2. `bun run build` writes `dist/` (the extension's folder: its card, `server.js` and `page.js`, bundled, and `page.css`) and `release/` (`extension.json` with the archive's SHA-256, and `extension.tar.gz`).

The tests run the server entry on the contract's testing kit (`@sonar/extension/testing`), without Sonar, and the page's figures as plain functions. The page itself is tested in Sonar's repository: its statistics' page tests run on this release (`statistics/release/`) in place of Sonar's own statistics (`SONAR_TEST_STATISTICS_RELEASE`). The contract is not on npm yet: the repository's one copy lives in [`../vendor/`](../vendor/README.md).

## Install it in Sonar

In Sonar: Settings › Extensions › Add, then `Krosnoz/sonar-extensions/statistics`. Sonar shows its card, then installs it switched off. Switch it on: it runs from Sonar's next start.

## Publish it

Set the `version` in `extension.json`. The next release of the repository publishes it with the other extensions: see the repository's [README](../README.md).

## License

MIT
