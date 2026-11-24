// How the marks seen from afar (./far-marks.ts) keep clear of one another: a mark that would cover another joins it,
// the larger keeping its id, and the count of the one that stays is the sum of both. A mark that took others grows
// (./mark-cloud.ts: a lone agent's flower becomes a group's ring): its box is measured again, and the marks it now
// covers join it in turn. At 100 agents a mark was placed by its box before it took others, and grew over its
// neighbours: 6 to 11 pairs overlapped (./mark-overlap.test.ts).
import type { Placed } from "./mark-paint";

// `shows`: how much the mark shows as its people come to read (./far-marks.ts).
export type Placing = { id: number; members: number[]; p: Placed; box: number[]; shows: number };

// How far apart, in pixels, a mark must stand to part from the one it joined at the last frame, or to go back to its
// own place: on the edge of overlapping, a turn made it come and go.
export const HOLD = 6;

// Whether two boxes (left, top, right, bottom) overlap, `room` pixels apart at least; a negative `room` lets them share
// that much.
export const overlaps = (a: number[], b: number[], room: number): boolean =>
	a[0]! - room < b[2]! && a[2]! + room > b[0]! && a[1]! - room < b[3]! && a[3]! + room > b[1]!;

// `each` joins `host`: its agents and counts go to the host, whose box is measured again by `measure`. The host goes to
// the middle of all its agents, as Supercluster's clusters do: standing at its own agents' middle, it slid off the
// others' as the camera zoomed, by 10 to 18 px a frame at 1 000 agents (./mark-jump.test.ts).
export function join(host: Placing, each: Placing, measure: (p: Placed) => number[]): void {
	const total = host.p.total + each.p.total;
	host.p.x = (host.p.x * host.p.total + each.p.x * each.p.total) / total;
	host.p.y = (host.p.y * host.p.total + each.p.y * each.p.total) / total;
	host.members.push(...each.members);
	host.p.total = total;
	// Its agents are not hidden by a host on its way out.
	host.shows = Math.max(host.shows, each.shows);
	each.p.counts.forEach((count, state) => (host.p.counts[state]! += count));
	host.box = measure(host.p);
}

// Until no two of `marks` overlap: the smaller of two that do joins the larger. Each join leaves one mark less, so it
// ends. A mark passed overlapped none; a join changes only its host, which is looked at again. `marks` is changed in
// place.
export function settle(marks: Placing[], measure: (p: Placed) => number[]): void {
	for (let i = 0; i < marks.length;) {
		const j = marks.findIndex((other, k) => k !== i && overlaps(marks[i]!.box, other.box, 0));
		if (j < 0) {
			i++;
			continue;
		}
		const [host, each] = marks[i]!.p.total >= marks[j]!.p.total ? [i, j] : [j, i];
		join(marks[host]!, marks[each]!, measure);
		marks.splice(each, 1);
		i = Math.min(i, host > each ? host - 1 : host);
	}
}
