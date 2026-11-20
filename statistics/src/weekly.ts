// Events counted week by week (weeks start on Monday, as lastMondays gives them): the whole and each project. Events
// before the first week are left out; a project without an event in a week is absent from it.

import { dayOf, weekOf } from "./calendar";

export type Week<T> = { readonly start: string; readonly total: T; readonly projects: Readonly<Record<string, T>> };

export type Dated = { readonly at: number; readonly project: string };

export function weekly<E extends Dated, T>(starts: readonly string[], events: readonly E[], count: (events: readonly E[]) => T): Week<T>[] {
	const indexed = events.map((event) => ({ event, index: weekOf(starts, dayOf(event.at)) }));
	return starts.map((start, index) => {
		const mine = indexed.filter((each) => each.index === index).map((each) => each.event);
		const projects = Object.groupBy(mine, (event) => event.project);
		return { start, total: count(mine), projects: Object.fromEntries(Object.entries(projects).map(([project, list]) => [project, count(list ?? [])])) };
	});
}
