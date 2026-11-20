// The statistics read now: the velocity's last computation for the PRs and commits, the usage for the agents' work, the
// trust of each project, and the measures Sonar keeps (./measured.ts), all through the contract.

import type { ProjectTrust, ServerApi, Velocity } from "@sonar/extension";
import { dayOf, lastMondays, nextTurn, startOfDay } from "./calendar";
import { readMeasured } from "./measured";
import type { GlobalStats, ProjectStats, StatsTrust, TrustLevel } from "./shapes";
import { countedOf, statsWeeks } from "./weeks";
import { workWeeksOf } from "./work";

// As the velocity: 9 weeks, Monday to Sunday.
const WEEKS = 9;
// Projects with less than a cent of work over the weeks are left out of the whole's lines.
const NO_WORK = 0.01;

// A level a later contract may add is read as unknown.
const levelOf = (trust: ProjectTrust | undefined): TrustLevel | null =>
	trust?.level === 1 || trust?.level === 2 || trust?.level === 3 ? trust.level : null;

function trustOf(trust: ProjectTrust | undefined): StatsTrust | null {
	const level = levelOf(trust);
	if (!trust || level === null) return null;
	const proved = (proof: ProjectTrust["proofs"][number]) => trust.proofs.includes(proof);
	return {
		level,
		proofs: { verification: proved("verification"), corrections: proved("corrections"), sentBack: proved("sentBack"), reverts: proved("reverts") },
		measures: { verification: { points: trust.points, working: trust.working } },
	};
}

const projectWeeks = (velocity: Velocity | null, name: string) => {
	const weeks = velocity?.projects.find((each) => each.project === name)?.weeks;
	return weeks ? countedOf(weeks) : null;
};

export function statsReader(api: ServerApi) {
	const read = async () => {
		const velocity = await api.usage.velocity();
		const starts = velocity?.weeks.map((week) => week.start) ?? lastMondays(WEEKS);
		const usage = await api.usage.days({ since: startOfDay(starts[0] ?? dayOf(Date.now())) });
		await nextTurn();
		const measured = await readMeasured(api, starts);
		await nextTurn();
		const work = await workWeeksOf(usage.lines, starts);
		const names = [...new Set(usage.lines.flatMap((line) => (line.project === null ? [] : [line.project])))];
		return { velocity, starts, measured, names, work };
	};

	const project = async (name: string): Promise<ProjectStats> => {
		const { velocity, starts, measured, work } = await read();
		const trust = (await api.projects.trust()).find((each) => each.project === name);
		return {
			project: name,
			sonarSince: velocity?.sonarSince ?? "",
			updatedAt: Date.now(),
			weeks: statsWeeks(starts, projectWeeks(velocity, name), work.of(name), measured(name)),
			allCost: work.whole.map((week) => week.cost),
			trust: trustOf(trust),
		};
	};

	const global = async (): Promise<GlobalStats> => {
		const { velocity, starts, measured, names, work } = await read();
		const trust = new Map((await api.projects.trust()).map((each) => [each.project, each]));
		const lines = names.map((name) => ({
			project: name,
			level: levelOf(trust.get(name)),
			weeks: statsWeeks(starts, projectWeeks(velocity, name), work.of(name), measured(name)),
		}));
		return {
			sonarSince: velocity?.sonarSince ?? "",
			updatedAt: Date.now(),
			weeks: statsWeeks(starts, velocity ? countedOf(velocity.weeks) : null, work.whole, measured(null)),
			projects: lines.filter((line) => line.weeks.reduce((sum, week) => sum + week.cost, 0) >= NO_WORK),
		};
	};

	return { project, global };
}
