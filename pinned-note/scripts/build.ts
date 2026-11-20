// `bun run build`: writes dist/, the extension's folder as Sonar lays it (its card, its entries bundled, its sheet and
// its icon), then release/, the two files of a GitHub release: extension.tar.gz (dist/ packed by the system's tar) and
// extension.json (the card, with the archive's SHA-256). Sonar builds nothing and installs no dependency: each entry
// is one file, its imports bundled. Runs on Windows, macOS and Linux. TAR names another tar program than "tar".

import { copyFileSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dir, "..");
const dist = join(root, "dist");
const release = join(root, "release");
rmSync(dist, { recursive: true, force: true });
rmSync(release, { recursive: true, force: true });
mkdirSync(release, { recursive: true });

const card = JSON.parse(readFileSync(join(root, "extension.json"), "utf8"));

// The server entry runs in Sonar's server (Bun): Node's modules stay imports. The page entry runs in the browser.
for (const [entry, target] of [
	["src/server.ts", "node"],
	["src/page.ts", "browser"],
] as const) {
	const built = await Bun.build({ entrypoints: [join(root, entry)], outdir: dist, target, format: "esm" });
	if (!built.success) throw new AggregateError(built.logs, `Could not build ${entry}`);
}
copyFileSync(join(root, "src/page.css"), join(dist, card.styles));
copyFileSync(join(root, "src/icon.svg"), join(dist, card.icon));
writeFileSync(join(dist, "extension.json"), `${JSON.stringify(card, null, "\t")}\n`);

// The archive's root is the extension's root. Relative paths: GNU tar reads "C:\…" as a remote host. Its entries are
// owned by 0, never by the name of the account that built it; GNU tar (Linux, Git Bash) and bsdtar (Windows, macOS) say
// so with their own options. COPYFILE_DISABLE keeps macOS's tar from adding "._" files.
const tar = process.env["TAR"] ?? "tar";
const version = Bun.spawnSync([tar, "--version"]).stdout.toString().split("\n")[0] ?? "";
const owner = version.includes("GNU tar") ? ["--owner=0", "--group=0", "--numeric-owner"] : ["--uid", "0", "--gid", "0", "--uname", "", "--gname", ""];
const archive = join(release, "extension.tar.gz");
const packed = Bun.spawnSync([tar, ...owner, "-czf", "release/extension.tar.gz", "-C", "dist", "."], {
	cwd: root,
	env: { ...process.env, COPYFILE_DISABLE: "1" },
	stderr: "inherit",
});
if (packed.exitCode !== 0) throw new Error(`${tar} failed with code ${packed.exitCode}`);

// No sha256sum assumed: the digest is computed here, in lower case hexadecimal.
const sha256 = new Bun.CryptoHasher("sha256").update(readFileSync(archive)).digest("hex");
writeFileSync(join(release, "extension.json"), `${JSON.stringify({ ...card, sha256 }, null, "\t")}\n`);

console.log(`${card.id} ${card.version}: dist/ and release/ written, packed by ${version}, sha256 ${sha256}`);
