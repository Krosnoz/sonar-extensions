// What each level shows over the town: a sign over each subject's roof, its name and counts nearer, each figure's name
// at the nearest level. The elements themselves are made in ./sign-nodes.ts, each sign is placed in ./sign-place.ts.
import type { World } from "../render/kit";
import { resaid } from "./sign-again";
import { headsDrawn } from "./sign-geometry";
import { bodyGrid } from "./sign-bodies";
import { anchorOf } from "./sign-motion";
import { NAME_LIFT, NAMES_PER_ZONE, nameBox, nameInside, nameRank, nameZone } from "./sign-names";
import { namePlaces } from "./name-places";
import { nameOf, signOf } from "./sign-nodes";
import { SLACK, placeSign, type Mark, type SignFrame } from "./sign-place";
import { signSizes, type Sizes } from "./sign-sizes";
import { stillness } from "../camera/steady";

// On a screen this narrow (the page's phone layout), the signs and names cover at most this share of the town.
const PHONE = 600;
const COVER = 0.1;

// The camera's step, in CSS pixels: a pixel of the drawing, half a CSS pixel (../camera/camera.ts, ../render/renderer.ts).
const CAMERA_STEP = 0.5;

type Figure = World["figures"][number];
type Project = (at: [number, number, number]) => [number, number];
type Head = { box: [number, number, number, number]; at: number };
// What the signs make once and keep from a frame to the next. `anchored`: the point of each roof its anchor stands on.
// `boxes`: the signs shown at the last frame, in CSS pixels: the marks keep off them (../marks/far-marks.ts) without reading the
// page. `seen` and `onView`: as `signs` is given them.
type Signs = {
	world: World;
	marks: Mark[];
	sorted: Mark[];
	names: ReturnType<typeof nameOf>[];
	placeNames: ReturnType<typeof namePlaces>;
	step: number;
	sizesAt: ReturnType<typeof signSizes>;
	still: ReturnType<typeof stillness>;
	anchored: number[];
	boxes: number[][];
	seen: (figure: Figure, hidden: boolean) => boolean;
	onView: (figure: Figure) => boolean;
};

// Each roof's point on the screen. Its anchor stands on the roof's bare surface, on the point it held while it may
// (./sign-motion.ts#anchorOf).
function roofsOf({ world, anchored }: Signs, project: Project): [number, number][] {
	return world.anchors.map(({ at: [mx, , mz], roof, topic }, at) => {
		// A subject to come has no building yet (../sites/plot.ts): its roof is off the screen, where a sign hides and stands in
		// no other's way.
		if (topic.held) return [-1e6, -1e6] as [number, number];
		const points = roof.map(project);
		anchored[at] = anchorOf(
			points,
			roof.map((point) => Math.round(Math.hypot(point[0] - mx, point[2] - mz) * 10)),
			anchored[at]!,
		);
		return points[anchored[at]]!;
	});
}

// The lamps' heads, nearer. A lamp's head no longer drawn (far, its post thinner than 1.5 pixels) hides no light: it is
// no obstacle.
function lampsOf({ world, step }: Signs, level: number, project: Project): [number, number][] {
	// The camera's axes in the town: its first column is the screen's rightward, its third toward the camera.
	const axis = world.camera.matrixWorld.elements;
	const [origin, right] = [project([0, 0, 0]), project([axis[0], axis[1], axis[2]])];
	const drawn = headsDrawn(Math.hypot(right[0] - origin[0], right[1] - origin[1]), step);
	return level > 0 && drawn ? world.heights.lamps.map((at) => project(at)) : [];
}

// The names, at least cut, of the figures seen on the screen, in front of a building or in silhouette behind it.
// `toward`: from the figures' heads to the camera.
function headsOf(sg: Signs, project: Project, { named, width, height: tall, top: bar, margin }: Sizes, toward: readonly [number, number, number]): Head[] {
	return sg.names.flatMap(({ figure, shown }, at) => {
		if (!sg.onView(figure)) return [];
		const box = nameBox(...project(figure.at), ...named[at]!.at(-1)!);
		const whole = nameInside(box, width, tall, bar, margin);
		return whole && sg.seen(figure, sg.world.heights.hides(figure.at, toward, shown ? 0.3 : -0.1)) ? [{ box, at }] : [];
	});
}

// The names a sign keeps off as off a body, at most NAMES_PER_ZONE per zone, the most urgent first, as the names are
// placed. Placed first, the signs took the places over the heads: a silhouette behind a building showed nameless under
// its roof's sign, and on a phone, near, the figures showed nameless where a computer named them.
function sparedOf(heads: Head[], names: Signs["names"]): number[][] {
	const zones = new Map<string, number>();
	return heads
		.toSorted((a, b) => nameRank(names[a.at]!.figure.agent.state) - nameRank(names[b.at]!.figure.agent.state))
		.filter(({ box }) => {
			const zone = nameZone((box[0] + box[2]) / 2, box[3] + NAME_LIFT);
			zones.set(zone, (zones.get(zone) ?? 0) + 1);
			return zones.get(zone)! <= NAMES_PER_ZONE;
		})
		.map(({ box }) => box);
}

// Signs and names that would cover one another: the most urgent takes its place first; another goes beside its roof,
// then up, then under its anchor. One that finds no room gives up its counts, then all but its pictogram.
// Nothing goes over another sign or out of the screen: a sign that finds no room at all is hidden.
function frameOf(sg: Signs, level: number, project: Project): void {
	const z = sg.sizesAt(level);
	const { sizes, named, width, height: tall, top: bar, blocked, floating, margin } = z;
	const now = performance.now();
	const posed = [...sg.world.camera.matrixWorld.elements, ...sg.world.camera.projectionMatrix.elements].join();
	// A new place or form needs SLACK to spare only while the camera moves: at every frame of a gesture, a place on the
	// edge of free came and went. Once the camera has stopped, each sign and name takes the richest form that fits: kept
	// to spare, a sign that had given up its counts in a turn never had them back, with room for them.
	const fresh = sg.still(posed, now) ? 0 : -SLACK;
	// On a phone the town stays readable: what is left of the share the signs and names may cover, the most urgent first.
	const phone = width <= PHONE;
	// The figures' bodies, while they show: a sign may not stand over one (the names come after, above the heads).
	const bodies = bodyGrid(level > 0 ? sg.world.figures.filter(sg.onView) : [], project, width, tall);
	// The subjects' roofs and, nearer, the lamps' heads: a sign over another roof seems to name it, one over a lamp hides
	// its light.
	const roofs = roofsOf(sg, project);
	// The tops of what stands higher on each roof (a hut, a tank), on the screen.
	const crowns = sg.world.anchors.map(({ crown }) => crown.map(project));
	const lamps = lampsOf(sg, level, project);
	// From the figures' heads to the camera (the camera's own axis, its view being parallel): a building on that line hides
	// the head, and its name.
	const axis = sg.world.camera.matrixWorld.elements;
	const toward = [axis[8], axis[9], axis[10]] as const;
	const spared = sparedOf(level >= 2 ? headsOf(sg, project, z, toward) : [], sg.names);
	const room = phone ? COVER * width * (tall - bar) : Infinity;
	const { step, marks, anchored } = sg;
	const f: SignFrame = {
		level,
		now,
		width,
		tall,
		bar,
		margin,
		fresh,
		phone,
		step,
		marks,
		sizes,
		floating,
		taken: [...blocked],
		room,
		bodies,
		pins: [],
		leads: [],
		roofs,
		crowns,
		lamps,
		spared,
		anchored,
	};
	for (const each of sg.sorted) placeSign(f, each);
	sg.boxes.splice(0, sg.boxes.length, ...f.pins);
	// The names come after every sign (./name-places.ts).
	sg.placeNames({
		level,
		project,
		step,
		fresh,
		slack: SLACK,
		named,
		width,
		tall,
		bar,
		margin,
		taken: f.taken,
		room: f.room,
		bodies,
		onView: sg.onView,
		seen: (figure, shown) => sg.seen(figure, sg.world.heights.hides(figure.at, toward, shown ? 0.3 : -0.1)),
	});
}

// One sign per subject, one name per figure: made once, placed at every frame. `pick`: a touch on a sign.
// `seen`: whether a figure is seen, given whether a building stands between its head and the camera (`hidden`). By default
// a figure behind a wall is not seen, and its name hides; a town that draws it in silhouette through the wall says it is.
export function signs(
	layer: HTMLElement,
	world: World,
	pixel: number,
	pick: (index: number) => void,
	seen: (figure: Figure, hidden: boolean) => boolean = (_, hidden) => !hidden,
	// Whether the camera sees a crowd's lot (../render/lots.ts): the figures of a lot it does not see are off the screen, and are not
	// projected. A town of 10 000 agents projected all of them at every frame of a turn.
	inView: (lot: number) => boolean = () => true,
) {
	const marks = world.anchors.map((anchor) => signOf(layer, pixel, pick, anchor));
	const sorted = marks.toSorted((a, b) => b.priority - a.priority);
	const names = world.figures.map((figure) => nameOf(layer, figure));
	const placeNames = namePlaces(names);
	const step = CAMERA_STEP;
	const sizesAt = signSizes(layer, marks, names);
	const still = stillness();
	const anchored = world.anchors.map(() => -1);
	const boxes: number[][] = [];
	const onView = (figure: Figure): boolean => !figure.away && (figure.lot === undefined || inView(figure.lot));
	const sg: Signs = { world, marks, sorted, names, placeNames, step, sizesAt, still, anchored, boxes, seen, onView };
	const again = resaid(layer, world, sg);
	const frame = (level: number, project: Project): void => {
		again();
		frameOf(sg, level, project);
	};
	return Object.assign(frame, { boxes });
}
