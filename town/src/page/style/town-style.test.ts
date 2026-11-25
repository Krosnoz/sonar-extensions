// The style the page builds a project's town in (./town-style.ts), read by the extension's route: the one kept, else
// the draw asked once; none when the route fails, and the town then takes its style from the project's name.

import { expect, test } from "bun:test";
import type { Json, PageApi } from "@sonar/extension";
import { hold } from "../sonar/sonar";
import { townStyle } from "./town-style";

type Route = (path: string, data?: unknown) => Promise<Json>;
const calls: string[] = [];
let answers: { get: Route; post: Route } = { get: async () => null, post: async () => null };

// The API the entry is given, its routes answered by `answers`. The Map shows no project, and floats nothing, as
// before the start: the other tests of this process read it so.
hold({
	map: { shown: () => ({ on: false, project: null }), hide: () => {}, floating: () => [] },
	look: {},
	sounds: {},
	session: () => null,
	openSession: () => {},
	http: {
		get: (path: string, query?: Record<string, string>) => (calls.push(`GET ${path} ${query?.["project"]}`), answers.get(path, query)),
		post: (path: string, body?: Json) => (calls.push(`POST ${path} ${JSON.stringify(body)}`), answers.post(path, body)),
	},
} as unknown as PageApi);

const refused = async (): Promise<Json> => {
	throw new Error("No route");
};

test("the style the route keeps, read once per project", async () => {
	calls.length = 0;
	answers = { get: async () => ({ style: "neon", drawn: "sun" }), post: refused };
	expect(await townStyle("kept")).toBe("neon");
	expect(await townStyle("kept")).toBe("neon");
	expect(calls).toEqual(["GET /style kept"]);
});

test("a project drawn but not chosen shows its draw", async () => {
	answers = { get: async () => ({ style: null, drawn: "fjord" }), post: refused };
	expect(await townStyle("drawn")).toBe("fjord");
});

test("a project without a style asks the draw, once", async () => {
	calls.length = 0;
	answers = { get: async () => ({ style: null, drawn: null }), post: async () => ({ style: null, drawn: "oasis" }) };
	expect(await townStyle("new")).toBe("oasis");
	expect(await townStyle("new")).toBe("oasis");
	expect(calls).toEqual(["GET /style new", 'POST /style {"project":"new","style":"automatic"}']);
});

test("a route that fails gives none, and the next opening asks again", async () => {
	calls.length = 0;
	answers = { get: refused, post: refused };
	expect(await townStyle("failing")).toBeUndefined();
	answers = { get: async () => ({ style: null, drawn: null }), post: refused };
	expect(await townStyle("failing")).toBeUndefined();
	answers = { get: async () => ({ style: "brick", drawn: null }), post: refused };
	expect(await townStyle("failing")).toBe("brick");
	expect(calls).toEqual(["GET /style failing", "GET /style failing", 'POST /style {"project":"failing","style":"automatic"}', "GET /style failing"]);
});

test("an answer that is no style gives none", async () => {
	answers = { get: async () => ({ style: "castle", drawn: null }), post: refused };
	expect(await townStyle("odd")).toBeUndefined();
});
