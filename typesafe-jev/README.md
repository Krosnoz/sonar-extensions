# Jev: an extension for Sonar

Jev, TypeSafe's model, reads what your agents say and judges it for Sonar: whether an agent waits for you, how urgently, and which of its sentences its card shows; whether your answer still fits what the agent says now; whether a dictation corrects the request before it; which agents work on the same thing; a session's topic; where a sentence said to the orb goes; and the yes or no of the end-of-turn check. It fills Sonar's judge (the port `judge`), in place of Sonar's plugin `jev`, with the same questions and the same readings of the answers.

It goes through the extension contract alone: it imports nothing of Sonar, and has no dependency when it runs.

## What its page shows

The same screens as Sonar's plugin, in your language:

- In Settings › Services, in the group of its TypeSafe key, after the key: the switch "Jev on"; its monthly cap in dollars, Sonar's number field (`api.ui.number`), saved when the field is left or on Enter, empty for no cap, a value that is not a number from 0 refused on the spot; under it, the month's spending against the cap ("This month", a bar, "$1.52 of $3"), its bar in the waiting tone from 80 % of the cap and in the urgent tone at the cap, "Cap reached: raise it, then turn Jev on again." in the field's line once the month reached it, and "$1.52, no cap" without a bar when there is none; then its usage over today, 7 or 30 days (the period is kept in your browser): what its judgments cost, its calls and tokens ("partly estimated" when a call's tokens were not said), a bar a day over 7 or 30 days when a day cost something (its exact amount over the chart, for the bar under the pointer, touched, or chosen with the arrow keys), and its price. Without a key, the part is greyed, the switch held off, its tip saying Jev needs a key, and the cap's field held. A switch or a cap the extension refuses to save goes back or stays as written, and Sonar says "Settings not saved.". A cap saved moves the gauge at once, without a new page; the gauge follows the month's spending each time the usage is read again, and a cap changed on another device with it. On a Sonar from before `ui.number`, the gauge shows without the field. A reading that fails is said in its place, with "Retry". While the part shows, its usage is read again every 10 s, and the cost changes in place; not while the page is hidden or the group folded, and at once when the page shows again; a period chosen quickly twice shows the last one chosen.
- At the top of the Agents tab, while TypeSafe has no key: a note on what that changes, with "Open Services". Its × hides it in this browser for good (hidden by Sonar's plugin's ×, it stays hidden); it goes once the key is given, and comes back if the key is removed.
- When Jev switches itself off, at its cap or out of credits: Ping says it in his bubble, signed "Jev" (`api.ui.say`), its switch turns off without a new page, and its usage is read again. Without Sonar's voice, or on a Sonar from before `ui.say`, a brief error message says it.

The chart and the month's gauge are the extension's own (`src/page/chart.ts`, `src/page/cap.ts`, `src/page.css`), drawn with Sonar's tokens; the gauge tells its value to a screen reader (`role="meter"`). The switch, the cap's field, the note, the period's choice, the reading that failed and the brief message are Sonar's own parts (`api.ui`).

## What it needs, and what it costs

- A TypeSafe key, given in Sonar's Settings › Services (the key `typesafe`, for the user). Without one, Jev counts as off.
- It calls `api.typesafe.ai`, and TypeSafe bills each call by its input tokens: $0.042 per million (September 2026). Its card says it is paid.
- It stops itself at its monthly cap ($2 by default; none if you empty the field, and Jev is then never stopped for its spending), and at TypeSafe's first refusal for lack of credits (402). It then stays off until you turn it on again, and says why: a line in Sonar's log, in your language, and a live message to the page (below).

## How it judges

Each judgment is one call to TypeSafe's System One API, model `jev-latest`, as Sonar's plugin made it ([`src/questions.ts`](src/questions.ts)). The questions are in French whatever your language: Jev's thresholds were measured on these wordings ([`src/i18n-questions.ts`](src/i18n-questions.ts)). They name you by your name in Sonar's settings.

| Call | Question | Read as |
| --- | --- | --- |
| `judge` | the urgency (a score), and which sentence of the message sums it up (a choice among its last 40 sentences as Sonar cuts them, or none) | `{ urgency, status }`: 0 and `""` when Jev gives none, or a sentence it was not offered |
| `stillRelevant` | does your answer still fit the agent's message now (yes or no) | its probability, 0 when missing |
| `isCorrection` | does the new dictation correct the request under way | its probability, 0 when missing |
| `relatedPairs` | for each pair, do both agents work on the same thing | one probability per pair; no call without a pair |
| `chooseTopic` | which candidate is the session's topic, or none | the candidate's key; null for none, a choice it was not offered, or a confidence under 0.6 |
| `route` | what the sentence asks (open, next, fit or anything else), which agent it names, and whether it answers the agent last heard | `{ intent, target, confidence, reply, ms }`: an intent it was not offered goes to Ping |
| `yesOrNo` | the end-of-turn check's question, on the agent's last message | its probability; 0 when TypeSafe refuses |
| `lend` | | your key while Jev is on, else null: Sonar lends it, under the name `typesafe` (`lentAs`), with a session it runs on a linked computer; a key with a space inside or over 512 characters lends nothing |

Switched off, without a key, at its cap or out of credits, a call rejects with an Error bearing `off: true`: Sonar's judge does without it, as with no judge at all. A refusal of TypeSafe, a network error or an answer it cannot read rejects with a plain Error, which Sonar logs.

The yes or no follows its own rules, as in Sonar's plugin: it keeps the switch, but is neither counted nor capped; a key another Sonar lent with the session (`lentKey`) serves in place of yours, even without one here; it waits 8 s at most.

## Its routes

Under `/api/ext/typesafe-jev`, in plain JSON:

| Route | Answers |
| --- | --- |
| `GET /settings` | `{ "on": true, "key": "…1234", "monthlyUsd": 2 }`: the switch, the key's last 4 characters (null without a key), the monthly cap in dollars (null without a cap) |
| `POST /settings` | Takes `{ "on"?: boolean, "monthlyUsd"?: number from 0, or null for no cap }`, keeps what it does not name, and answers as `GET /settings`. Anything else answers 400. The key is given in Sonar's Settings › Services, not here. |
| `GET /usage?days=N` | The last `N` days (1 to 366, 30 by default), today last, and the month's spending against its cap (below). Another `N` answers 400. |

```json
{
	"days": [{ "day": "2026-11-21", "calls": 412, "tokens": 1203550, "usd": 0.0505, "estimated": false }],
	"month": { "usd": 0.73, "monthlyUsd": 2 }
}
```

- `calls`: the calls made that day, failed ones included. `tokens`: the input tokens TypeSafe billed.
- `usd`: the day's cost. A call TypeSafe gave no tokens for is estimated at the average of the calls it did (3 000 tokens before any): `estimated` is then true.
- `month.usd`: what Jev cost since the first of the month, from the billed tokens only, the one its cap is checked against. A call without tokens failed, and is not billed. `month.monthlyUsd`: its cap, null without one.

What it says live to the page when it stops itself: `{ "kind": "cap", "usd": 2 }` (its cap reached, in dollars) or `{ "kind": "credits" }` (TypeSafe out of credits).

## What it keeps

In its data folder (Sonar's `extension-data/typesafe-jev/`):

- `usage.json`: its usage by day, `{ "YYYY-MM-DD": { "calls": 412, "tokens": 1203550, "metered": 398 } }`, `metered` the calls whose tokens TypeSafe said. Written a few seconds after the last count, and when Sonar stops; written beside, then renamed. A file missing or unreadable counts zero.
- `former-usage.json`, written by Sonar when Jev moves from its plugin to this extension: the days Sonar counted, in the same form. At its start, the extension adds it to `usage.json` once, so that the month's cap does not start again from zero, then renames it `former-usage.taken.json`.

Its settings, `{ "on": true, "monthlyUsd": 2 }`, are in Sonar's settings file, under the extension's id; `"monthlyUsd": null` is no cap. A value that cannot be read takes its default.

## What differs from Sonar's plugin

- Its usage is its own: Sonar's usage page does not count it. `GET /usage` gives what it cost.
- Its switch and its cap are its own settings, not Sonar's `jev` and `jevMonthlyUsd`. Its key is the extension's, given in Settings › Services.
- Its cap is set in Settings › Services, under its switch, with the month's gauge beside it, and may be none; the plugin's cap was a number in Sonar's settings, without a gauge.
- It lends your key to a linked computer while its switch is on; the plugin lent it whenever it ran.
- At its cap, the log tells you to turn it on again in its settings or raise its cap, and the page sends you to Services; the plugin named Sonar's setting `jevMonthlyUsd`.
- Its card gives its short text and why its key is asked, in English and in French (`summary`, `why`, `translations`): Sonar shows them on its line in Settings › Extensions and on its key's card.

## Develop it

1. `bun install`, then `bun run check` (the types) and `bun test`.
2. `bun run build` writes `dist/` (the extension's folder: its card, `server.js` and `page.js` bundled, `page.css` and `icon.svg`) and `release/` (`extension.json` with the archive's SHA-256, and `extension.tar.gz`).

The tests run the server entry on the contract's testing kit (`@sonar/extension/testing`), without Sonar, against a fake TypeSafe on a local port ([`tests/fake-typesafe.ts`](tests/fake-typesafe.ts)), with a clock they set. They never call TypeSafe. The page has no kit: its tests check what it computes and says (`tests/page-figures.test.ts`, `tests/page-texts.test.ts`), and run its entry on a fake page that applies the contract's rules of places and toasts (`isPartPlace`, `toastRefusal`, `toastPace`) (`tests/page-start.test.ts`). The contract is not on npm yet: the repository's one copy lives in [`../vendor/`](../vendor/README.md).

## Install it in Sonar

In Sonar: Settings › Extensions › Add, then `Krosnoz/sonar-extensions/typesafe-jev`. Sonar shows its card, then installs it switched off. Switch it on: it runs from Sonar's next start. A Sonar from before Jev left its repository still has its plugin `jev`: switch that plugin off too, since Sonar's judge has one holder, the plugin first.

## Publish it

Set the `version` in `extension.json`. The next release of the repository publishes it with the other extensions: see the repository's [README](../README.md).

## License

MIT
