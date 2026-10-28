# Cross Camp

A local browser strategy game with two modes: Linear and Ultra. Ultra uses exactly the same route movement, capture, checkpoint, Command, intelligence and base-health rules as Linear, with cards and coins added. Classic has been removed.

Originally inspired by Tim Grayson’s Tatakai; this is an independent evolving ruleset, unaffiliated with its creator.

## Run locally

`npm start`, then open http://localhost:8766. No build or dependencies. `npm test` checks the pure engine.

## Rules

The in-game briefing in index.html is the current complete rule reference. Six agents per player; 24 field spaces; three base health. Capture on landing, exact base hits return the attacker home. The six die specials remain available in both modes.

Both modes add two nonrenewable Command tokens (+1 or −1 to an unlocked roll), checkpoints on positions 11–14 that block jumping enemy defenders, and intelligence objectives at positions 7/8 for Ivory and 17/18 for Charcoal. Collect at the beginning of your turn by occupying either objective space with neither occupied by an enemy. Each player can collect once. At 160 turns intelligence breaks a tie; base destruction and elimination take precedence.

Ultra: three starting coins, one card, three offers each turn. Captures pay three coins, base hits one. Reinforcement costs six and uses an action. War Chest costs zero and uses an action for three coins. Marked Target costs one, follows a selected enemy agent and pays three extra on capture. Double Agent grants at most one extra action per turn. Recruitment and War Chest can consume extra actions. No market refresh or intelligence collection between extra actions. Forced dice persist through unrolled skips and cannot be changed by Command tokens or cards.

## Saves

Version 5 uses the new `crosscamp-v5` local storage key. Old Tatakai/Crosscamp saves remain untouched; incompatible old boards are not imported. New saves preserve card markets, RNG state, targets, Commands, intelligence and extra-action limits.

## Source layout

- linear.js: shared board rules and evaluation.
- engine.js: turn lifecycle, AI, Commands, cards, economy and save validation.
- app.js: accessible board controls, local saves, card reveals and UI.
- index.html: two-mode setup and current rules.

No deployment has been performed for this revision. The published site mirror is deliberately unchanged.

## Extreme prototype — local only

Extreme follows the supplied square-board sketch: two routes between opposite-corner bases, each with twelve rows and two interchangeable tracks (48 field spaces). Start with ten agents and five health. Roll three dice at once, spend in any order, reuse agents across dice, skip individual dice, or end the turn early. Exact base entry deals one damage and returns the attacker home.

Ordinary moves can finish on either track of their route. Single pieces can be passed; landing on a lone enemy captures it. Any fully occupied row blocks passage, including friendly or mixed rows. A two-enemy row also blocks ordinary capture landings. Two friendly attackers side by side immediately before an enemy pair may spend any die for a coordinated attack: one moves onto and captures one blocker while its supporter stays.

Specials: 1 retreat one row; 2 switch routes and optionally capture a blocker; 3 strike either enemy immediately ahead; 4 return home; 5 vault 1–5 rows over walls and optionally capture a blocker; 6 home defence captures an enemy on your half. Commands, intel, fixed checkpoints, cards and coins remain specific to the other modes. Extreme draws at 160 full turns if no base or elimination victory occurs.

Extreme logic is isolated in extreme.js. Saves retain selected and unspent dice. All three AI difficulties use the same three-die and blockade rules; Hard looks ahead within its remaining dice. The full local suite has 86 passing tests, including 18 Extreme checks, plus browser checks for new-game selection, dice order, individual skipping, reload, coordinated capture, computer turns and phone layout. No production deployment was made.

### Extreme dice combinations

Each agent may use only one movement die per turn. Actions can stack on the same agent. Reverse on a 1 can combine with a second unused die to move backward by that die’s value, consuming both; this is the agent’s one movement die. Alternatively, the 1 can be spent as a one-step-back action. Movement eligibility follows the agent even after scoring and returning home. Route switches, strikes, recalls, vaults and coordinated attacks use actions. Unspent dice and movement locks survive reload. The full suite now passes 90 tests. The public release includes the shared v5 Linear/Ultra changes and Extreme; the existing v4 save data remains untouched.

### Stronger Extreme protection and repair

Vault may jump past a pair but cannot land on or capture either protected agent. Route switching can capture a lone enemy but cannot land on a protected pair. Strike Ahead and coordinated two-agent attacks remain the ways to break a pair. A six now repairs one base health using an agent at home, up to the maximum of five; each repair spends one die. The computer follows the same repair and protection rules. Current saves remain compatible. 96 tests pass.

### Linear and Ultra home response priority

Landing on an invader on your turf still captures immediately. Landing on a resident defender on their turf creates a contested shared space: both agents survive, and the home defender may spend an action to capture regardless of roll, before or after rolling. If both agents remain through the home player’s full turn, the invader may spend an action to capture on its next turn without a matching roll. Moving either piece clears the face-off. Ultra extra actions do not satisfy or bypass the response turn. Strike Ahead targets invaders on home turf, so it cannot bypass the resident’s priority. A Capture enemy piece button and outlined contested spaces expose the state. Existing noncontested v5 saves remain compatible. 118 tests pass.

### Extreme home-turf blockades

An enemy pair on your turf can be struck or assaulted immediately. A pair defending its own turf instead requires a preparation action, then a full defender response turn, then another die to finish on the attacker’s next turn. This applies to both coordinated assault and Strike Ahead. Prepared assaults require both attackers to remain; strikes require their striker to remain. Moving either blocker or any involved attacker cancels preparation. Capturing an attacker also cancels it. Any remaining die may finish a ready attack, but extra dice in the preparation turn cannot finish early. Pending attacks, targets and readiness persist in saves, and the UI shows target outlines and prepare/finish actions. Existing saves without pending attacks remain compatible. 130 tests pass.
