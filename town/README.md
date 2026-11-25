# Town: an extension for Sonar

Turns the Map into an isometric town where you watch the agents at work: a building per subject, an inhabitant per session, scaffolding for a pull request under test, a storey for each merge. On a computer only. It needs no key, calls no address and costs nothing.

It has a page part and a server part, and goes through the extension contract alone: it imports nothing of Sonar, and draws with [three.js](https://threejs.org) (WebGPU, else WebGL 2).

## What it shows, and where

| Screen | Place | What it draws |
| --- | --- | --- |
| The Map | `tools` | The town's icon among the Map's tools. Its first touch builds the town from the Map's cards (`api.map`), over the Map it covers (`map.cover`); a second brings the Map back. While the town shows, the icon stands in the bottom right corner. |
| | `layer` | The town itself, and the icon of a phone's Map, which has no tools. |
| Settings › Sounds | | A section of the town's four sounds (`api.sounds`): bricks laid, a merge, a pull request under test, an inhabitant who comes or goes. |
| A project's General screen | `sections` | The block "Town" (`ui.section`): the style of the project's town, a picture per style, and first "Automatic". A choice is saved at once; a town open in another style closes, and its next opening builds the style chosen ([`src/town-style-pane.ts`](src/town-style-pane.ts)). |

The icon and the block show only where the machine can draw the whole town ([`src/offered.ts`](src/offered.ts)): not on a phone or a tablet, not on a browser that draws on the processor. A machine that cannot hold it is told so once, and its icon comes back the next day.

Its entry, [`src/page.ts`](src/page.ts), is a few KiB: three.js and the town are parts of the build of their own, loaded at the first pointer over the icon ([`src/toggle.ts`](src/toggle.ts)), never at the page's start. The build names them in the card's `files`, with the images and the sounds ([`assets/`](assets/)). Its sheet is [`src/page.css`](src/page.css).

## What it keeps in the browser

`sonar:town-unheld`: when this machine did not hold the town (a day without its icon). Two keys a test sets: `sonar:town-draw` (draw whatever the machine, at a tier) and `sonar:town-limit` (the longest an opening may take, in milliseconds).

## The style of each project's town

Its server part ([`src/server.ts`](src/server.ts)) keeps the style of each project's town in its data folder, `styles.json` ([`src/style-store.ts`](src/style-store.ts)): the style the user chose, else one drawn once for the project, the style the fewest other projects' towns show, so that two towns differ without a setting. Its routes, under `/api/ext/town`:

| Route | Body | Answer |
| --- | --- | --- |
| `GET /style?project=<name>` | | `{ style, drawn }`, each a style or `null`. A reading never draws. |
| `POST /style` | `{ project, style }`: one of `riverside`, `brick`, `sun`, `neon`, `fjord`, `oasis`, or `automatic` (the draw) | `{ style, drawn }` as kept. |

Any project named is taken, whether Sonar lists it or not: a project the Map shows has a town. A request without a project, or another style, answers 400. The town's first opening asks for the draw; while the server cannot be read, the town takes a style from its project's name ([`src/town-style.ts`](src/town-style.ts), [`src/styles.ts`](src/styles.ts)).

Sonar kept these styles in each project's settings file, under `world`, before the town became an extension. At each start, the server part takes them ([`src/style-left.ts`](src/style-left.ts)): a style the user chose in the extension stays; else the former value takes its place. A value it cannot read is set aside in `styles.json`, never lost. The field leaves the projects' files once `styles.json` is written.

## Develop it

1. `bun install`, then `bun run check` (the types) and `bun test` (the tests, beside the code they test in `src/`).
2. `bun run build` writes `dist/` (its card with `files`, `server.js`, `page.js` and its parts, `page.css`, the images and the sounds) and `release/` (`extension.json` with the archive's SHA-256, and `extension.tar.gz`).

How it is built: [`docs/architecture.md`](docs/architecture.md). What to check of it in Sonar, as a user: [`docs/verify.md`](docs/verify.md).

## Page tests

[`tests/page/`](tests/page/) plays the town in Sonar's page, in Chromium, on Sonar's page bench (an isolated Sonar with a fake `claude`), the extension laid from `release/` at this repository's root. They need:

- a copy of [Sonar's repository](https://github.com/Krosnoz/sonar), after `bun install` in it;
- what Sonar's own page tests need, as its `CONTRIBUTING.md` lists it: Node 22.18 or later, Playwright's Chromium (`bunx playwright-core install chromium`), and on Windows the C# compiler of .NET Framework 4, for the fake `claude`.

In this folder:

```sh
SONAR_REPO=<the folder of the copy of Sonar> bun run test:page                         # every file
SONAR_REPO=<the folder of the copy of Sonar> bun run test:page world-tools.page.ts     # one file
```

The command builds the release first when it is missing or older than the extension's files, and checks the tests' types (`bun run check:page` does that alone). Each file runs as Sonar's `bun run verify` runs its own: under Node, in a temporary home, a file that fails run again alone at the end. One file at a time, 1 to 4 minutes each: about 40 minutes for all of them; `--jobs 2` runs two at once, on a machine with memory to spare (a file takes about 1.6 GB).

The tests import Sonar's test helpers through `tests/sonar`, a link to the copy `SONAR_REPO` names, which the command makes and git ignores. Without `SONAR_REPO`, the command says so and exits with 2.
