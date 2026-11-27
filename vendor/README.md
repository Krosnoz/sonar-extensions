# vendor/sonar-extension

An exact copy of `packages/extension/` of Sonar's repository, as it was on 2026-11-27 (with a card's `files`, the page's `map`, `look`, `sounds`, `session` and `openSession`, the server's `projects.left`, `projects.forget` and `keys.trial` (with the project names it gets, and the `reaches` and `outside` it answers), and the ports `tickets` and `codeHost`): the contract between Sonar and an extension (`@sonar/extension`) and its testing kit (`@sonar/extension/testing`). It has no dependency.

The contract is not published on npm yet. Until it is, every extension of this repository links this one copy by `"@sonar/extension": "file:../vendor/sonar-extension"` in its `package.json`. Once it is published, remove this folder and depend on the published package.

Do not change these files: copy them again from Sonar's repository when the contract changes, then run `bun run setup` at the root.
