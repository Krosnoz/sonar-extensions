// The material of a town's part: how its instances are built by the front, the light they give, their colour by night
// under the moon and the lamps, and the details left out from afar (./parts.ts).
import {
	abs,
	attribute,
	clamp,
	dot,
	float,
	floor,
	fract,
	fwidth,
	length,
	max,
	min,
	mix,
	normalWorld,
	positionLocal,
	positionWorld,
	select,
	sin,
	smoothstep,
	step,
	vec3,
} from "three/tsl";
import { facePixel, farPanes, paneFrom } from "./far-panes";
import type { Lamplight } from "./lamplight";
import { layered } from "./layers";
import { N, THREE, noise, working, type Node, type Vec3, type Vec4 } from "./nodes";
import { LAND, STREET } from "./pace";
import type { How, Uniforms } from "./parts";
import { plotted, swept } from "./plot-mask";
import { reflection } from "./reflections";
import { CARRIED, LAMP_IRON, tone } from "./shapes";
import { netOf } from "./site-net";

// What the front has passed is built bottom-up, in small cubes: the land rises from under the sea first, then the rest
// (`need` of ./pace.ts, which the points' flights invert). Returns how far past its laying a cube is, in bands: over 0,
// it is built.
function built(u: Uniforms, data: Vec4, how: How): Node {
	const { waits } = how;
	// Just under the face: a block's side stands on the line between two blocks, and belongs to its own.
	const inside = positionWorld.sub(normalWorld.mul(0.5 / N));
	const cell = floor(inside.mul(N)).div(N);
	// A subject's block waits for the cubes of its cards (./delays.ts): the front must go that many bands further.
	const height = clamp(cell.y.sub(STREET).div(u.top.sub(STREET).max(0.1)), 0, 1);
	const past = waits ? u.delays.past(inside, height, waits) : float(0);
	// The noise below takes up to 0.06 off the progress: capped at 1, the town's top 6 % of height (a church's cross, the
	// highest roofs) stayed half built, in scattered cubes. The front ends 1.4 bands past the town: 1.1 is reached.
	// Under 0 ahead of the front, so that the frame below shows just ahead of it, and not over the whole town to come.
	// A subject's land is one instance, at its block's centre, and its points land where each lies along the front
	// (./places.ts#tiles): laid as a whole, it left the points of its near half lying in the air. It is laid column by
	// column, each as its point lands.
	const along = waits === "land" ? dot(u.dir, vec3(cell.x, 0, cell.z)) : data.x;
	const progress = clamp(u.front.sub(along).div(u.band).sub(past), -1, 1.1);
	const land = cell.y.sub(u.base).max(0).mul(LAND).div(float(STREET).sub(u.base));
	const rest = cell.y
		.sub(STREET)
		.mul(1 - LAND)
		.div(u.top.sub(STREET).max(0.1))
		.add(LAND);
	const need = mix(land, rest, step(STREET, cell.y));
	const left = progress.sub(need).sub(noise(cell).mul(0.06));
	// The block the town holds for a subject to come has a front of its own (./plot-mask.ts).
	return swept(how) ? plotted(u, data, how, left, inside, cell, need) : left;
}

// How long before its laying a cube shows as a frame, in bands, and one line of the cubes' lattice in how many. The
// page's edge runs a second ahead of the front (./dots.ts): at 0.35 band, about two seconds, the frame lay over the
// page not yet gone.
const [AHEAD, EVERY] = [0.12, 4];
// The frame ahead of the front: just before a cube is laid, the lines of the cubes' lattice light up there, in the
// user's accent. Between the page's edge and the town's front, the page's dust lands on a frame, not on a void.
function frameOf(left: Node): Node<"bool"> {
	const lattice = positionWorld.mul(N / EVERY);
	const near = step(min(fract(lattice), fract(lattice).oneMinus()), fwidth(lattice).mul(0.75));
	// On a face, the lines along its two own axes: the third is the face's own plane, on a line all over.
	const own = abs(normalWorld).oneMinus();
	return dot(near, own).greaterThan(0.5).and(left.lessThanEqual(0)).and(left.greaterThan(-AHEAD));
}
// What a part's material shows: what it keeps (`kept`) in its colour (`shade`) and its light, and the town's frame over
// it. Not the people's: they come once the town is there. The frame is light alone, under the glow's threshold, and
// casts no shadow.
type Shown = { kept: Node<"bool">; left: Node; shade: Vec3; light: Vec3 };
function framed(made: THREE.MeshStandardNodeMaterial, how: How, accent: Vec3, { kept, left, shade, light }: Shown): void {
	const frame = how.people ? null : frameOf(left);
	made.maskNode = frame ? kept.or(frame) : kept;
	made.colorNode = frame ? select(frame, vec3(0), shade) : shade;
	made.emissiveNode = frame ? select(frame, mix(accent, vec3(1), 0.3), light) : light;
}

// Which piece of its model a vertex belongs to: 1 takes the instance's colour, 2 a screen, 4 a lamp, 5 a coloured
// light, 6 a window (with a random fraction).
const is = (which: number): Node => {
	const kind = attribute("aPart", "float");
	return step(which - 0.5, kind).mul(step(kind, which + 0.5));
};

// The light a part gives: the screens of who works flicker, a bubble of who waits pulses, a mark to review glows.
function emissive(u: Uniforms, data: Vec4, colour: Vec3, how: How, night: boolean): Vec3 {
	const kind = attribute("aPart", "float");
	const waits = step(1.5, data.y).mul(step(data.y, 2.5));
	const glow = working(data)
		.mul(
			sin(u.time.mul(2.3).add(data.z.mul(60)))
				.mul(0.1)
				.add(0.9),
		)
		.add(waits.mul(sin(u.time.mul(5)).mul(0.35).add(0.75)))
		.add(step(2.5, data.y).mul(0.6));
	// A window (part 6 and a random fraction): lit when its fraction is under the share of the instance at work. Only at
	// night: by day, a lit window read as a broken pane. Its light stays under 1 in each channel: at 2.4, the tone mapping
	// turned a warm pane near white, and a tower at work, all its panes lit, burnt into one white block whose glow
	// swallowed its frames and spilled on the ground. A deeper amber keeps it warm and full, and under the glow's threshold.
	const pane = step(fract(kind).mul(2.04), data.w.sub(0.001))
		.mul(night ? 1.05 : 0)
		.add(step(0.8, fract(kind).mul(2.04)).mul(night ? 0.9 : 0));
	// From afar, by night, a pane and the wall round it melt into the facade's mean light (./far-panes.ts). The wall is
	// an upright face of a model that has windows.
	const panes = night && how.panes ? farPanes(data) : null;
	const wall = is(0)
		.add(is(1))
		.mul(step(abs(normalWorld.y), 0.5));
	const window = vec3(1, 0.62, 0.26).mul(panes ? is(6).mul(paneFrom(pane, panes)).add(wall.mul(panes.mean).mul(panes.far).mul(panes.wall)) : is(6).mul(pane));
	return colour
		.mul(is(2))
		.mul(glow)
		.mul(night ? 3.2 : 1.3)
		.add(
			colour
				.mul(is(5))
				.mul(glow)
				.mul(night ? 0.9 : 0.25),
		)
		.add(colour.mul(is(1)).mul(how.glow ?? 0))
		.add(
			colour
				.mul(is(CARRIED))
				.mul(glow)
				.mul(night ? 1.1 : 1.3),
		)
		.add(
			attribute("color", "vec3")
				.mul(is(4))
				.mul(how.lamp ?? (night ? 4 : 0)),
		)
		.add(window);
}

// The road's grey-lilac (./street.ts), in the palette the models are drawn in, as the shader reads it: the plain hex
// missed the road of the city's palette, which kept its day tone by night.
const ROAD = new THREE.Color(tone("#77747f"));

// How strongly a lamp lights the ground at its foot, times the ground's value: the pale paving turns a warm amber
// short of white, the road's dark lilac a dimmer one that still reads.
const LAMP = 2.5;
// How much of the ground's hue the lamp's light drops for its value (0: the colour as it is, 1: its grey only). At 0.9 the
// tenth left still read amber-pink on the warm paving and yellow on the grass beside it.
const GLAZE = 1;
// How much of the moon's light a lamp's pool takes away where the lamp rules.
const MOON_OUT = 0.5;
// How much of its moonlit value the ground keeps by night (the road, the grass, the paving): the road read light lilac
// between two pools.
const DUSK = [0.55, 0.7, 0.85] as const;
// The light of a figure's seams as it is born or goes (./layers.ts): over the thresholds of the glow pass
// (./pipeline.ts), which spreads it round the figure.
const SEAMS = 4;
// A figure of the people is born and goes in layers (./layers.ts): what is kept of it, and its seams' light, in the
// user's accent, pale. Null for a part that is not of the people.
type Life = ReturnType<typeof layered> | null;
const lifeOf = (u: Uniforms, data: Vec4, how: How): Life => (how.span ? layered(u.time, data.w, how.span, is(2)) : null);
const seamed = (lights: Vec3, life: Life, accent: Vec3): Vec3 => (life ? lights.add(mix(accent, vec3(1), 0.35).mul(life.glow).mul(SEAMS)) : lights);
const alive = (mask: Node<"bool">, life: Life): Node<"bool"> => (life ? mask.and(life.kept) : mask);
// The moonlit value of a near-black iron by night, a cool slate, in the palette the models are drawn in.
const SLATE = new THREE.Color(tone("#7d8494"));

// The lamps light the ground only, a flat surface no higher than the kerbs (0.11): never the foot of what stands on
// it, and no shadow falls in it: the lamp is above its post. `drowned`: how much a lamp's light rules a pixel of the
// ground, 1 from its foot to the pool's middle. Both null by day.
function poolOf(lit: Lamplight | null) {
	const ground = lit ? smoothstep(0.85, 0.95, normalWorld.y).mul(step(positionWorld.y, 0.14)).mul(step(-0.15, positionWorld.y)) : null;
	const pool = lit && ground ? lit.at(positionWorld.xz).mul(ground) : null;
	const drowned = pool ? clamp(dot(pool, vec3(0.2126, 0.7152, 0.0722)).mul(2), 0, 1) : null;
	return { pool, drowned };
}

// A fine detail (part 8, its thinner size in the fraction: ./facades-kit.ts#fine) is left out once that size is under
// 1.5 pixels: a grid of mullions and trims finer than that blinked in a moire pattern as the town turned. The pixel is
// measured on the detail's face, across its width and up it (./far-panes.ts#facePixel): its thinner size, either way.
// A street lamp's post, and its head and foot with it (parts 3 and 4 with a fraction: ./street-furniture.ts#lamp), is one too,
// measured on the view's plane: each face of a post has its own normal, and they must all go at once, or a lamp's
// head floats.
function blurred(): Node {
	const across = facePixel();
	const fine = fract(attribute("aPart", "float"));
	return is(8)
		.mul(step(fine, max(across.wide, across.tall).mul(1.5)))
		.add(
			is(LAMP_IRON)
				.add(is(4))
				.mul(step(0.001, fine))
				.mul(step(fine, across.pixel.mul(1.5))),
		);
}

export function material(u: Uniforms, data: Vec4, colour: Vec3, how: How, lit: Lamplight | null): THREE.MeshStandardNodeMaterial {
	const night = !!lit;
	const made = new THREE.MeshStandardNodeMaterial({ flatShading: how.flat ?? false });
	// What is left to lay of a storey laid merge by merge is under a site's net (./site-net.ts).
	const net = netOf(how.rises, data, is(1));
	const own = net.colour(mix(attribute("color", "vec3"), colour, is(1).add(is(5))));
	// By night the greens (the grass, the trees) stay too vivid under the moon's blue light: about 30 % darker and bluer.
	const green = smoothstep(0.02, 0.1, own.g.sub(max(own.r, own.b)));
	// The rivers' light blue goes deep: darker and bluer, so that it does not read as the road's grey-lilac. Only a light,
	// strongly blue colour counts as water.
	const water = smoothstep(0.15, 0.25, own.b.sub(own.r)).mul(smoothstep(0.2, 0.28, dot(own, vec3(0.2126, 0.7152, 0.0722))));
	const grey = dot(own, vec3(0.2126, 0.7152, 0.0722));
	// The squares' and pavements' pale stone, a flat surface near the ground: by night it stays as bright as by day and
	// looks lit, so it goes about 40 % darker, and keeps its warmth.
	const stone = smoothstep(0.55, 0.72, grey)
		.mul(smoothstep(0.85, 0.95, normalWorld.y))
		.mul(smoothstep(0.3, 0.15, positionWorld.y));
	// The road's grey-lilac goes about 40 % darker and bluer: under the moon the paving and the street had the same
	// luminance (1.03:1) and read as one surface; now the square is the lighter, warmer one (about 1.5:1).
	const paving = mix(own, own.mul(vec3(0.6, 0.58, 0.62)), stone);
	const road = smoothstep(0.035, 0.012, length(own.sub(vec3(ROAD.r, ROAD.g, ROAD.b))));
	const shaded = mix(paving, paving.mul(vec3(0.58, 0.6, 0.72)), road);
	// The water goes half way to its grey before it is darkened: its light blue only darkened was a royal blue, the most
	// vivid colour of the town by night.
	const deep = mix(vec3(grey), own, 0.3).mul(vec3(0.21, 0.28, 0.4));
	// The greens a notch lighter than before, so that a conifer and a crown stay apart.
	const moon = mix(mix(shaded, shaded.mul(vec3(0.7, 0.8, 0.92)), green), deep, water);
	// A near-black, near-grey iron (a roof's aerial, a railing) takes a moonlit slate by night: under the moon's dim
	// light it was a black hole, its faces one flat patch. A dark colour with a hue (a window's navy) keeps its own.
	const ink = smoothstep(0.05, 0.03, grey).mul(smoothstep(0.03, 0.015, length(own.sub(vec3(grey)))));
	const albedo = lit ? mix(moon, vec3(SLATE.r, SLATE.g, SLATE.b), ink) : own;
	made.roughnessNode = float(0.8);
	made.metalnessNode = float(0);
	const { pool, drowned } = poolOf(lit);
	// Where the lamp rules, the moon's blue light fades by half: added to the lamp's, the road's moonlit lilac turned
	// its pool pink.
	// The light keeps the ground's value (its texture, its darkness) but mostly not its hue: times the full colour, the
	// same amber read salmon on the lilac road and acid lime on the grass. As a painter glazes one warm light over the
	// ground, the lamp reads as the same lamp on every surface.
	const glazed = mix(albedo, vec3(dot(albedo, vec3(0.2126, 0.7152, 0.0722))), GLAZE);
	// The moonlit half left under the lamp takes the same glaze, by how much the lamp rules: it kept the ground's own hue,
	// so the one pool read salmon on the paving and yellow-green on the grass, cut sharp at the kerb between them. Out of
	// the pool the ground keeps its colour.
	// The ground under the moon goes darker (DUSK), so that the lamps' pools read on it; the pools keep the light of the
	// ground's own value (`glazed`, above). The whole moonlight dimmed darkened the facades and the inhabitants with it.
	const low = lit
		? smoothstep(0.85, 0.95, normalWorld.y)
				.mul(smoothstep(0.3, 0.15, positionWorld.y))
				.mul(float(1).sub(water))
		: null;
	// The road most, the grass less, the paving least: the inhabitants walk on it, and a dark coat lost its edge.
	const dusk = mix(mix(float(DUSK[2]), float(DUSK[0]), road), float(DUSK[1]), green);
	const dim = low ? albedo.mul(mix(float(1), dusk, low)) : albedo;
	const dimGlazed = mix(dim, vec3(dot(dim, vec3(0.2126, 0.7152, 0.0722))), GLAZE);
	const toned = drowned ? mix(dim, dimGlazed, drowned) : dim;
	const shade = drowned ? toned.mul(float(1).sub(drowned.mul(MOON_OUT))) : dim;
	// The lamps of the quays streak the water (./reflections.ts).
	const life = lifeOf(u, data, how);
	const lights = seamed(emissive(u, data, colour, how, night), life, u.accent);
	const glow = lit ? lights.add(reflection(lit, water, u.time)) : lights;
	const light = pool ? glow.add(glazed.mul(pool).mul(LAMP)) : glow;
	// Where a lamp lights the ground, the moon's shadows fade: its post's shadow lay across the middle of its own pool.
	if (drowned) {
		// three.js calls it with the shadow (ShadowNode.js), which its types leave out: read as the first of its arguments.
		made.receivedShadowNode = (...given: Node[]): Node => {
			const shadow = given[0]!;
			return shadow.add(float(1).sub(shadow).mul(drowned));
		};
	}
	// A figure comes and goes with the near levels, cube by cube, as the town was built.
	const left = built(u, data, how);
	const mask = alive(how.people ? left.greaterThan(0).and(noise(floor(positionWorld.mul(N)).add(data.z)).lessThan(u.people)) : left.greaterThan(0), life);
	const kept = net.kept(mask.and(blurred().lessThan(0.5)));
	framed(made, how, u.accent, { kept, left, shade, light: net.light(light) });
	// The shadows leave out the same details: in the sun's map, `pixel` is a texel, and the shadow of a detail thinner
	// than a texel and a half (a post, a rail) lay on the ground as a line that blinked as the town turned.
	// By night a lamp's iron and what gives light (part 4) cast no moon shadow: their own light drowns it. The lamp's
	// head, 1.7 up, laid its shadow a metre from its post, cut off from it, where its pool had grown faint.
	made.maskShadowNode = night ? kept.and(is(LAMP_IRON).add(is(4)).lessThan(0.5)) : kept;
	// three.js places the instance first, then assigns positionNode: a move is added to the placed position.
	const moved = how.moves?.(data) ?? null;
	if (moved) made.positionNode = positionLocal.add(moved);
	return made;
}
