# Tatakai — browser edition

A mobile-friendly, independent browser adaptation of Tim Grayson’s **Tatakai: A Game of Covert Warfare**. Original interface and code; no original artwork, packaging, or video is redistributed. Not affiliated with or endorsed by the creator.

## Play

Open `https://www.noahstambovsky.com/tatakai/`. Choose Easy, Medium, or Hard. Roll, select an Ivory agent, then a highlighted destination. Progress saves locally. No accounts, server, or API keys.

## Rules source

- Creator’s longer Concept & Mechanics explanation: https://www.facebook.com/tim.grayson/videos/2068646447088149/
- Creator’s 57-second rules demonstration: https://www.instagram.com/reels/DC6ewbOM20D/
- Original game: https://www.etsy.com/listing/992899200/tatakai-a-game-of-covert-warfare
- Reference: https://boardgamegeek.com/boardgame/422635/tatakai-a-game-of-covert-warfare

Both camps start with six agents. A die roll selects the **destination number**, not a movement distance. There are two spaces for each of 1–5 on each half of the board. On either numbered half, moving beside an enemy never captures immediately. The opponent gets a response turn; if both agents stay, the approaching agent can spend a later turn capturing without another matching roll. Home defenders responding to an approaching invader still need the matching number to countercapture. Occupied numbered spaces cannot be entered. Friendly agents occupying both spaces of one row protect one another. A six sends any battlefield agent home, or an agent already on the opponent’s half into the enemy camp: returning home removes an enemy infiltrator, and an agent already at home can spend a six to discover and remove one without moving; entering the enemy camp does not remove its defenders. An agent in an undefended enemy camp wins, including when the last defender leaves an already infiltrated camp.

### Explicit browser conventions

The two demonstrations do not supply the entire printed rulebook. Agents leaving camp must first deploy to a matching-number space in their own half. Once on the battlefield, an agent can relocate to a matching-number space on either half on a later roll. A six permits a battlefield agent to return home; infiltration requires starting on the opponent’s numbered half. Camp-to-camp jumps are prohibited. This deployment requirement follows the user’s clarification and the sequence shown in the videos. Numbered spaces hold one agent each. A returning or resident defender captures one infiltrator; captured agents stay removed. A turn with no legal move is passed. Losing all agents loses the game. A game draws at 300 moves. Ivory starts. These conventions are disclosed in the in-game briefing and can be revised against the printed rules.

## Difficulty

- Easy: random legal move, taking an immediate win when available.
- Medium: evaluates surviving agents, paired protection, camp defence, and infiltration.
- Hard: evaluates each move against the opponent’s best reply for all six possible rolls (expectiminimax).

All levels receive the same unbiased die rolls using `crypto.getRandomValues` and rejection sampling. The AI uses public board state only.

## Development and checks

Requires Node.js for tests and Python 3 for the simple local server. No build or dependencies.

```sh
npm test
npm start
```

Open http://localhost:8766. `engine.js` contains pure game logic; `app.js` handles the UI and saved state. Tests cover home-side deployment, camp-to-camp restrictions, captures, paired protection, infiltration, leaving camp, pass conditions, AI decisions, corrupt saves, and complete simulated games.

## Deploy

Copy `index.html`, `style.css`, `engine.js`, `app.js`, and `icon.svg` into `tatakai/` in the personal website’s publish directory. Commit and push GitHub first, then deploy that directory to the Cloudflare Pages project `noahstambovsky`. Keep all existing published site files in the upload; Cloudflare Direct Upload replaces a full deployment. Do not upload source docs, tests, `.git`, dependencies, or local backups.

## Clarification from the longer video

The Concept & Mechanics video explicitly shows capture from the **adjacent empty partner space**, not by landing on an enemy, and a home defender using a six to find an infiltrator without relocating. Version 3 corrects both behaviors and requires home-side deployment before crossing, including prohibiting camp-to-camp infiltration. Earlier saves are not loaded because their positions may reflect the superseded capture rule.

## Version 4 rule clarification

Implements the requested home-side advantage and opponent-side eligibility for base entry. Mixed rows encode threats directly; alternating turns provide the home response window without separate timers. In-place captures use the same legal move list for the UI and every AI level. Version 3 saves are not loaded because their positions reflect immediate away-side capture.

## Optional turn skip

On every turn, before or after rolling any number, either player may skip instead of moving or capturing. This consumes the turn and leaves all agents in place. All AI levels consider skipping; immediate wins still take priority. Existing v4 saves remain compatible.

## Separate approach and capture turns

Both halves now require an approach turn before capture. Pending approaches persist in saves and clear when either agent leaves the row. Existing saves remain compatible. Camp defence remains unchanged.

## Capture controls and Ultra cards

Capture enemy piece sits below Roll and Skip, with target choices for multiple captures and an explanation when capture is unavailable.

Ultra starts both sides with 3 coins, one random card, and three distinct market offers. Three new offers appear at the start of each turn. Buy into an eight-card hand, then play any number of held cards for free. Purchased offers are removed and cannot be purchased again. Unused cards persist, and saving/reloading never rerolls the market.

| Card | Buy cost | Effect |
| --- | ---: | --- |
| Reinforcements | 6 | New agent at home, using one action; eight living agents maximum. |
| Second Chance | 2 | Reroll the current unlocked die. |
| Loaded Die | 4 | Set the current unlocked die to a chosen face. |
| False Orders | 5 | Set and lock the enemy’s next roll; remains queued through unrolled skips. |
| Double Agent | 5 | One extra action this turn; stacks. Roll again after taking an action. |
| Marked Target | 3 | Next capture earns 3 bonus coins; stacks and persists until capture. |
| War Chest | 3 | Gain 4 coins immediately. |
| Dead Drop | 4 | Draw two random non-Dead-Drop cards; needs one free hand slot. |

Captures earn 3 coins. Ending your own turn with one or more infiltrators earns 1 coin, including skips. Extra actions do not pay income or refresh offers. Skipping forfeits remaining extra actions. A fresh approach cannot be captured during an extra action: the opponent still gets their response turn. Reinforcements do not sweep camp infiltrators. A victory ends immediately, regardless of extra actions.

Classic is unchanged. Existing Ultra games migrate once, retaining the board, coins, and queued rolls while granting each side one starting card. Hands, offers, card IDs, bonuses, pending response windows, and extra actions are saved. All difficulties share card prices and rules. These are initial balance settings.
