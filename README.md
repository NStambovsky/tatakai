# Tatakai — browser edition

A mobile-friendly, independent browser adaptation of Tim Grayson’s **Tatakai: A Game of Covert Warfare**. Original interface and code; no original artwork, packaging, or video is redistributed. Not affiliated with or endorsed by the creator.

## Play

Open `https://www.noahstambovsky.com/tatakai/`. Choose Easy, Medium, or Hard. Roll, select an Ivory agent, then a highlighted destination. Progress saves locally. No accounts, server, or API keys.

## Rules source

- Creator’s 57-second rules demonstration: https://www.instagram.com/reels/DC6ewbOM20D/
- Original game: https://www.etsy.com/listing/992899200/tatakai-a-game-of-covert-warfare
- Reference: https://boardgamegeek.com/boardgame/422635/tatakai-a-game-of-covert-warfare

Both camps start with six agents. A die roll selects the **destination number**, not a movement distance. There are two spaces for each of 1–5 on each half of the board. A lone enemy may be captured by moving onto its space. Friendly agents occupying both spaces of one row protect one another. A six sends an agent to either camp: returning home removes an enemy infiltrator; entering the enemy camp does not remove its defenders. An agent in an undefended enemy camp wins, including when the last defender leaves an already infiltrated camp.

### Explicit browser conventions

The short demonstration does not supply the entire printed rulebook. This edition permits any surviving agent to relocate to any matching-number space, regardless of territory. Numbered spaces hold one agent each. A returning defender captures one infiltrator; captured agents stay removed. A turn with no legal move is passed. Losing all agents loses the game. A game draws at 300 moves. Ivory starts. These conventions are disclosed in the in-game briefing and can be revised against the printed rules.

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

Open http://localhost:8766. `engine.js` contains pure game logic; `app.js` handles the UI and saved state. Tests cover captures, paired protection, infiltration, leaving camp, pass conditions, AI decisions, corrupt saves, and complete simulated games.

## Deploy

Copy `index.html`, `style.css`, `engine.js`, `app.js`, and `icon.svg` into `tatakai/` in the personal website’s publish directory. Commit and push GitHub first, then deploy that directory to the Cloudflare Pages project `noahstambovsky`. Keep all existing published site files in the upload; Cloudflare Direct Upload replaces a full deployment. Do not upload source docs, tests, `.git`, dependencies, or local backups.
