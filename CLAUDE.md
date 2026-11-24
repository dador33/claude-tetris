# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

A Tetris-style game in vanilla JavaScript with HTML5 Canvas. It has no dependencies, no build step, no package.json, no tests and no linter. Player-facing text (overlay messages, the controls list, README.md) is in Spanish. Keep new UI strings in Spanish.

## Running

Serve the folder statically and open http://localhost:8000:

    python3 -m http.server 8000

Opening `index.html` directly also works. To verify a change, reload the page in a browser. There is no automated test suite.

## Architecture

- `game.js` is a single classic script (not an ES module) loaded at the end of `index.html`. All game state is module-level `let` globals (`board`, `current`, `next`, `score`, `lines`, `level`, `paused`, `gameOver`, `dropInterval`, `animId`, ...). `init()` resets all of them and is also the Restart button handler. Any new state must be reset there.
- Board model: a `ROWS × COLS` matrix where `0` means empty and `1–7` is a piece type. The piece type is also the index into `COLORS`. `PIECES[type]` matrices store the type number in their filled cells, so cell values are drawn directly as color indices. To add or reorder a piece, keep `PIECES` and `COLORS` aligned and update the hard-coded `* 7` in `randomPiece()`.
- Game loop: `loop(ts)` runs on `requestAnimationFrame` and adds frame deltas to `dropAccum`. Once `dropAccum` passes `dropInterval`, the piece moves down one row, or locks if it can't. Pausing cancels the animation frame. Resuming restarts it by calling `loop()` directly after resetting `lastTime`.
- Locking: `lockPiece()` runs `merge()`, then `clearLines()` (which updates score, lines, level and speed), then `spawn()`. Game over is detected in `spawn()` when the new piece collides as it appears. There is no lock delay: a piece locks on the first gravity tick or soft drop where it can't move down.
- Rotation: `rotateCW` (clockwise only), then `tryRotate` tries horizontal kicks `[0, -1, 1, -2, 2]`. This is a simple kick list, not SRS.
- Rendering: `draw()` repaints the whole board every frame (grid, locked cells, ghost at alpha 0.2, then the active piece). The next-piece preview (`drawNext`) repaints only on `spawn()`. The HUD (`updateHUD`) is updated explicitly, not every frame.
- Scoring and speed: `LINE_SCORES[cleared] * level`, plus 1 point per soft-drop row and 2 points per hard-drop row. The level is `floor(lines/10)+1`. `dropInterval = max(100, 1000 - (level-1)*90)` ms.

## Cross-file couplings

- The `<canvas id="board">` size in `index.html` (300×600) must equal `COLS*BLOCK × ROWS*BLOCK`. Change it whenever `COLS`, `ROWS` or `BLOCK` changes.
- The `#next-canvas` (120×120) assumes a 4×4 preview grid with the block size hard-coded as `NB = 30` inside `drawNext()`. It does not use `BLOCK`.
- DOM ids that `game.js` looks up at load time: `board`, `next-canvas`, `score`, `lines`, `level`, `overlay`, `overlay-title`, `overlay-score`, `restart-btn`. The overlay is shown and hidden by toggling the `hidden` class.
- Key bindings live in the `keydown` handler at the bottom of `game.js`. They also appear in the controls list in `index.html` and the README controls table, so update all three together.
