// An agent's message as Jev reads it: plain sentences to pick from, cut as Sonar cuts them, so that the sentence Jev
// picks is the one Sonar would show without a judge when it is the first.

function plain(text: string): string {
	return text
		.replace(/\*\*|__|`|^#+\s*|^\s*[-*>]\s+|\|/gm, "")
		.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
		.trim();
}

// The last 40 sentences: the end of a message carries its question and its result.
export function sentencesOf(text: string): string[] {
	return text
		.split("\n")
		.flatMap((line) => plain(line).match(/[^.!?]+[.!?]*/g) ?? [])
		.map((sentence) => sentence.trim())
		.filter((sentence) => sentence.length > 3)
		.slice(-40);
}
