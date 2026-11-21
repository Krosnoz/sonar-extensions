// What the log says when Jev switches itself off, in the user's language: it stays off until the user turns it on again.

export const jevStopped = {
	fr: {
		cap: (usd: number) => `Jev est coupé : il a coûté ${usd} $ ce mois-ci, son plafond. Rallume-le dans ses réglages, ou monte son plafond.`,
		credits: () => "Jev est coupé : TypeSafe n'a plus de crédits. Rallume-le après la recharge.",
	},
	en: {
		cap: (usd: number) => `Jev is off: it cost $${usd} this month, its cap. Turn it on again in its settings, or raise its cap.`,
		credits: () => "Jev is off: TypeSafe has no credits left. Turn it on again after the top-up.",
	},
};
