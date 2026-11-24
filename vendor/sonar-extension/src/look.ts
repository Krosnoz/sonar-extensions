// How the page looks, as an extension's page reads it (PageApi's `look` of ./contract.ts). Type only; the page fills it.

// The user's choice in Sonar (Settings › Appearance), or their device's where they left it to the device. An extension
// that draws by itself (a canvas, a chart) reads it here: the device's setting alone misses the choice made in Sonar.
export type PageLook = {
	// The dark theme shows.
	readonly dark: () => boolean;
	// Movement goes, fades may stay.
	readonly reducedMotion: () => boolean;
	// Told after each change of either, once the page shows it; returns what stops the listening.
	readonly onChange: (listen: () => void) => () => void;
};
