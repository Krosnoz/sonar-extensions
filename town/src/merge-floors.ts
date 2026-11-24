// A subject's building takes its storeys from its merges, which the server counts (its fleet/merged.ts): one storey,
// then one more each time they double (after 1, 3, 7, 15… merges). The height tells the work merged, slower and slower:
// a storey a merge reached the town's most in a few days, and every busy subject then stood the same.
// Between two doublings, each merge lays its share of the storey to come, under the roof.

// `floors`: its whole storeys. `share`: how much of the storey to come its merges have laid, from 0 (none) to under 1.
export type Raised = { floors: number; share: number };

// `least`, `most`: the fewest and the most storeys its town gives a subject's building (./town-blocks.ts). No storey
// is to come over the most, nor on a building its town holds higher than its merges ask.
export function raisedBy(merges: number, least: number, most: number): Raised {
	const whole = Number.isFinite(merges) ? Math.min(2 ** 30, Math.max(0, Math.floor(merges))) : 0;
	// 31 less the leading zeros of `whole + 1`: floor(log2(whole + 1)), exact at each doubling.
	const tier = 31 - Math.clz32(whole + 1);
	const floors = Math.max(least, Math.min(most, tier + 1));
	return { floors, share: floors === tier + 1 && floors < most ? (whole + 1 - 2 ** tier) / 2 ** tier : 0 };
}

export const floorsBy = (merges: number, least: number, most: number): number => raisedBy(merges, least, most).floors;
