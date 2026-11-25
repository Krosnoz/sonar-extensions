// The page the signs' modules read on import, for their tests (./signs-leads.test.ts, ./inhabitant-names.test.ts).
// The modules read matchMedia, document and localStorage on import: they are stubbed. ../test-page.ts sets other keys
// of the page than these: imported first, it changes nothing.
import "../test-page";

const g = globalThis as Record<string, unknown>;
g["matchMedia"] = () => ({ matches: false, addEventListener() {}, addListener() {} });
const fake = (): unknown =>
	new Proxy(function () {}, {
		get: (_, key) => (key === "dataset" || key === "style" || key === "classList" ? {} : fake()),
		apply: () => fake(),
		set: () => true,
	});
g["document"] = { documentElement: { dataset: {} }, createElement: fake, body: fake(), addEventListener() {}, querySelector: fake };
g["window"] = g;
