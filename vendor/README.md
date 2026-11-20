# vendor/sonar-extension

An exact copy of `packages/extension/` of Sonar's repository, at commit `5dc845bac595fde33f51b33326a5a6e7b7f9b413`: the contract between Sonar and an extension (`@sonar/extension`) and its testing kit (`@sonar/extension/testing`). It has no dependency.

The contract is not published on npm yet. Until it is, every extension of this repository links this one copy by `"@sonar/extension": "file:../vendor/sonar-extension"` in its `package.json`. Once it is published, remove this folder and depend on the published package.

Do not change these files: copy them again from Sonar's repository when the contract changes, then run `bun run setup` at the root.
