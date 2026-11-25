// `bun run build`: writes dist/, the extension's folder as Sonar lays it (its card, its server entry, its page entry and
// the parts of the build it imports later, its sheet, its images and sounds), then release/, the two files of a GitHub release:
// extension.tar.gz (dist/ packed here) and extension.json (the card, with the archive's SHA-256). Sonar builds nothing
// and installs no dependency. Runs on Windows, macOS and Linux, without the system's tar.

import { copyFileSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";

const root = join(import.meta.dir, "..");
const dist = join(root, "dist");
const release = join(root, "release");
rmSync(dist, { recursive: true, force: true });
rmSync(release, { recursive: true, force: true });
mkdirSync(release, { recursive: true });

const source = JSON.parse(readFileSync(join(root, "extension.json"), "utf8"));

// The page entry runs in the browser. Split at each `import()`: three.js and the town are parts of their own, loaded at
// the first touch of the town's icon (src/toggle.ts), never with the entry at the page's start. Each part is fetched
// beside the entry (/ext/<id>/<part>), so the card names them in `files`, with their hash.
const built = await Bun.build({ entrypoints: [join(root, "src/page.ts")], outdir: dist, target: "browser", format: "esm", splitting: true, minify: true });
if (!built.success) throw new AggregateError(built.logs, "Could not build src/page.ts");
const entry = built.outputs.find((output) => output.kind === "entry-point");
if (!entry || basename(entry.path) !== source.page) throw new Error(`The page entry is not ${source.page}.`);
const parts = built.outputs.filter((output) => output.kind === "chunk").map((output) => basename(output.path)).sort();

// The server entry runs in Sonar's server (Bun): one file, Node's modules left as imports.
const server = await Bun.build({ entrypoints: [join(root, "src/server.ts")], outdir: dist, target: "node", format: "esm", minify: true });
if (!server.success) throw new AggregateError(server.logs, "Could not build src/server.ts");
if (server.outputs.length !== 1 || basename(server.outputs[0]!.path) !== source.server) throw new Error(`The server entry is not ${source.server} alone.`);

// The icon, the images and the sounds the card names, from assets/.
copyFileSync(join(root, "src/page.css"), join(dist, source.styles));
for (const path of [source.icon, ...source.files] as string[]) {
	mkdirSync(join(dist, dirname(path)), { recursive: true });
	copyFileSync(join(root, "assets", path), join(dist, path));
}
const card = { ...source, files: [...parts, ...source.files] };
writeFileSync(join(dist, "extension.json"), `${JSON.stringify(card, null, "\t")}\n`);

// The archive is written here, so that two builds of the same files give the same bytes on one system: a ustar entry
// per file of dist/, in the order of their paths, dated 0, owned by 0, mode 644, no folder entry (Sonar makes the
// folders). The system's tar would keep each file's date and the folder's order. Bun.gzipSync writes no date; its
// header names the system it ran on.
const encoder = new TextEncoder();
const blocks: Uint8Array[] = [];
const files = (readdirSync(dist, { recursive: true }) as string[])
	.filter((path) => statSync(join(dist, path)).isFile())
	.map((path) => path.replaceAll("\\", "/"))
	.sort();
for (const path of files) {
	const body = readFileSync(join(dist, path));
	const name = encoder.encode(path);
	if (name.length > 100) throw new Error(`${path}: a path of over 100 bytes does not fit a ustar header.`);
	const header = new Uint8Array(512);
	const field = (at: number, value: string) => header.set(encoder.encode(value), at);
	header.set(name, 0);
	field(100, "0000644\0");
	field(108, "0000000\0");
	field(116, "0000000\0");
	field(124, `${body.length.toString(8).padStart(11, "0")}\0`);
	field(136, "00000000000\0");
	field(148, "        ");
	field(156, "0");
	field(257, "ustar\0");
	field(263, "00");
	field(148, `${header.reduce((sum, byte) => sum + byte, 0).toString(8).padStart(6, "0")}\0 `);
	blocks.push(header, body, new Uint8Array((512 - (body.length % 512)) % 512));
}
blocks.push(new Uint8Array(1024));
const archive = Bun.gzipSync(Buffer.concat(blocks));
writeFileSync(join(release, "extension.tar.gz"), archive);

// No sha256sum assumed: the digest is computed here, in lower case hexadecimal.
const sha256 = new Bun.CryptoHasher("sha256").update(archive).digest("hex");
writeFileSync(join(release, "extension.json"), `${JSON.stringify({ ...card, sha256 }, null, "\t")}\n`);

const kib = (bytes: number) => `${(bytes / 1024).toFixed(1)} KiB`;
const partsSize = parts.reduce((sum, part) => sum + statSync(join(dist, part)).size, 0);
console.log(
	`${card.id} ${card.version}: dist/ and release/ written, sha256 ${sha256}\n` +
		`  ${source.page} ${kib(statSync(join(dist, source.page)).size)}, ${parts.length} parts ${kib(partsSize)}, ${source.server} ${kib(statSync(join(dist, source.server)).size)}, archive ${kib(archive.length)}`,
);
