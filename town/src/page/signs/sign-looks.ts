// The forms a subject's sign takes over the town (./signs.ts), as classes (world.css).

// The largest first: whole, its name cut, its name alone, then cut, its pictogram alone. A name is written whole while there
// is room for it, and cut only where there is not: a fixed length cut it with room to spare. Its name alone keeps a count of
// one beside its pictogram while it has room for it (`world-bare` drops it): it showed no number at all.
export const LOOKS = ["", "world-cut", "world-short", "world-short world-bare", "world-short world-cut", "world-mini"];
// On a phone, the whole sign first while it finds room within the phone's share: a count of one ("1 to review") has no
// count beside the pictogram, and the name alone hid it where the computer showed it. Short of room, the name stays whole
// and drops its counts before it is cut.
const PHONE_LOOKS = ["", "world-short", "world-short world-bare", "world-cut", "world-short world-cut", "world-mini"];
// The forms a sign tries: far out, its pictogram is the whole sign; a subject with a pictogram (at work, waiting, to
// review) shrinks to it rather than vanish: near, on a phone, a building filled the screen without its sign.
export const looksFor = (level: number, phone: boolean, pictogram: boolean): string[] =>
	level === 0 ? [""] : (phone ? PHONE_LOOKS : LOOKS).filter((look) => pictogram || look !== "world-mini");
// A sign takes one of LOOKS: its classes.
export const applyLook = (node: HTMLElement, look: string): void => {
	const parts = look.split(" ");
	for (const name of ["world-cut", "world-short", "world-bare", "world-mini"]) node.classList.toggle(name, parts.includes(name));
};
