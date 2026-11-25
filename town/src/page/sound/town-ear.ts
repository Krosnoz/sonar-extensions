// The town's ear (./town-sound.ts) on the page's sounds, as the API gives them (PageApi's `sounds`): its audio, the
// volume, and whether a line plays. One for the page, made at its first use: the town that shows tells it where its
// points are at each frame (../camera/view.ts), what the town plays reaches it through its stage (../people/stage.ts), and the settings
// play their examples on it (./sound-lines.ts).
import { sonar } from "../sonar/sonar";
import { ear } from "./town-sound";

const buffers = new Map<string, Promise<AudioBuffer>>();

// A sound's file, fetched and decoded once. A file that failed is not kept: the next asking fetches it again. Its path
// is relative to the extension's root, where Sonar serves this module too (/ext/<id>/…).
function bufferOf(file: string): Promise<AudioBuffer> {
	let buffer = buffers.get(file);
	if (!buffer) {
		buffer = fetch(new URL(file, import.meta.url))
			.then((response) => (response.ok ? response.arrayBuffer() : Promise.reject(new Error(`HTTP ${response.status}`))))
			.then((bytes) => sonar().sounds.audio.decodeAudioData(bytes));
		buffers.set(file, buffer);
		buffer.catch(() => buffers.delete(file));
	}
	return buffer;
}

let made: ReturnType<typeof ear> | null = null;

// Asked at each frame of the open town: made once.
export function townEar(): ReturnType<typeof ear> {
	if (made) return made;
	const { sounds } = sonar();
	made = ear({
		context: sounds.audio,
		buffer: bufferOf,
		plays: sounds.plays,
		volume: sounds.volume,
		now: () => performance.now() / 1000,
		random: Math.random,
	});
	return made;
}
