// The page's sounds, as an extension's page has them (PageApi's `sounds` of ./contract.ts). Type only; the page fills it.

// A line of Settings › Sounds: a kind of sound the extension plays, which the user cuts on each device.
export type SoundLine = {
	// Its name among the sounds the user cut: lowercase letters, digits and dashes, 40 at most, a letter first. The
	// core's moments and the lines other extensions declared are taken.
	readonly id: string;
	readonly name: string;
	readonly hint: string;
	// An example of it, played by the line's button; a throw cuts the extension.
	readonly hear: () => void;
};

// An extension plays its own sounds, from its own files, and follows the user's settings of sounds as the core does.
export type PageSounds = {
	// A section of Settings › Sounds after the core's: a line per kind of sound, with a button to hear it and a switch
	// to cut it, kept on the device. Throws for a line's name malformed or taken.
	readonly group: (title: string, lines: readonly SoundLine[]) => void;
	// The page's audio, woken by the user's first touch: a sound plays into its destination.
	readonly audio: AudioContext;
	// The volume the user set, from 0 to 1.
	readonly volume: () => number;
	// Whether a line of its own plays now: the sounds on, the line not cut, and this tab the one that plays (one tab of
	// the browser does). Throws for a line it did not declare.
	readonly plays: (line: string) => boolean;
};
