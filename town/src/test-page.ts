// The page the town's modules read on import (./shapes.ts, ../state.ts), for the tests that build the town without a
// browser. Bun runs these tests in one process and imports each module once: a file that stubbed the page another way
// set the town's style for every file after it, and a test of the city found none of its shop windows (12/11).
const page = globalThis as Record<string, unknown>;
page["localStorage"] ??= { getItem: () => null };
page["location"] ??= { href: "http://127.0.0.1/" };
