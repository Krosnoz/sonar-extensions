// The page's texts in French: those of Sonar's plugin `jev` in French. Their English is in ./texts.ts.

import type { Texts } from "./texts";

export const french: Texts = {
	jevOn: "Jev actif",
	jevNeedsKey: "Jev demande une clé TypeSafe",
	periods: { "1": "Aujourd'hui", "7": "7 jours", "30": "30 jours" },
	monthlyCap: "Plafond mensuel",
	capHint: "En dollars. Jev se coupe quand le mois l'atteint. Vide : sans plafond.",
	capNone: "aucun",
	thisMonth: "Ce mois-ci",
	monthOf: (spent: string, cap: string) => `${spent} sur ${cap}`,
	monthNoCap: (spent: string) => `${spent}, sans plafond`,
	capReached: "Plafond atteint : monte-le, puis rallume Jev.",
	cost: "Jev · jugements",
	costHint: (calls: string, tokens: string, estimated: boolean) => `${calls} appels · ${tokens} tokens${estimated ? " · en partie estimé" : ""}`,
	perDay: (max: string) => `Par jour · max ${max}`,
	price: "Jev à 0,042 $ le million de tokens d'entrée, relevés à chaque appel.",
	barSaid: (label: string, value: string) => `${label} : ${value}`,
	note: {
		// No-break spaces inside the quotes, as French writes them.
		body: "Sans clé TypeSafe, les décisions arrivent dans l'ordre. La carte ne montre ni urgence ni liens « même sujet ».",
		open: "Ouvrir Services",
	},
	stopped: {
		cap: (usd: number) => `est coupé : il a coûté ${usd} $ ce mois-ci, son plafond. Rallume-le dans Services, ou monte son plafond.`,
		credits: "est coupé : TypeSafe n'a plus de crédits. Rallume-le après la recharge.",
	},
};
