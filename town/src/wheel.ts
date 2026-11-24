// The wheel's zoom: its travel in CSS pixels, and the zoom that travel gives, the same on every screen.

// A wheel's travel in CSS pixels, whatever unit it comes in: a line is 40 px and a page 800, as MapLibre counts them
// (its scroll_zoom handler). The zoom then depends on this travel only, the same on every screen.
export const wheelPixels = ({ deltaY, deltaMode }: Pick<WheelEvent, "deltaY" | "deltaMode">): number =>
	deltaY * (deltaMode === 1 ? 40 : deltaMode === 2 ? 800 : 1);

// The zoom of a wheel's travel, as MapLibre's scroll_zoom handler counts it: 2 / (1 + e^(−|travel| · rate)), at most ×2 a
// step. Its rate is 1/450 for a mouse (×1.11 a notch of 100 px) and 1/100 for a touchpad (×1.46); at 1/120 a notch zooms
// ×1.39, as a map does, and a touchpad's steps of a few pixels zoom by under 2 % each. An exponential of 0.0018 a pixel
// zoomed ×2.05 a notch of 400 px: the nearest level of a small town came in 2 notches (13/11).
const WHEEL_RATE = 1 / 120;
export const wheelFactor = (travel: number): number => {
	const scale = 2 / (1 + Math.exp(-Math.abs(travel) * WHEEL_RATE));
	return travel < 0 ? scale : 1 / scale;
};
