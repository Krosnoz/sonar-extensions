# Pinned note: an example extension for Sonar

A note you write once in Sonar's Settings; every agent can read it. It needs no key, calls no address and costs nothing.

It shows each part of an extension's contract once, with as little code as possible:

| Part | Where |
| --- | --- |
| Its card | [`extension.json`](extension.json) |
| A route of the server (`GET` and `POST /api/ext/pinned-note/note`) | [`src/server.ts`](src/server.ts) |
| A tool for the agents (`pinned-note_read`) | [`src/server.ts`](src/server.ts) |
| A screen in Settings, built from Sonar's own parts | [`src/page.ts`](src/page.ts), [`src/page.css`](src/page.css) |
| An action of the command bar | [`src/page.ts`](src/page.ts) |
| Tests with the contract's kit | [`tests/server.test.ts`](tests/server.test.ts) |
| The build and the release | [`scripts/build.ts`](scripts/build.ts), the repository's [`.github/workflows/`](../.github/workflows/) |

Sonar's documentation for extension authors: [`docs/extensions.md`](https://github.com/Krosnoz/sonar/blob/main/docs/extensions.md).

## Develop it

1. `bun install`, then `bun run check` (the types) and `bun test`.
2. `bun run build` writes `dist/` (the extension's folder: its card, `server.js` and `page.js`, bundled, `page.css` and `icon.svg`) and `release/` (`extension.json` with the archive's SHA-256, and `extension.tar.gz`). Sonar builds nothing: each entry is one file, its imports bundled.

The contract (`@sonar/extension`) is not on npm yet: the repository's one copy lives in [`../vendor/`](../vendor/README.md).

## Start from it

- Another extension of this repository: copy this folder at the root, named by the new id, as the repository's [README](../README.md) says.
- An extension in a repository of your own: copy the files of this folder to its root, and `vendor/sonar-extension/` to `vendor/sonar-extension/` in it. Link the contract by `"@sonar/extension": "file:./vendor/sonar-extension"` in `package.json` (the `bun.lock` copied still says `file:../vendor/…`), and change its `name`. Change the `id` in `extension.json` (lower case letters, digits and dashes), its `name` and its `description`, and `pinned-note` by the new id in `src/` and `tests/` (Sonar names the tool `<id>_read`). Run `bun install` once, without `--frozen-lockfile`: it writes `bun.lock` again. Then `bun run check`, `bun test` and `bun run build`. Publish a GitHub release with the two files of `release/`, `extension.json` and `extension.tar.gz`: it installs by `owner/repository`.

## Install it in Sonar

In Sonar: Settings › Extensions › Add, then `Krosnoz/sonar-extensions/pinned-note`. Sonar shows its card, then installs it switched off. Switch it on: it runs from Sonar's next start.

## Publish it

Set the `version` in `extension.json`. The next release of the repository publishes it with the other extensions: see the repository's [README](../README.md).

## License

MIT
