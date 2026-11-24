// The town's sound: a short sound for each true event of the open town seen on the screen, silence otherwise, and no
// sound under it. Each is one of Sonar's sounds (../sounds/sounds.ts), played lower than a moment's and tuned on C's
// five notes, the key of Sonar's own sounds: two sounds heard together never clash. It is placed left or right where
// its event shows, and quieter seen from far. What the screen does not show is not heard.
// Nothing is made up: the town tells the ear only what it plays (./live-steps.ts, ./plot.ts, ./site-jobs.ts,
// ./scaffolds.ts), never what it lays at once. The ear follows Sonar's sounds as the API says them (PageApi's
// `sounds`): their switch, the switch of its line (./sound-lines.ts) and the tab that plays them, their volume, and an
// audio context the user woke: a sound that cannot play now is not kept for later.
import type { TownLine } from "./sound-lines";
import type { Size } from "./size";
import type { Project } from "./view-frames";

type Point = [number, number, number];
// `laid`: bricks land. `site`: a scaffold stands for bricks to lay, a new building's or a merge's; `frame`: one stands
// for a pull request.
export type Kind = "laid" | "merged" | "built" | "site" | "frame" | "red" | "born" | "left";
type Context = Pick<BaseAudioContext, "state" | "currentTime" | "destination" | "createBufferSource" | "createGain" | "createStereoPanner">;
// What the ear plays with: the page's audio context, a sound's file decoded, whether a line plays now (the sounds on,
// the line not cut, this tab the one that plays), the sounds' volume, the clock in seconds, and the draws of the
// bricks' beat.
export type Hearing = {
	context: Context;
	buffer: (file: string) => Promise<AudioBuffer>;
	plays: (line: TownLine) => boolean;
	volume: () => number;
	now: () => number;
	random: () => number;
};
// A note: the seconds it plays after its sound's first one, how fast the file is read (its pitch), and its loudness.
type Note = { after: number; rate: number; gain: number };
// A sound: its file, the clock's second its first note plays at, its place from left (-1) to right (1), its notes, and
// whether it may still play once its file is there.
type Sound = { file: string; from: number; pan: number; notes: Note[]; still: () => boolean };
type Shape = { file: string; base: number; gain: number; notes: [number, number][] };

// The files' own pitch (their loudest frequency, measured), and the pitch of C4.
const [WOOD, PLUCK, BUBBLE, C4] = [330, 588, 642, 261.63];
// C's five notes over two octaves, in semitones over C4.
const SCALE = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21];
// A scaffold stands: two knocks.
const STANDS: Shape = {
	file: "wood-tap",
	base: WOOD,
	gain: 0.24,
	notes: [
		[0, 0],
		[0.14, 0],
	],
};
// Each event: its file, its pitch, its loudness beside a moment's sound (1), and its notes ([seconds, semitones over C4]).
const SOUNDS: Record<Exclude<Kind, "laid">, Shape> = {
	// A merge is in the building: two notes up. A storey or a building is done: four.
	merged: {
		file: "pluck",
		base: PLUCK,
		gain: 0.3,
		notes: [
			[0, 16],
			[0.11, 19],
		],
	},
	built: {
		file: "pluck",
		base: PLUCK,
		gain: 0.32,
		notes: [
			[0, 12],
			[0.1, 16],
			[0.2, 19],
			[0.3, 24],
		],
	},
	// A scaffold stands, for bricks or for a pull request: the same knocks. Its tests fail: two lower ones.
	site: STANDS,
	frame: STANDS,
	red: {
		file: "wood-tap",
		base: WOOD,
		gain: 0.24,
		notes: [
			[0, -8],
			[0.17, -10],
		],
	},
	// An inhabitant comes, or leaves.
	born: { file: "bubble", base: BUBBLE, gain: 0.26, notes: [[0, 19]] },
	left: { file: "bubble", base: BUBBLE, gain: 0.2, notes: [[0, 12]] },
};
// The line of the settings each event plays under.
const LINES: Record<Kind, TownLine> = {
	laid: "town-bricks",
	merged: "town-merges",
	built: "town-merges",
	// A scaffold without a pull request is the building site's: cutting "a pull request in test" leaves it heard.
	site: "town-bricks",
	frame: "town-pulls",
	red: "town-pulls",
	born: "town-people",
	left: "town-people",
};
// The bricks laid are heard on a beat, one a slot at most, and one slot in four stays silent: 700 bricks land in 3 s.
// A knock's loudness, from 0.7 to 1.2 of it.
const [SLOT, REST, BRICK] = [0.095, 0.25, 0.17];
// A metre's pixels at the nearest level: there a sound is whole; from the whole town, a third of it.
const [NEAR, FAR] = [36, 0.34];
// How far left or right a sound goes at the screen's edge.
const PAN = 0.7;
// A sound whose file came later than this after its time is not played, none of its notes: no sound waits, and a
// sound is never heard cut of its first notes.
const LATE = 0.25;
// A town whose last frame is older than this was frozen (its tab hidden, another view shown): what its first frame
// plays of the time it missed is not heard.
const FROZEN = 0.25;
// What the settings play to hear a line: its events, at their seconds.
const EXAMPLES: Record<TownLine, [Kind, number][]> = {
	"town-bricks": [0, 1, 2, 3, 4, 5].map((at): [Kind, number] => ["laid", at * SLOT * 1.5]),
	"town-merges": [
		["merged", 0],
		["built", 0.6],
	],
	"town-pulls": [
		["frame", 0],
		["red", 0.6],
	],
	"town-people": [
		["born", 0],
		["left", 0.5],
	],
};

// A path among the extension's files (its card's `files`): the ear fetches it beside its own module (./town-ear.ts).
const fileOf = (name: string): string => `sounds/${name}.mp3`;
const rateOf = (semitones: number, base: number): number => (C4 * 2 ** (semitones / 12)) / base;
// A brick's note, higher as its building rises: `high` from 0 at its foot to 1 at its top, `random` a draw.
const knockOf = (high: number, random: number): number =>
	SCALE[Math.min(SCALE.length - 1, Math.max(0, Math.round(high * (SCALE.length - 1) + random * 2 - 1)))]!;

// A sound through its gain and its place, at its time: its file is decoded once, then played from memory. Whole or not
// at all: a file that comes too late, or after its town is gone, plays none of its notes.
function sounds(given: Hearing, { file, from, pan, notes, still }: Sound): void {
	void given.buffer(file).then(
		(buffer) => {
			const { context } = given;
			const late = given.now() - from;
			if (late > LATE || !still()) return;
			for (const note of notes) {
				const source = context.createBufferSource();
				source.buffer = buffer;
				source.playbackRate.value = note.rate;
				const gain = context.createGain();
				gain.gain.value = note.gain;
				const place = context.createStereoPanner();
				place.pan.value = pan;
				source.connect(gain).connect(place).connect(context.destination);
				// A file a little late moves its whole sound: its notes keep their gaps.
				source.start(context.currentTime + Math.max(0, -late) + note.after);
			}
		},
		// A file that cannot be read is no reason to fail: nothing is heard.
		() => undefined,
	);
}

// An event's sound from the clock's second `from`, `loud` times its own loudness.
function line(given: Hearing, kind: Exclude<Kind, "laid">, from: number, loud: number, pan: number, still: () => boolean): void {
	const { file, base, gain, notes } = SOUNDS[kind];
	sounds(given, {
		file: fileOf(file),
		from,
		pan,
		still,
		notes: notes.map(([after, semitones]) => ({ after, rate: rateOf(semitones, base), gain: gain * loud })),
	});
}

// A brick's knock at the clock's second `at`, `high` up its building.
function knock(given: Hearing, at: number, high: number, loud: number, pan: number, still: () => boolean): void {
	const note = { after: 0, rate: rateOf(knockOf(high, given.random()), WOOD), gain: BRICK * (0.7 + given.random() * 0.5) * loud };
	sounds(given, { file: fileOf("wood-tap"), from: at, pan, still, notes: [note] });
}

const always = (): boolean => true;

export function ear(given: Hearing) {
	// The town's last frame: where its points show, its screen, and the clock's second it was drawn at. Null before its
	// first frame, and once it is gone. Kept as it is given: a frame that plays nothing computes nothing.
	let shown: { project: Project; size: Size; at: number } | null = null;
	// The bricks' last slot heard, and each event's: forty sessions that open together are a few sounds, not forty.
	let slot = 0;
	const slots = new Map<Kind, number>();
	// How many towns were closed: a sound asked of one that is gone since does not play.
	let gone = 0;

	// An event at `at` is heard: its place, how near, and the volume of the sounds; null when it is not. What costs
	// least is read first: bricks ask at each frame they land.
	function placed(kind: Kind, at: Point): { pan: number; loud: number } | null {
		if (!shown || given.now() - shown.at > FROZEN || given.context.state !== "running" || !given.plays(LINES[kind])) return null;
		const { project, size } = shown;
		const [x, y] = project(at);
		if (x < 0 || x > size.width || y < 0 || y > size.height) return null;
		const [[x0, y0], [x1, y1]] = [project([0, 0, 0]), project([0, 1, 0])];
		const near = Math.min(1, Math.max(FAR, Math.sqrt(Math.hypot(x1 - x0, y1 - y0) / NEAR)));
		return { pan: ((x / size.width) * 2 - 1) * PAN, loud: near * given.volume() };
	}
	// A sound asked now plays if, once its file is there, its town still is and the audio still runs.
	const lasting = (): (() => boolean) => {
		const asked = gone;
		return () => asked === gone && given.context.state === "running";
	};

	return {
		// An event of the town at a place: its sound, if the screen shows that place. One of a kind a slot.
		heard(kind: Exclude<Kind, "laid">, at: Point): void {
			const now = given.now();
			const next = Math.floor(now / SLOT);
			if (slots.get(kind) === next) return;
			const where = placed(kind, at);
			if (!where) return;
			slots.set(kind, next);
			line(given, kind, now, where.loud, where.pan, lasting());
		},
		// Bricks land at a place, `high` up their building (0 at its foot, 1 at its top): one knock on the beat's next
		// slot, its note higher as the building rises. A slot is asked once, heard or not.
		laid(at: Point, high: number): void {
			const next = Math.ceil(given.now() / SLOT) * SLOT;
			if (next <= slot) return;
			slot = next;
			const where = placed("laid", at);
			if (!where || given.random() < REST) return;
			knock(given, next, high, where.loud, where.pan, lasting());
		},
		// Each frame of the town, after what it plays: where its points show now.
		frame(project: Project, size: Size): void {
			shown ??= { project, size, at: 0 };
			[shown.project, shown.size, shown.at] = [project, size, given.now()];
		},
		// The town is gone: nothing is heard until its next frame, and what was asked of it does not play.
		quiet(): void {
			shown = null;
			gone++;
		},
		// A line's sounds as the settings play them to hear it: in the middle, near, at the sounds' volume, whatever
		// its switches; the user's touch woke the audio.
		example(townLine: TownLine): void {
			const [from, volume] = [given.now(), given.volume()];
			for (const [kind, after] of EXAMPLES[townLine])
				if (kind === "laid") knock(given, from + after, after / (SLOT * 7.5), volume, 0, always);
				else line(given, kind, from + after, volume, 0, always);
		},
	};
}
