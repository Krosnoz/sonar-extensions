# Town: an extension for Sonar

Turns the Map into an isometric town where you watch the agents at work: a building per subject, an inhabitant per session, scaffolding for a pull request under test, a storey for each merge. On a computer only. It needs no key, calls no address and costs nothing.

It has a page part only, and goes through the extension contract alone: it imports nothing of Sonar, and draws with [three.js](https://threejs.org) (WebGPU, else WebGL 2).

## What it shows, and where

| Screen | Place | What it draws |
| --- | --- | --- |
| The Map | `tools` | The town's icon among the Map's tools. Its first touch builds the town from the Map's cards (`api.map`), over the Map it covers (`map.cover`); a second brings the Map back. While the town shows, the icon stands in the bottom right corner. |
| | `layer` | The town itself, and the icon of a phone's Map, which has no tools. |
| Settings › Sounds | | A section of the town's four sounds (`api.sounds`): bricks laid, a merge, a pull request under test, an inhabitant who comes or goes. |

The icon shows only where the machine can draw the whole town ([`src/offered.ts`](src/offered.ts)): not on a phone or a tablet, not on a browser that draws on the processor. A machine that cannot hold it is told so once, and its icon comes back the next day.

Its entry, [`src/page.ts`](src/page.ts), is a few KiB: three.js and the town are parts of the build of their own, loaded at the first pointer over the icon ([`src/toggle.ts`](src/toggle.ts)), never at the page's start. The build names them in the card's `files`, with the images and the sounds ([`assets/`](assets/)). Its sheet is [`src/page.css`](src/page.css).

## What it keeps in the browser

`sonar:town-unheld`: when this machine did not hold the town (a day without its icon). Two keys a test sets: `sonar:town-draw` (draw whatever the machine, at a tier) and `sonar:town-limit` (the longest an opening may take, in milliseconds).

## Not yet

The style of each project's town (the user's choice, or one drawn once for the project) and the block "Town" of a project's General screen: until then, a town takes its style from its project's name ([`src/town-style.ts`](src/town-style.ts), [`src/styles.ts`](src/styles.ts)).

## Develop it

1. `bun install`, then `bun run check` (the types) and `bun test` (the tests, beside the code they test in `src/`).
2. `bun run build` writes `dist/` (its card with `files`, `page.js` and its parts, `page.css`, the images and the sounds) and `release/` (`extension.json` with the archive's SHA-256, and `extension.tar.gz`).
