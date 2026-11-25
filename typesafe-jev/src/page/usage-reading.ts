// How Jev's part of Services (./services.ts) reads its usage: over the period kept in this browser, the newest reading's
// answer only, and again while the part shows.
//
// While the part shows, its usage is read again every 10 s, as the plugin's is drawn again at each usage Sonar sends,
// and at once when Jev switches itself off: the cost changes in place, without the dots of a first reading. A step of
// its own rather than a message of the server at each judgment: nothing is sent while no page shows the part, and it
// stops once the part left, or once its node left the screen (its extension cut, without a leave). It waits while the
// page is hidden, and reads at once when it shows again; a step reads nothing while the group is folded.

import type { PageApi } from "@sonar/extension";
import type { UsageReport } from "../shared/cost";
import type { Kit } from "./kit";
import { stopText } from "./live";
import { newest } from "./newest";

export const PERIODS = ["1", "7", "30"] as const;
type Period = (typeof PERIODS)[number];
// The period shown, kept in this browser: 7 days unless another was chosen.
const PERIOD = "period";
const REREAD_MS = 10_000;

export type UsageReading = ReturnType<typeof usageReading>;

// `draw`: the figures of a report, drawn again in place when a reading brings another one.
export function usageReading(api: PageApi, kit: Kit, draw: (report: UsageReport) => HTMLElement[]) {
	const { http, storage } = api;
	const period = (): Period => {
		const kept = storage.read(PERIOD);
		return kept === "1" || kept === "30" ? kept : "7";
	};
	// The newest reading's answer: a period left quickly does not draw under the one chosen.
	const read = newest(async () => (await http.get("/usage", { days: period() })) as UsageReport);

	// The figures shown, while the part shows, and the report they draw: one that did not change is not drawn again, so
	// that the bar being read keeps its reading.
	let shown: { readonly place: HTMLElement; drawn: string } | null = null;
	const drawIn = (place: HTMLElement, report: UsageReport): HTMLElement[] => {
		shown = { place, drawn: JSON.stringify(report) };
		return draw(report);
	};

	// The reading again of the part `part`, from `start` (its enter) to `stop` (its leave).
	const again = (part: HTMLElement) => {
		// From start to stop; the steps go on while the first reading is still on its way.
		let entered = false;
		let timer: ReturnType<typeof setTimeout> | undefined;
		const pause = () => {
			clearTimeout(timer);
			timer = undefined;
		};
		// The page hidden (another tab, the phone's screen off), no step waits; shown again, a reading at once.
		const pageShown = () => globalThis.document?.visibilityState !== "hidden";
		// Its own node not drawn: its group folded, or the settings closed. The contract does not tell a part its
		// group's fold; the browser says whether the part's own node is drawn, without a look at the core's.
		const drawn = () => typeof part.checkVisibility !== "function" || part.checkVisibility();
		const stop = () => {
			entered = false;
			pause();
			shown = null;
			globalThis.document?.removeEventListener("visibilitychange", onVisibility);
		};
		// Read again in place; a failure keeps what shows, and the next step tries again.
		const reread = async () => {
			if (!entered) return;
			if (!part.isConnected) return stop();
			if (!shown || !drawn()) return;
			const report = await read().catch(() => null);
			const now = shown;
			if (!report || !now || !now.place.isConnected || JSON.stringify(report) === now.drawn) return;
			now.place.replaceChildren(...drawIn(now.place, report));
		};
		const step = () => {
			pause();
			if (!pageShown()) return;
			timer = setTimeout(() => {
				void reread().then(() => entered && step());
			}, REREAD_MS);
		};
		function onVisibility() {
			if (!pageShown()) return pause();
			void reread();
			step();
		}
		api.live.on((data) => {
			if (stopText(data, kit.texts) !== null) void reread();
		});
		return {
			start: () => {
				entered = true;
				globalThis.document?.addEventListener("visibilitychange", onVisibility);
				step();
			},
			stop,
		};
	};

	return { period, choose: (id: string) => storage.write(PERIOD, id), read, drawIn, again };
}
