# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

A Tetris-style game in vanilla JavaScript with HTML5 Canvas. It has no dependencies, no build step, no package.json and no linter. The only tests cover the pure rules in `rules.js`: open `tests.html` or run `node tests.js`. Player-facing text (overlay messages, the controls list, README.md) is in Spanish. Keep new UI strings in Spanish.

## Running

Serve the folder statically and open http://localhost:8000:

    python3 -m http.server 8000

Opening `index.html` directly also works. To verify a change, reload the page in a browser. Run `node tests.js` after touching `rules.js`.

## Architecture

- `rules.js` holds the pure rules (no DOM, no globals of its own state): `makeBag(rng)` (7-bag), `makePieceSource(rng)` (the bag plus occasional pentominoes and the 1×1 reward; `game.js` uses it as `source`), `isTSpin()`, `scoreClear()`, the challenge data and logic (`CHALLENGES`, `challengeStatus()`, `makeGarbageRow()`, `makePrefillRows()`, `formatTime()`) and the score tables (`LINE_SCORES`, ...). It is a classic script loaded before `game.js`, so its top-level names are shared globals: never redeclare them in `game.js`. It also exports via `module.exports` for `tests.js`. Any scoring rule change goes here, with a test.
- `game.js` is a single classic script (not an ES module) loaded at the end of `index.html`. All game state is module-level `let` globals (`board`, `current`, `next`, `score`, `lines`, `level`, `combo`, `b2b`, `bag`, `popups`, `paused`, `gameOver`, `dropInterval`, `animId`, ...). `init()` resets all of them and is also the Restart button handler. Any new state must be reset there.
- Board model: a `ROWS × COLS` matrix where `0` means empty and `1–13` is a piece type (1–7 standard, 8–10 pentominoes `+`, `U`, `Y`, 11 the 1×1 reward, 12 the hollow 3×3 ring used by the Anillos challenge, 13 the grey fixed/garbage block, which exists only in `COLORS`, not in `PIECES`). The piece type is also the index into `COLORS`. `PIECES[type]` matrices store the type number in their filled cells, so cell values are drawn directly as color indices. To add or reorder a piece, keep `PIECES` and `COLORS` aligned and update the type ids in `rules.js`: the `[1..7]` list in `makeBag()`, `PENTOMINO_TYPES` and `SINGLE_TYPE`. `randomPiece()` just draws from `source`. A Tetris calls `source.reward()` in `lockPiece()`, so the 1×1 shows up in NEXT right after. Pieces must fit the 4×4 preview (the Y is the widest, 4 cells).
- Game loop: `loop(ts)` runs on `requestAnimationFrame` and adds frame deltas to `dropAccum`. Once `dropAccum` passes `dropInterval`, the piece moves down one row, or locks if it can't. Pausing cancels the animation frame. Resuming restarts it by calling `loop()` directly after resetting `lastTime`.
- Locking: `lockPiece()` detects a T-spin (before `merge()`, using `lastMoveWasRotation` + `countTCorners()`), runs `merge()`, `clearLines()` (which only removes rows and returns the count), checks for a perfect clear, then calls `scoreClear()` to update score/combo/b2b, updates lines, level and speed, calls `announce()` (floating text + sound) and finally `spawn()`. `lastMoveWasRotation` must be cleared by every successful move or drop and set only by a successful rotation. Game over is detected in `spawn()` when the new piece collides as it appears. There is no lock delay: a piece locks on the first gravity tick or soft drop where it can't move down.
- Rotation: `rotateCW` (clockwise only), then `tryRotate` tries horizontal kicks `[0, -1, 1, -2, 2]`. This is a simple kick list, not SRS.
- Rendering: `draw()` repaints the whole board every frame (grid, locked cells, ghost at alpha 0.2, then the active piece). The next-piece preview (`drawNext`) repaints only on `spawn()`. The HUD (`updateHUD`) is updated explicitly, not every frame.
- Scoring and speed: `scoreClear()` in `rules.js` (base × level × B2B 1.5 × combo multiplier, + 2000 × level for a perfect clear), plus 1 point per soft-drop row and 2 points per hard-drop row. The level is `floor(lines/10)+1`. `dropInterval = max(100, 1000 - (level-1)*90)` ms.

## Challenge mode

- `mode` (global in `game.js`) is the active entry of `CHALLENGES` or `null` for classic. `#mode-select` is filled from `CHALLENGES` at load (only "Clásico" is in the HTML); changing it sets `mode` and calls `init()`. `init()` reads `mode` for the prefilled board, `startLevel`, the garbage schedule and the `makePieceSource` options.
- A challenge is pure data; behaviors live in `game.js`: `checkChallenge()` (win/timeout via `challengeStatus`), `addGarbageRow()`, `reverseRotation()` + `tryRotate(dir)`, and the `showBoard` flag in `draw()` (Fantasma). Adding a challenge with an existing field needs only a `CHALLENGES` entry; a new kind of rule needs a field in `rules.js` plus its handling in `game.js`.
- `elapsed` is game time, advanced in `loop()` with a 100 ms cap per frame; it drives the timer, the garbage schedule and time limits. Pausing stops it. `endGame(reason)` takes `'topout'`, `'timeout'` or `'won'`.
- `level` is `(mode.startLevel || 1) + floor(lines / 10)` and the speed comes from `speedFor(level)`.
- A piece can end up above the board after garbage rises; `lockPiece()` treats that as game over instead of merging.
- `#goal-section` is hidden in classic mode (`hidden` attribute; the CSS has a `.panel-section[hidden]` rule because `display: flex` would otherwise win).

## Abilities (Clásico only)

- Pure logic in `rules.js`: `ABILITIES` (id, name, desc, `armed`), `addEnergy`, `pickAbilities`, and board transforms that return new boards (`explode`, `clearRowAndColumn`, `removeColor`, `compactColumns`, `removeFullRows`), plus `pickSwapType` and `abilityPoints`. `clearLines()` in `game.js` uses `removeFullRows`, so "what is a full row" lives in one place. Note `board` is reassigned by these (it is a `let`), so never keep a stale reference to it.
- State in `game.js`: `energy` (0–100), `armed` (`'bomb'`, `'ray'` or `null`), `choosingAbility`, `offeredAbilities`. All reset in `init()`.
- Flow: `E` → `openAbilityMenu()` (sets `paused` and `choosingAbility`, cancels the frame) → `chooseAbility(i)` / `closeAbilityMenu()` resume with `lastTime = performance.now(); loop(lastTime)`. While `choosingAbility` the `keydown` handler only reads 1–3 and Esc. `useAbility(id)` applies the effect; bomb/ray only set `armed`.
- `lockPiece()`: after `merge()`, `applyArmed()` runs before the normal `clearLines()`. Lines cleared by abilities go through `addLines()` and `abilityPoints()` (no combo, no B2B, no perfect clear, no energy). Only the normal `cleared` count feeds `addEnergy`.
- `liftCurrentIfBlocked()` (shared with `addGarbageRow()`) raises the active piece when the board changed under it, and ends the game if it can't fit.
- Disabled in challenges: `E` checks `!mode`, and `updateHUD()` hides `#energy-section` when `mode` is set.

## Cross-file couplings

- The `<canvas id="board">` size in `index.html` (240×480) must equal `COLS*BLOCK × ROWS*BLOCK`. Change it whenever `COLS`, `ROWS` or `BLOCK` changes. The layout is three columns: `.panel-left` (HOLD, controls), the board, `.panel-right` (NEXT, score, lines/level, combo); both panels are 120px wide so the board stays centered.
- `#next-canvas` (80×80) is drawn by `drawPreview()` with the block size hard-coded as `NB = 20` (it does not use `BLOCK`). The piece is centered by its occupied cells, so a canvas size change only needs the canvas attributes updated.
- `#hold-canvas` (80×80) shares the same `drawPreview`. `hold` stores only the piece type; `holdPiece()` recreates it with `createPiece(type)` in its spawn orientation. `holdUsed` blocks a second hold until `spawn()` brings the next piece.
- DOM ids that `game.js` looks up at load time: `board`, `next-canvas`, `hold-canvas`, `combo`, `mode-select`, `goal-section`, `goal`, `timer`, `energy-section`, `energy-fill`, `energy-label`, `ability-overlay`, `ability-list`, `score`, `lines`, `level`, `overlay`, `overlay-title`, `overlay-score`, `restart-btn`. The overlay is shown and hidden by toggling the `hidden` class.
- Key bindings live in the `keydown` handler at the bottom of `game.js`. They also appear in the controls list in `index.html` and the README controls table, so update all three together.
