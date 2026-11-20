# Sonar's extensions

Extensions for [Sonar](https://github.com/Krosnoz/sonar), one folder per extension, published together in one GitHub release.

| Extension | What it does | Install address |
| --- | --- | --- |
| [Pinned note](pinned-note/) | A note you write once in Settings: every agent can read it. The example extension. | `Krosnoz/sonar-extensions/pinned-note` |
| [Statistics](statistics/) | Week by week: whether the work goes faster, whether the agents work well, what it costs and how much of your time it takes. | `Krosnoz/sonar-extensions/statistics` |

To install one in Sonar: Settings › Extensions › Add, then its install address. Sonar shows its card, then installs it switched off. Switch it on: it runs from Sonar's next start.

## How it is laid out

- `<id>/`: one extension, its folder named by its id. Its card (`extension.json`), `src/`, `tests/`, `scripts/build.ts`, `package.json`, `tsconfig.json` and its `README.md`. Its `bun run build` writes `<id>/dist/` (the extension's folder as Sonar lays it) and `<id>/release/` (`extension.json`, the card with the archive's SHA-256, and `extension.tar.gz`).
- `vendor/sonar-extension/`: the one copy of the contract (`@sonar/extension`), which every extension links (see [`vendor/README.md`](vendor/README.md)).
- `scripts/`: the root's scripts, which run on every folder of the root that has an `extension.json`.
- `release/`, written by `bun run build` at the root: two files per extension, `<id>.json` (its card with its archive's SHA-256) and `<id>.tar.gz` (its archive). Sonar reads these two files in the latest release of this repository.

## Develop

At the root, with [Bun](https://bun.sh) 1.4.4:

1. `bun run setup`: `bun install` in each extension's folder.
2. `bun run check` (the types) and `bun run test`, for each extension.
3. `bun run build`: builds each extension, then writes `release/`. It refuses two folders of the same id.

In one extension's folder, `bun install`, `bun run check`, `bun test` and `bun run build` work on that extension alone. The build packs the archive with the system's `tar` (GNU tar or bsdtar); `TAR` names another one.

## Add an extension

Add a folder at the root, named by the extension's id, with its `extension.json`: copy `pinned-note/`, then change the `id` (lower case letters, digits and dashes), the `name` and the `description` of its card, and the `name` of its `package.json`. Its `package.json` links the contract by `"@sonar/extension": "file:../vendor/sonar-extension"`. The root's scripts and the workflows take it from then on. Add it to the table above.

## Publish

Push a tag named by the day, `2026.11.20` (a second release on the same day: `2026.11.20.2`). The workflow `Release` checks, tests and builds every extension, then publishes the release with all the files of `release/`. Each extension's version stays in its card: change it in `extension.json` when the extension changes.

The limit: a release publishes every extension again, the ones that did not change too. Sonar compares the version of each card with the version installed, and offers an update only when the card's is newer.

## Write your own extension

Copy the folder `pinned-note/` into a repository of your own, with `vendor/` at its root, and link the contract by `"@sonar/extension": "file:./vendor/sonar-extension"`. A repository with one extension publishes its folder's two files, `release/extension.json` and `release/extension.tar.gz`, in a GitHub release, under these names. It installs by `owner/repository`.

Sonar's documentation for extension authors is `docs/extensions.md` in Sonar's repository.

## License

MIT
