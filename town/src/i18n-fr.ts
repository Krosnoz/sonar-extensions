// The town's texts in French. Their English is in ./texts.ts.

import type { Translation } from "./texts";

export const french = {
	open: "Visualisation",
	close: "Revenir à la page",
	working: (n: number) => `${n} au travail`,
	waiting: (n: number) => `${n} t'attend${n > 1 ? "ent" : ""}`,
	reviewing: (n: number) => `${n} à revoir`,
	pull: (number: number, done: number, total: number) =>
		total ? `PR #${number} : ${done} vérification${done > 1 ? "s" : ""} sur ${total} terminée${done > 1 ? "s" : ""}` : `PR #${number}`,
	pullFails: (number: number) => `PR #${number} : une vérification échoue`,
	pullMerged: (number: number) => `#${number} · mergée`,
	compass: "Redresser la vue",
	noteNone: "Rien de noté pour l'instant",
	noteOpen: "Ouvrir la session",
	noteClose: "Fermer le carnet",
	empty: "Aucun agent sur la carte : la ville serait vide.",
	failed: "La ville ne peut pas être dessinée dans ce navigateur.",
	unheld: "Cette machine ne peut pas dessiner la ville en entier : son icône revient demain.",
	soundsTitle: "La ville",
	sounds: {
		"town-bricks": { name: "Des briques se posent", hint: "Un bloc ou un étage se bâtit" },
		"town-merges": { name: "Une fusion, un étage fini", hint: "Le travail fusionné monte dans l'immeuble" },
		"town-pulls": { name: "Une PR en test", hint: "Son échafaudage se pose ; ses tests échouent" },
		"town-people": { name: "Un habitant arrive ou part", hint: "Une session s'ouvre ou se ferme" },
	},
} satisfies Translation;
