// The questions asked to Jev (TypeSafe), as Sonar asked them. In French, whatever the user's language: Jev's thresholds
// were measured on these wordings.

export const jevTexts = {
	fresh: (user: string) => ({
		instructions: `${user} répond \`userAnswer\` à \`questionSeen\`. Entre-temps l'agent a écrit \`agentMessageNow\`. Cette réponse s'applique-t-elle encore à ce que l'agent attend maintenant ?`,
		criteria: {
			true: "L'agent attend toujours cette décision, la réponse garde son sens",
			false: "L'agent a avancé ou changé de question : la réponse tomberait à côté",
		},
	}),
	correction: (user: string) => ({
		instructions: `Ping traite \`currentRequest\`. ${user} dicte \`newMessage\`. Ce nouveau message corrige, annule ou remplace la demande en cours ?`,
		criteria: {
			true: "Correction, contre-ordre ou changement de sujet : il faut arrêter la demande en cours",
			false: "Complément ou demande de plus : elle peut attendre la fin de la réponse en cours",
		},
	}),
	samePair: "Les agents `a` et `b` travaillent-ils sur le même sujet produit ou technique, au point que l'un doive tenir compte de l'autre ?",
	topic: {
		instructions:
			"Sur quel sujet produit ou technique travaille cet agent ? Sa première demande `brief` dit le sujet de la session et compte le plus ; son nom `name`, sa branche git `branch`, sa dernière question `ask` et son état actuel `summary` précisent seulement l'étape en cours.",
		none: "Aucun de ces sujets ne correspond vraiment",
	},
	route: (user: string, userAtStart: string) => ({
		intent: {
			instructions: `Que demande ${user} avec \`phrase\`, dictée à son assistant vocal qui pilote ses agents de code ?`,
			criteria: {
				open: "Ouvrir, afficher ou montrer un agent précis, ou la conversation avec lui",
				next: "Passer à la décision suivante, la prochaine chose qui l'attend",
				fit: "Voir tout le parc, dézoomer, vue d'ensemble",
				ping: "Toute autre demande : une question, une action, un message à transmettre, une réponse à un agent",
			},
		},
		target: { instructions: "De quel agent de `agents` parle `phrase` ?", none: "Aucun agent précis" },
		reply: `${userAtStart} vient d'entendre l'agent \`lastAgent\` dire \`whatItSaid\`. La \`phrase\` de ${user} est-elle sa réponse à cet agent (accord, refus, choix, consigne pour lui) ?`,
	}),
	judge: (user: string) => ({
		urgency: {
			instructions: `À quel point la situation décrite dans \`message\` est-elle urgente pour ${user} ?`,
			criteria: ["Peut attendre plusieurs jours", "À traiter aujourd'hui", "Bloque un travail en cours ou touche la production"],
		},
		status: {
			instructions: "Quelle phrase de `sentences` résume le mieux le résultat ou l'état du travail de l'agent ?",
			none: "Aucune phrase ne résume l'état du travail",
		},
	}),
};
