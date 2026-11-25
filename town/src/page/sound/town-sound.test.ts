// The town's sound (./town-sound.ts): a short sound for each event the town plays where the screen shows it, at the
// sounds' volume, quieter from far, never off the screen, never cut, never from a tab that does not play the sounds,
// never before the user woke the audio. No browser: a fake audio context records each note it is asked to play. What
// each part of the town tells the ear, and that it tells nothing of what it lays at once, is the parts' own tests'
// (../sites/scaffolds.test.ts, ../people/live.test.ts, ../sites/plot.test.ts, ../sites/sites.test.ts).
import { expect, test } from "bun:test";
import type { Project } from "../camera/view-frames";
import { ear, type Hearing, type Kind } from "./town-sound";

// A note as the fake context played it: its file, its second on the page's clock, its rate, its loudness, its place,
// and whether it went through its gain and its place to the speakers.
type Played = { file: string; at: number; rate: number; gain: number; pan: number; wired: boolean };
type Point = [number, number, number];

const C4 = 261.63;
const SIZE = { width: 1000, height: 800, left: 0, top: 0 };
// A camera that shows `perMetre` pixels a metre, the town's origin in the middle of the screen.
const camera =
	(perMetre: number): Project =>
	([x, y]) => [500 + x * perMetre, 400 - y * perMetre];

// An ear on a fake context, at the page's second 100. `given` changes what it reads.
function earOf(given: Partial<Hearing> = {}) {
	const played: Played[] = [];
	const asked: string[] = [];
	const clock = { now: 100, state: "running" as AudioContextState };
	const destination = { speakers: true };
	const node = <T extends object>(made: T) => {
		const wired = { next: null as unknown };
		return Object.assign(made, { connect: (next: unknown) => ((wired.next = next), next), wired });
	};
	const context = {
		get state() {
			return clock.state;
		},
		get currentTime() {
			return clock.now - 90;
		},
		destination,
		createBufferSource: () => {
			const source = node({ buffer: null as unknown, playbackRate: { value: 1 }, start: (at: number) => void at });
			source.start = (at: number) => {
				const gain = source.wired.next as { gain: { value: number }; wired: { next: { pan: { value: number }; wired: { next: unknown } } } };
				const pan = gain.wired.next;
				played.push({
					file: (source.buffer as { file: string }).file,
					at: at + 90,
					rate: source.playbackRate.value,
					gain: gain.gain.value,
					pan: pan.pan.value,
					wired: pan.wired.next === destination,
				});
			};
			return source;
		},
		createGain: () => node({ gain: { value: 1 } }),
		createStereoPanner: () => node({ pan: { value: 0 } }),
	} as unknown as Hearing["context"];
	// The sounds' settings on this device, as the page's API reads them for a line (PageApi's `sounds`).
	const settings = { on: true, volume: 1, off: [] as string[] };
	const heard = ear({
		context,
		buffer: (file) => {
			asked.push(file);
			return Promise.resolve({ file } as unknown as AudioBuffer);
		},
		plays: (line) => settings.on && !settings.off.includes(line),
		volume: () => settings.volume,
		now: () => clock.now,
		random: () => 0.5,
		...given,
	});
	// The files decoded: their notes are played.
	const decoded = (): Promise<void> => new Promise((resolve) => setImmediate(resolve));
	return { heard, played, asked, clock, settings, decoded };
}

const MIDDLE: Point = [0, 0, 0];
const rate = (semitones: number, base: number): number => (C4 * 2 ** (semitones / 12)) / base;
const round = (value: number): number => Math.round(value * 1000) / 1000;
const notes = (played: Played[]) =>
	played.map((note) => ({ ...note, at: round(note.at), rate: round(note.rate), gain: round(note.gain), pan: round(note.pan) }));

test("each event plays its notes of Sonar's sounds, tuned on C, through its gain and its place to the speakers", async () => {
	const expected: Record<Exclude<Kind, "laid">, [string, number, number, [number, number][]]> = {
		merged: [
			"pluck",
			588,
			0.3,
			[
				[0, 16],
				[0.11, 19],
			],
		],
		built: [
			"pluck",
			588,
			0.32,
			[
				[0, 12],
				[0.1, 16],
				[0.2, 19],
				[0.3, 24],
			],
		],
		site: [
			"wood-tap",
			330,
			0.24,
			[
				[0, 0],
				[0.14, 0],
			],
		],
		frame: [
			"wood-tap",
			330,
			0.24,
			[
				[0, 0],
				[0.14, 0],
			],
		],
		red: [
			"wood-tap",
			330,
			0.24,
			[
				[0, -8],
				[0.17, -10],
			],
		],
		born: ["bubble", 642, 0.26, [[0, 19]]],
		left: ["bubble", 642, 0.2, [[0, 12]]],
	};
	for (const [kind, [file, base, gain, line]] of Object.entries(expected) as [Exclude<Kind, "laid">, (typeof expected)["born"]][]) {
		const { heard, played, decoded } = earOf();
		heard.frame(camera(36), SIZE);
		heard.heard(kind, MIDDLE);
		await decoded();
		expect(notes(played)).toEqual(
			line.map(([after, semitones]) => ({
				file: `sounds/${file}.mp3`,
				at: round(100 + after),
				rate: round(rate(semitones, base)),
				gain,
				pan: 0,
				wired: true,
			})),
		);
	}
});

test("a sound is placed left or right where its event shows, and nothing is heard off the screen nor before the town's first frame", async () => {
	const { heard, played, asked, decoded } = earOf();
	heard.heard("born", MIDDLE);
	heard.frame(camera(36), SIZE);
	// At the left edge, at the right edge, then past it, and over the top; each of a kind, as one of a kind is heard a slot.
	heard.heard("born", [-500 / 36, 0, 0]);
	heard.heard("left", [500 / 36, 0, 0]);
	heard.heard("merged", [501 / 36, 0, 0]);
	heard.heard("built", [0, 401 / 36, 0]);
	await decoded();
	expect(played.map((note) => round(note.pan))).toEqual([-0.7, 0.7]);
	expect(asked.length).toBe(2);
	// The town gone: nothing until its next frame.
	heard.quiet();
	heard.heard("born", MIDDLE);
	expect(asked.length).toBe(2);
});

test("seen from the whole town, a sound is a third as loud as seen from near", async () => {
	const { heard, played, clock, decoded } = earOf();
	heard.frame(camera(36), SIZE);
	heard.heard("left", MIDDLE);
	clock.now += 0.1;
	heard.frame(camera(2), SIZE);
	heard.heard("left", MIDDLE);
	await decoded();
	expect(played.map((note) => round(note.gain))).toEqual([0.2, round(0.2 * 0.34)]);
});

test("the sounds' switch and volume, and the switch of its line, rule what is heard", async () => {
	const { heard, played, asked, settings, decoded } = earOf();
	heard.frame(camera(36), SIZE);
	settings.on = false;
	heard.heard("merged", MIDDLE);
	settings.on = true;
	settings.off = ["town-merges"];
	heard.heard("merged", MIDDLE);
	heard.heard("built", MIDDLE);
	expect(asked).toEqual([]);
	// Another line still plays, at the volume chosen.
	settings.volume = 0.5;
	heard.heard("born", MIDDLE);
	await decoded();
	expect(notes(played)).toMatchObject([{ file: "sounds/bubble.mp3", gain: 0.13 }]);
});

test("a tab that does not play the sounds hears nothing of its town", () => {
	const { heard, asked } = earOf({ plays: () => false });
	heard.frame(camera(36), SIZE);
	heard.heard("born", MIDDLE);
	heard.laid(MIDDLE, 0.5);
	expect(asked).toEqual([]);
});

test("nothing is heard while the audio sleeps, and nothing is kept for when it wakes", async () => {
	const { heard, played, asked, clock, decoded } = earOf();
	heard.frame(camera(36), SIZE);
	clock.state = "suspended";
	heard.heard("born", MIDDLE);
	heard.laid(MIDDLE, 0.5);
	clock.state = "running";
	await decoded();
	expect([asked, played]).toEqual([[], []]);
	// A file that comes too late after its time is not played either.
	let release = (): void => undefined;
	const late = earOf({ buffer: (file) => new Promise((resolve) => (release = () => resolve({ file } as unknown as AudioBuffer))) });
	late.heard.frame(camera(36), SIZE);
	late.heard.heard("born", MIDDLE);
	late.clock.now += 0.3;
	release();
	await late.decoded();
	expect(late.played).toEqual([]);
});

test("bricks landing are heard on a beat: one knock a slot at most, on the slot, one slot in four silent, higher as the building rises", async () => {
	let draw = 0.5;
	const { heard, played, clock, decoded } = earOf({ random: () => draw });
	heard.frame(camera(36), SIZE);
	clock.now = 100.01;
	// Many bricks in one slot: one knock, on the slot's end.
	for (let brick = 0; brick < 5; brick++) heard.laid(MIDDLE, 0);
	await decoded();
	clock.now = 100.12;
	heard.laid(MIDDLE, 1);
	await decoded();
	// A silent slot: its draw falls under one in four, and the slot is spent.
	clock.now = 100.2;
	draw = 0.1;
	heard.laid(MIDDLE, 1);
	draw = 0.5;
	heard.laid(MIDDLE, 1);
	await decoded();
	const slots = played.map((note) => round(note.at));
	expect(slots).toEqual([round(Math.ceil(100.01 / 0.095) * 0.095), round(Math.ceil(100.12 / 0.095) * 0.095)]);
	expect(played.every((note) => note.file === "sounds/wood-tap.mp3")).toBe(true);
	// Its foot is C4, its top two octaves and more higher; the loudness, 0.17 times 0.7 to 1.2.
	expect(notes(played).map((note) => [note.rate, note.gain])).toEqual([
		[round(rate(0, 330)), round(0.17 * 0.95)],
		[round(rate(21, 330)), round(0.17 * 0.95)],
	]);
});

test("a town that was frozen is not heard for what its first frame plays of the time it missed", async () => {
	const { heard, asked, clock, decoded } = earOf();
	heard.frame(camera(36), SIZE);
	// Its tab hidden a second: its scaffold stood meanwhile, and its frame plays it before the ear is told of the frame.
	clock.now = 101;
	heard.heard("frame", MIDDLE);
	heard.laid(MIDDLE, 0.5);
	heard.frame(camera(36), SIZE);
	expect(asked).toEqual([]);
	// The frame after is heard as any other.
	clock.now = 101.02;
	heard.heard("frame", MIDDLE);
	await decoded();
	expect(asked).toEqual(["sounds/wood-tap.mp3"]);
});

test("many events of a kind at once are one sound: forty sessions that open together do not saturate", async () => {
	const { heard, played, clock, decoded } = earOf();
	heard.frame(camera(36), SIZE);
	for (let session = 0; session < 10; session++) heard.heard("born", MIDDLE);
	// Another kind is heard beside it, and the same kind again a slot later.
	heard.heard("left", MIDDLE);
	await decoded();
	clock.now = 100.1;
	heard.heard("born", MIDDLE);
	await decoded();
	expect(played.map((note) => [round(note.rate), round(note.at)])).toEqual([
		[round(rate(19, 642)), 100],
		[round(rate(12, 642)), 100],
		[round(rate(19, 642)), 100.1],
	]);
});

test("a frame that plays nothing computes nothing, and bricks that are not heard read the settings once a slot", () => {
	let [projected, read] = [0, 0];
	const { heard, clock } = earOf({ plays: () => (read++, false) });
	const project: Project = (at) => (projected++, camera(36)(at));
	for (let frame = 0; frame < 1000; frame++) heard.frame(project, SIZE);
	expect(projected).toBe(0);
	// Sixty frames of a storey being laid, in one slot, the sounds cut.
	clock.now = 100.01;
	for (let frame = 0; frame < 60; frame++) heard.laid(MIDDLE, 0.5);
	expect([read, projected]).toEqual([1, 0]);
});

test("a sound whose file comes late plays whole, a little later, or not at all; none plays once its town is gone", async () => {
	const held = () => {
		let release = (): void => undefined;
		const made = earOf({ buffer: (file) => new Promise((resolve) => (release = () => resolve({ file } as unknown as AudioBuffer))) });
		made.heard.frame(camera(36), SIZE);
		made.heard.heard("built", MIDDLE);
		return { ...made, release: () => release() };
	};
	// 0.2 s late: its four notes, with their gaps.
	const late = held();
	late.clock.now += 0.2;
	late.release();
	await late.decoded();
	expect(late.played.map((note) => round(note.at))).toEqual([100.2, 100.3, 100.4, 100.5]);
	// 0.27 s late: none of them, not the three that would still be on time.
	const lost = held();
	lost.clock.now += 0.27;
	lost.release();
	await lost.decoded();
	expect(lost.played).toEqual([]);
	// The town closed before its file came: nothing, even on time.
	const closed = held();
	closed.heard.quiet();
	closed.release();
	await closed.decoded();
	expect(closed.played).toEqual([]);
});

test("a scaffold without a pull request is heard as the building site's: cutting the pull requests' line leaves it", async () => {
	const { heard, asked, settings, clock } = earOf();
	heard.frame(camera(36), SIZE);
	settings.off = ["town-pulls"];
	heard.heard("frame", MIDDLE);
	heard.heard("red", MIDDLE);
	expect(asked).toEqual([]);
	heard.heard("site", MIDDLE);
	expect(asked).toEqual(["sounds/wood-tap.mp3"]);
	clock.now += 0.1;
	settings.off = ["town-bricks"];
	heard.heard("site", MIDDLE);
	expect(asked.length).toBe(1);
});

test("the settings hear a line's example in the middle, at the volume, whatever its switch", async () => {
	const { heard, played, settings, decoded } = earOf({ plays: () => false });
	settings.off = ["town-pulls"];
	settings.volume = 0.5;
	heard.example("town-pulls");
	await decoded();
	expect(notes(played).map((note) => [note.file, note.at, note.gain, note.pan])).toEqual([
		["sounds/wood-tap.mp3", 100, 0.12, 0],
		["sounds/wood-tap.mp3", 100.14, 0.12, 0],
		["sounds/wood-tap.mp3", 100.6, 0.12, 0],
		["sounds/wood-tap.mp3", 100.77, 0.12, 0],
	]);
});
