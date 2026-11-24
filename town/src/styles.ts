// The styles of a town (family of houses, palette, trees, monument), and the one a project's town takes.
import { styleKept } from "./style-kept";

// The styles' names, as a project's settings keep them (WorldStyle of Sonar's domain): the town brings its own.
export type WorldStyle = "riverside" | "brick" | "sun" | "neon" | "fjord" | "oasis";

export type Style = {
	name: WorldStyle;
	walls: string[];
	trims: string[];
	roofs: string[];
	roof: "mansard" | "flat" | "tiles" | "mixed" | "steep" | "terrace";
	glass: string;
	trees: number[];
	landmark: "lattice" | "clock" | "deco" | "pagoda" | "spire" | "dome";
	accent: string;
	low?: boolean;
};

export const STYLES: Style[] = [
	{
		name: "riverside",
		walls: ["#ead9bd", "#f0e3cc", "#dfcaa8", "#c9b79a", "#e2c7b4", "#b8a48a", "#f3e8d6"],
		trims: ["#fbf6ec", "#efe6d4"],
		// Five soft hues, one in five a slate: slate, tile, grey zinc, verdigris and taupe share a row of houses (all dull, never
		// loud); the other styles keep that share.
		roofs: ["#7a8798", "#b0674c", "#8d949c", "#6f9a8c", "#a48c74"],
		roof: "mansard",
		glass: "#3d4f66",
		trees: [0, 0, 2],
		landmark: "lattice",
		accent: "#8a6a4a",
	},
	{
		name: "brick",
		walls: ["#b8715a", "#a8654f", "#c58a6a", "#cfae8a", "#9c6558", "#dcc3a2", "#e9dcc6"],
		trims: ["#efe3cf", "#d8c6a8"],
		roofs: ["#7a8798", "#9a8f86", "#8d949c", "#a85f48", "#7f8f76"],
		roof: "flat",
		glass: "#33445a",
		trees: [0, 0, 1],
		landmark: "deco",
		accent: "#c9a24a",
	},
	{
		name: "sun",
		walls: ["#f2dcb8", "#ebc79f", "#e2b08a", "#d99a82", "#e6c37a", "#a9c7b8", "#e3b5ab", "#cfe0e6", "#f6e7cd"],
		trims: ["#fff8ec", "#f3e6cf"],
		roofs: ["#c47a5a", "#b86f52", "#d08a64"],
		roof: "tiles",
		glass: "#3e5a72",
		trees: [0, 2, 0],
		landmark: "clock",
		accent: "#d9b36a",
	},
	{
		name: "neon",
		walls: ["#cfccc6", "#b9c3cb", "#e9dcc6", "#d6b9a2", "#9fb3c2", "#e3b897", "#a5bccd", "#e7e2d8"],
		trims: ["#f4f2ee", "#d9d6d0"],
		roofs: ["#6f7d90", "#b0674c", "#8d949c", "#6f9a8c", "#8d7f9a"],
		roof: "mixed",
		glass: "#2f4a63",
		trees: [2, 2, 0],
		landmark: "pagoda",
		accent: "#d8453a",
	},
	{
		name: "fjord",
		walls: ["#c9826f", "#e3c58a", "#6f93aa", "#f4f1de", "#7fa08a", "#d9a283", "#a8767a", "#e8d9b0"],
		trims: ["#fbf8ef", "#f1ead8"],
		roofs: ["#6d7a8c", "#a85f48", "#7b6a62", "#6f9a8c", "#b59a72"],
		roof: "steep",
		glass: "#33475b",
		trees: [1, 1, 0],
		landmark: "spire",
		low: true,
		accent: "#c9bfae",
	},
	{
		name: "oasis",
		walls: ["#f6f1e6", "#efe4cf", "#e8d3b0", "#f3ead9", "#dcc29a", "#f8f5ee", "#cfe3e8"],
		trims: ["#ffffff", "#f4ede0"],
		roofs: ["#e9dcc4", "#e2d2b5"],
		roof: "terrace",
		glass: "#2e5f7a",
		trees: [0, 0, 2],
		landmark: "dome",
		accent: "#3f8fa8",
	},
];

// FNV-1a: two close names fall far apart.
const hash = (text: string): number => Array.from(text).reduce((h, c) => Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0, 2166136261);
// The style of the project's town: the one its settings keep (./style-kept.ts); one its name picks while the server
// cannot be read, so that the town still opens.
export const styleFor = (name: string): Style => {
	const kept = styleKept(name);
	return STYLES.find((each) => each.name === kept) ?? STYLES[hash(name) % STYLES.length]!;
};
