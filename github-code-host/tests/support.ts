// What the tests share: the extension started on the contract's kit against a fake GitHub, with a key for the projects
// "shop" and "bare" alone.

import { readFileSync } from "node:fs";
import { fakeServer } from "@sonar/extension/testing";
import { startGitHub } from "../src/server";
import { fakeGitHub } from "./fake-github";
import { folderWith } from "./folders";

export const card = JSON.parse(readFileSync(new URL("../extension.json", import.meta.url), "utf8"));

export const TOKEN = "example-token";

// A new bench and the code host it filled. `host` is the kit's, called as Sonar calls it: an answer Sonar would refuse
// fails the test. The project "shop" has the repository acme/shop; "bare" has a key and no remote; "keyless" has a
// repository and no key.
export async function started(language: "en" | "fr" = "en") {
	const github = fakeGitHub();
	const bench = fakeServer({ card, language });
	bench.setKey("token", TOKEN, "shop");
	bench.setKey("token", TOKEN, "bare");
	bench.projects.push(
		{ name: "shop", folder: folderWith("https://github.com/acme/shop.git") },
		{ name: "bare", folder: folderWith() },
		{ name: "keyless", folder: folderWith("git@github.com:acme/keyless.git") },
	);
	await bench.start((api) => startGitHub(api, github.send));
	const host = bench.codeHost();
	if (!host) throw new Error("The extension filled no code host provider.");
	return { bench, github, host };
}

// What a call rejects with; it fails the test when the call answers.
export const failureOf = (call: Promise<unknown>): Promise<Error> =>
	call.then(
		() => {
			throw new Error("The call answered.");
		},
		(error: Error) => error,
	);
