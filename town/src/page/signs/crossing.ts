// Whether a sign's line crosses another line or another sign: a line that passes under another pin, or crosses another
// line, reads as joining the wrong roof.

// A segment [x0, y0, x1, y1] on the screen; a box [left, top, right, bottom].
type Segment = readonly [number, number, number, number];

const side = (ax: number, ay: number, bx: number, by: number, x: number, y: number): number => Math.sign((bx - ax) * (y - ay) - (by - ay) * (x - ax));

// Whether two segments cross, ends excluded: two lines from the same roof, or that only touch, do not.
export const crosses = ([a, b, c, d]: Segment, [e, f, g, h]: Segment): boolean =>
	side(a, b, c, d, e, f) * side(a, b, c, d, g, h) < 0 && side(e, f, g, h, a, b) * side(e, f, g, h, c, d) < 0;

// Whether a segment passes through a box: an end inside it, or a crossing with one of its sides.
export const through = (segment: Segment, [left, top, right, bottom]: readonly number[]): boolean => {
	const [a, b, c, d] = segment;
	const inside = (x: number, y: number): boolean => x > left! && x < right! && y > top! && y < bottom!;
	if (inside(a, b) || inside(c, d)) return true;
	return (
		crosses(segment, [left!, top!, right!, top!]) ||
		crosses(segment, [right!, top!, right!, bottom!]) ||
		crosses(segment, [left!, bottom!, right!, bottom!]) ||
		crosses(segment, [left!, top!, left!, bottom!])
	);
};
