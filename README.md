# Sonar's extensions

Extensions for [Sonar](https://github.com/Krosnoz/sonar), one folder per extension, published together in one GitHub release.

| Extension | What it does | Install address |
| --- | --- | --- |
| [Pinned note](pinned-note/) | A note you write once in Settings: every agent can read it. The example extension. | `Krosnoz/sonar-extensions/pinned-note` |
| [Statistics](statistics/) | Week by week: whether the work goes faster, whether the agents work well, what it costs and how much of your time it takes. | `Krosnoz/sonar-extensions/statistics` |
| [Jev](typesafe-jev/) | TypeSafe's model judges what your agents say: their cards' sentence and urgency, related agents, a session's topic, where a spoken sentence goes, the end-of-turn check. Paid by use, with a monthly cap. | `Krosnoz/sonar-extensions/typesafe-jev` |

To install one in Sonar: Settings › Extensions › Add, then its install address. Sonar shows its card, then installs it switched off. Switch it on: it runs from Sonar's next start.

## How it is laid out

- `<id>/`: one extension, its folder named by its id. Its card (`extension.json`), `src/`, `tests/`, `scripts/build.ts`, `package.json`, `tsconfig.json` and its `README.md`. Its `bun run build` writes `<id>/dist/` (the extension's folder as Sonar lays it) and `<id>/release/` (`extension.json`, the card with the archive's SHA-256, and `extension.tar.gz`).
- `vendor/sonar-extension/`: the one copy of the contract (`@sonar/extension`), which every extension links (see [`vendor/README.md`](vendor/README.md)).
- `scripts/`: the root's scripts, which run on every folder of the root that has an `extension.json`.
- `release/`, written by `bun run build` at the root: two files per extension, `<id>.json` (its card with its archive's SHA-256) and `<id>.tar.gz` (its archive). Sonar reads these two files in the latest release of this repository. And `extensions.json`, one file for all: the cards of the extensions [`catalog.json`](catalog.json) names, in its order. Sonar's screen Extensions reads it to offer the ones not installed yet; an extension left out of `catalog.json`, as `pinned-note`, is still published and installs by its address.

## Develop

At the root, with [Bun](https://bun.sh) 1.4.4:

1. `bun run setup`: `bun install` in each extension's folder.
2. `bun run check` (the types) and `bun run test`, for each extension.
3. `bun run build`: builds each extension, then writes `release/`. It refuses a card the contract refuses, a folder not named by its card's id, and an archive whose SHA-256 is not its card's.

In one extension's folder, `bun install`, `bun run check`, `bun test` and `bun run build` work on that extension alone. The build writes the archive itself, without the system's `tar`: two builds of the same commit give the same archive on one system, so a release does not change the SHA-256 of an extension that did not change.

## Add an extension

Add a folder at the root, named by the extension's id, with its `extension.json`: copy `pinned-note/`, then change the `id` (lower case letters, digits and dashes), the `name` and the `description` of its card, the `name` of its `package.json`, and `pinned-note` in `src/` and `tests/` (Sonar names the tool `<id>_read`). Its `package.json` links the contract by `"@sonar/extension": "file:../vendor/sonar-extension"`. Run `bun install` in it once, which writes its `bun.lock` with its new name. The root's scripts and the workflows take it from then on. Add it to the table above.

## Publish

Push a tag named by the day on a commit of `main`, `2026.11.20` (a second release on the same day: `2026.11.20.2`). The workflow `Release` checks, tests and builds every extension, then publishes the release, marked as the latest, with all the files of `release/`. Each extension's version stays in its card: change it in `extension.json` when the extension changes.

The limit: a release publishes every extension again, the ones that did not change too. Sonar compares the version of each card with the version installed, and offers an update when the card's is different. Since two builds of the same commit give the same archive, an extension that did not change keeps its SHA-256 from one release to the next.

## Write your own extension

In a repository of your own, with one extension:

1. Copy the files of `pinned-note/` to its root, and `vendor/sonar-extension/` of this repository to `vendor/sonar-extension/` in it.
2. In its `package.json`, link the contract by `"@sonar/extension": "file:./vendor/sonar-extension"` (the `bun.lock` copied still says `file:../vendor/…`), and change the `name`.
3. In its `extension.json`, change the `id` (lower case letters, digits and dashes), the `name` and the `description`. Replace `pinned-note` by the new id in `src/` and `tests/`: Sonar names the tool `<id>_read`.
4. Run `bun install` once, without `--frozen-lockfile`: it writes `bun.lock` again with the new link. Then `bun run check`, `bun test` and `bun run build`.
5. Publish the two files of `release/`, `extension.json` and `extension.tar.gz`, in a GitHub release, under these names. It installs by `owner/repository`.

Sonar's documentation for extension authors: [`docs/extensions.md`](https://github.com/Krosnoz/sonar/blob/main/docs/extensions.md).

## License

MIT
