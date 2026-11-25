'use strict';

const COLS = 10;
const ROWS = 20;
const BLOCK = 24;

const COLORS = [
  null,
  '#4dd0e1', // I - cyan
  '#ffd54f', // O - yellow
  '#ba68c8', // T - purple
  '#81c784', // S - green
  '#e57373', // Z - red
  '#90caf9', // J - azul pálido
  '#ffb74d', // L - orange
  '#f48fb1', // 8  + (pentominó) - rosa
  '#26a69a', // 9  U (pentominó) - verde azulado
  '#dce775', // 10 Y (pentominó) - lima
  '#b0bec5', // 11 1×1 (premio) - gris azulado
  '#a1887f', // 12 anillo hueco 3×3 (reto) - marrón
  '#607d8b', // 13 bloque fijo / basura (no es pieza) - gris oscuro
];

const PIECES = [
  null,
  [[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]], // I
  [[2,2],[2,2]],                               // O
  [[0,3,0],[3,3,3],[0,0,0]],                  // T
  [[0,4,4],[4,4,0],[0,0,0]],                  // S
  [[5,5,0],[0,5,5],[0,0,0]],                  // Z
  [[6,0,0],[6,6,6],[0,0,0]],                  // J
  [[0,0,7],[7,7,7],[0,0,0]],                  // L
  [[0,8,0],[8,8,8],[0,8,0]],                  // 8  +
  [[9,0,9],[9,9,9],[0,0,0]],                  // 9  U
  [[0,0,0,0],[10,10,10,10],[0,10,0,0],[0,0,0,0]], // 10 Y
  [[11]],                                      // 11 1×1
  [[12,12,12],[12,0,12],[12,12,12]],          // 12 anillo hueco 3×3
];

// Los ids de PENTOMINO_TYPES, SINGLE_TYPE, HOLLOW_TYPE y GARBAGE_TYPE (rules.js) deben coincidir
// con los índices de PIECES/COLORS. GARBAGE_TYPE (13) solo está en COLORS: no es una pieza.
// makePieceSource, CHALLENGES, challengeStatus, isTSpin, scoreClear, etc. vienen de rules.js (se carga antes).

const canvas = document.getElementById('board');
const ctx = canvas.getContext('2d');
const nextCanvas = document.getElementById('next-canvas');
const nextCtx = nextCanvas.getContext('2d');
const holdCanvas = document.getElementById('hold-canvas');
const holdCtx = holdCanvas.getContext('2d');
const comboEl = document.getElementById('combo');
const scoreEl = document.getElementById('score');
const linesEl = document.getElementById('lines');
const levelEl = document.getElementById('level');
const overlay = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlay-title');
const overlayScore = document.getElementById('overlay-score');
const restartBtn = document.getElementById('restart-btn');
const themeToggle = document.getElementById('theme-toggle');
const modeSelect = document.getElementById('mode-select');
const goalSection = document.getElementById('goal-section');
const goalEl = document.getElementById('goal');
const timerEl = document.getElementById('timer');
const energySection = document.getElementById('energy-section');
const energyFill = document.getElementById('energy-fill');
const energyLabel = document.getElementById('energy-label');
const abilityOverlay = document.getElementById('ability-overlay');
const abilityList = document.getElementById('ability-list');

let gridColor = '#22222e';

function applyTheme(theme, save) {
  document.documentElement.setAttribute('data-theme', theme);
  themeToggle.checked = theme === 'dark';
  gridColor = getComputedStyle(document.documentElement).getPropertyValue('--grid').trim() || gridColor;
  if (save) {
    try { localStorage.setItem('theme', theme); } catch (e) {}
  }
  // En pausa o game over el loop está cancelado: repintar a mano
  if (current && next) {
    draw();
    drawNext();
    drawHold();
  }
}

let board, current, next, score, lines, level, paused, gameOver, lastTime, dropAccum, dropInterval, animId;
// hold: tipo de la pieza reservada (o null). holdUsed: ya se usó el hold con la pieza actual.
let hold, holdUsed;
// source: generador de piezas (bolsa + pentominós + premios). combo: limpiezas seguidas previas (-1 = sin cadena).
// b2b: la última limpieza fue Tetris/T-spin. lastMoveWasRotation: para detectar T-spin.
// popups: textos flotantes sobre el tablero.
let source, combo, b2b, lastMoveWasRotation, popups;
// mode: reto activo (objeto de CHALLENGES) o null = clásico. elapsed: ms de juego activo (sin pausas).
// nextGarbageAt: instante (en elapsed) de la próxima fila de basura. lastLockAt: última pieza fijada
// (para el reto Fantasma). reverseAnnounced: ya se avisó de la rotación inversa.
let mode = null, elapsed, nextGarbageAt, lastLockAt, reverseAnnounced;
// Habilidades (solo Clásico). energy: 0–100. armed: 'bomb' | 'ray' | null (se aplica al fijar la
// próxima pieza). choosingAbility: menú abierto (el juego está en pausa). offeredAbilities: ids ofrecidos.
let energy, armed, choosingAbility, offeredAbilities;

const POPUP_MS = 1400;

function createBoard() {
  return Array.from({ length: ROWS }, () => new Array(COLS).fill(0));
}

// Pieza nueva del tipo dado, en orientación inicial y centrada arriba.
function createPiece(type) {
  const shape = PIECES[type].map(row => [...row]);
  return { type, shape, x: Math.floor(COLS / 2) - Math.floor(shape[0].length / 2), y: 0 };
}

function randomPiece() {
  return createPiece(source.next());
}

function collide(shape, ox, oy) {
  for (let r = 0; r < shape.length; r++) {
    for (let c = 0; c < shape[r].length; c++) {
      if (!shape[r][c]) continue;
      const nx = ox + c;
      const ny = oy + r;
      if (nx < 0 || nx >= COLS || ny >= ROWS) return true;
      if (ny >= 0 && board[ny][nx]) return true;
    }
  }
  return false;
}

function rotateCW(shape) {
  const rows = shape.length, cols = shape[0].length;
  const result = Array.from({ length: cols }, () => new Array(rows).fill(0));
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      result[c][rows - 1 - r] = shape[r][c];
  return result;
}

function rotateCCW(shape) {
  const rows = shape.length, cols = shape[0].length;
  const result = Array.from({ length: cols }, () => new Array(rows).fill(0));
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      result[cols - 1 - c][r] = shape[r][c];
  return result;
}

// dir = 1 horario, -1 antihorario (reto de rotación inversa).
function tryRotate(dir = 1) {
  const rotated = dir === 1 ? rotateCW(current.shape) : rotateCCW(current.shape);
  const kicks = [0, -1, 1, -2, 2];
  for (const kick of kicks) {
    if (!collide(rotated, current.x + kick, current.y)) {
      current.shape = rotated;
      current.x += kick;
      lastMoveWasRotation = true;
      return;
    }
  }
}

function merge() {
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      if (current.shape[r][c])
        board[current.y + r][current.x + c] = current.shape[r][c];
}

function clearLines() {
  const result = removeFullRows(board);
  board = result.board;
  return result.cleared;
}

// Límites (fila/columna mínima y máxima) de las celdas ocupadas de una forma.
function occupiedBounds(shape) {
  let minR = Infinity, maxR = -1, minC = Infinity, maxC = -1;
  for (let r = 0; r < shape.length; r++)
    for (let c = 0; c < shape[r].length; c++)
      if (shape[r][c]) {
        minR = Math.min(minR, r); maxR = Math.max(maxR, r);
        minC = Math.min(minC, c); maxC = Math.max(maxC, c);
      }
  return { minR, maxR, minC, maxC };
}

// Cuenta las esquinas ocupadas de la caja 3×3 de la T (paredes y suelo cuentan).
function countTCorners() {
  let occupied = 0;
  for (const [dx, dy] of [[0, 0], [2, 0], [0, 2], [2, 2]]) {
    const x = current.x + dx, y = current.y + dy;
    if (x < 0 || x >= COLS || y >= ROWS || (y >= 0 && board[y][x])) occupied++;
  }
  return occupied;
}

function ghostY() {
  let gy = current.y;
  while (!collide(current.shape, current.x, gy + 1)) gy++;
  return gy;
}

function hardDrop() {
  const gy = ghostY();
  score += (gy - current.y) * 2;
  if (gy > current.y) lastMoveWasRotation = false;
  current.y = gy;
  lockPiece();
}

function softDrop() {
  if (!collide(current.shape, current.x, current.y + 1)) {
    current.y++;
    lastMoveWasRotation = false;
    score += 1;
    updateHUD();
  } else {
    lockPiece();
  }
}

// Bloquea la pieza, puntúa (rules.js) y anuncia el resultado.
function lockPiece() {
  // La detección de T-spin debe hacerse antes de fusionar la pieza al tablero.
  const tspin = isTSpin(current.type, lastMoveWasRotation, current.type === 3 ? countTCorners() : 0);
  // Con basura subiendo puede quedar una pieza fuera del tablero por arriba: fin de partida.
  if (current.shape.some((row, r) => row.some(v => v) && current.y + r < 0)) {
    endGame('topout');
    return;
  }
  merge();
  lastLockAt = performance.now();
  // Bomba / Rayo armados: se aplican al fijar, antes de la limpieza normal.
  const usedArmed = armed !== null;
  const abilityLines = usedArmed ? applyArmed() : 0;
  const cleared = clearLines();
  // Tras una habilidad, dejar el tablero vacío no cuenta como Perfect Clear.
  const perfect = !usedArmed && cleared > 0 && board.every(row => row.every(v => v === 0));
  // Solo las líneas normales cargan energía (así las habilidades no se encadenan solas).
  if (!mode) energy = addEnergy(energy, cleared);

  const result = scoreClear({ cleared, tspin, perfect, combo, b2b, level });
  score += result.points + abilityPoints(abilityLines, level);
  combo = result.combo;
  b2b = result.b2b;
  if (cleared + abilityLines) addLines(cleared + abilityLines);
  if (reverseRotation() && !reverseAnnounced) {
    reverseAnnounced = true;
    popups.push({ text: 'ROTACIÓN INVERSA', born: performance.now(), size: 18 });
  }
  updateHUD();
  announce(result, cleared, perfect);
  if (cleared === 4) {
    // Premio por Tetris: una pieza 1×1 (sale en NEXT al hacer spawn).
    source.reward();
    popups.push({ text: 'BONUS 1×1', born: performance.now(), size: 16 });
  }
  checkChallenge();
  if (gameOver) return;
  spawn();
}

// Suma líneas y recalcula nivel y velocidad (flujo normal y habilidades).
function addLines(n) {
  lines += n;
  level = (mode && mode.startLevel || 1) + Math.floor(lines / 10);
  dropInterval = speedFor(level);
}

// ---- Habilidades ----

// Si la pieza activa quedó solapada (el tablero cambió bajo ella), la sube hasta liberarla;
// si no cabe, fin de partida. Devuelve true si la pieza quedó libre.
function liftCurrentIfBlocked() {
  let lift = 0;
  while (collide(current.shape, current.x, current.y) && lift < 4) { current.y--; lift++; }
  if (collide(current.shape, current.x, current.y)) {
    endGame('topout');
    return false;
  }
  return true;
}

// Aplica la habilidad armada a la pieza recién fusionada. Devuelve las líneas que limpió el Rayo.
function applyArmed() {
  const { minR, maxR, minC, maxC } = occupiedBounds(current.shape);
  const cx = current.x + Math.floor((minC + maxC) / 2);
  const cy = current.y + Math.floor((minR + maxR) / 2);
  let abilityLines = 0;
  if (armed === 'bomb') {
    board = explode(board, cx, cy);
  } else {
    const result = clearRowAndColumn(board, current.y + maxR, cx);
    board = result.board;
    abilityLines = result.lines;
  }
  popups.push({ text: armed === 'bomb' ? '¡BOOM!' : '¡RAYO!', born: performance.now(), size: 20 });
  playAbilitySound(armed);
  armed = null;
  return abilityLines;
}

// Aplica una habilidad elegida. Bomba y Rayo quedan armadas; las demás actúan al instante.
function useAbility(id) {
  energy = 0;
  const say = text => popups.push({ text, born: performance.now(), size: 18 });
  switch (id) {
    case 'bomb':
    case 'ray':
      armed = id;
      say(id === 'bomb' ? 'BOMBA ARMADA' : 'RAYO ARMADO');
      break;
    case 'color':
      board = removeColor(board, current.type);
      say('BORRAR COLOR');
      break;
    case 'gravity': {
      const result = removeFullRows(compactColumns(board));
      board = result.board;
      if (result.cleared) {
        score += abilityPoints(result.cleared, level);
        addLines(result.cleared);
      }
      say('GRAVEDAD');
      // Un bloque con voladizo puede caer sobre la pieza activa.
      if (!liftCurrentIfBlocked()) return;
      break;
    }
    case 'swap': {
      let piece = createPiece(pickSwapType(current.type));
      const inPlace = { ...piece, x: current.x, y: current.y };
      if (!collide(inPlace.shape, inPlace.x, inPlace.y)) piece = inPlace;
      else if (collide(piece.shape, piece.x, piece.y)) {
        energy = ENERGY_MAX; // no cabe en ningún sitio: se devuelve la energía
        say('NO CABE');
        break;
      }
      current = piece;
      lastMoveWasRotation = false;
      say('CAMBIO');
      break;
    }
  }
  playAbilitySound(id);
  updateHUD();
}

function openAbilityMenu() {
  offeredAbilities = pickAbilities(ABILITIES, 3);
  abilityList.innerHTML = '';
  offeredAbilities.forEach((id, i) => {
    const ability = ABILITIES.find(a => a.id === id);
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'ability-btn';
    const key = document.createElement('kbd');
    key.textContent = String(i + 1);
    const text = document.createElement('span');
    text.textContent = `${ability.name} — ${ability.desc}`;
    button.appendChild(key);
    button.appendChild(text);
    button.addEventListener('click', () => chooseAbility(i));
    abilityList.appendChild(button);
  });
  cancelAnimationFrame(animId);
  choosingAbility = true;
  paused = true;
  abilityOverlay.classList.remove('hidden');
}

// Cierra el menú y reanuda el juego (a menos que la habilidad haya terminado la partida).
function closeAbilityMenu() {
  choosingAbility = false;
  paused = false;
  abilityOverlay.classList.add('hidden');
  if (gameOver) return;
  lastTime = performance.now();
  loop(lastTime);
}

function chooseAbility(index) {
  const id = offeredAbilities[index];
  if (!id) return;
  choosingAbility = false;
  paused = false;
  abilityOverlay.classList.add('hidden');
  useAbility(id);
  if (gameOver) return;
  lastTime = performance.now();
  loop(lastTime);
}

// Contorno pulsante sobre la pieza activa mientras hay una habilidad armada.
function drawArmedOutline() {
  const pulse = 0.5 + 0.5 * Math.sin(performance.now() / 150);
  ctx.strokeStyle = armed === 'bomb' ? '#ff5252' : '#ffeb3b';
  ctx.lineWidth = 2;
  ctx.globalAlpha = 0.4 + 0.6 * pulse;
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      if (current.shape[r][c])
        ctx.strokeRect((current.x + c) * BLOCK + 2, (current.y + r) * BLOCK + 2, BLOCK - 4, BLOCK - 4);
  ctx.globalAlpha = 1;
}

// ---- Retos ----

function speedFor(lvl) {
  return Math.max(100, 1000 - (lvl - 1) * 90);
}

// En el reto de rotación inversa, desde cierto nivel ↑/X giran en sentido antihorario.
function reverseRotation() {
  return !!(mode && mode.reverseFromLevel && level >= mode.reverseFromLevel);
}

// Termina la partida si el reto se ganó o se agotó el tiempo.
function checkChallenge() {
  if (!mode || gameOver) return;
  const status = challengeStatus(mode, { lines, elapsedMs: elapsed });
  if (status !== 'playing') endGame(status === 'won' ? 'won' : 'timeout');
}

// Supervivencia: sube una fila de basura desde abajo.
function addGarbageRow() {
  if (board[0].some(v => v)) { endGame('topout'); return; }
  board.shift();
  board.push(makeGarbageRow(COLS));
  // La pieza activa sube con el tablero hasta quedar libre; si no cabe, fin de partida.
  liftCurrentIfBlocked();
}

// Cuenta atrás si el reto tiene límite o meta de supervivencia; si no, tiempo transcurrido.
function updateTimer() {
  if (!mode) return;
  const limit = mode.timeLimitMs || mode.surviveMs;
  const text = formatTime(limit ? limit - elapsed : elapsed);
  if (timerEl.textContent !== text) timerEl.textContent = text;
}

// ---- Efectos: textos flotantes y sonido ----

function announce(result, cleared, perfect) {
  if (result.labels.length) {
    const now = performance.now();
    // Máx. 24 px para que "PERFECT CLEAR" quepa en el tablero de 240 px.
    const size = 16 + Math.min(Math.max(result.combo, 0), 4) * 2;
    result.labels.forEach(text => popups.push({ text, born: now, size }));
  }
  if (result.points > 0) {
    popups.push({ text: `+${result.points.toLocaleString()}`, born: performance.now(), size: 16 });
  }
  playClearSound(result, cleared, perfect);
}

let audioCtx = null;
let muted = false;

function tone(freq, delay, dur, type, vol) {
  if (muted) return;
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const t0 = audioCtx.currentTime + delay;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(vol, t0);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(gain).connect(audioCtx.destination);
    osc.start(t0);
    osc.stop(t0 + dur);
  } catch (e) { /* sin audio disponible: el juego sigue igual */ }
}

function playAbilitySound(id) {
  switch (id) {
    case 'bomb': tone(110, 0, 0.35, 'sawtooth', 0.1); tone(70, 0.05, 0.4, 'square', 0.08); break;
    case 'ray': tone(1500, 0, 0.12, 'sawtooth', 0.07); tone(300, 0.08, 0.25, 'sawtooth', 0.07); break;
    case 'gravity': [500, 400, 300, 200].forEach((f, i) => tone(f, i * 0.06, 0.12, 'triangle', 0.08)); break;
    default: tone(660, 0, 0.1, 'triangle', 0.08); tone(990, 0.08, 0.15, 'triangle', 0.08);
  }
}

// Arpegio por líneas; el tono sube un semitono por cada eslabón del combo.
// Los eventos especiales (T-spin, Tetris, B2B, Perfect Clear) añaden un campanilleo agudo.
function playClearSound(result, cleared, perfect) {
  if (cleared === 0 && result.labels.length === 0) return;
  const base = 330 * Math.pow(2, Math.min(Math.max(result.combo, 0), 12) / 12);
  const steps = [0, 4, 7, 12];
  for (let i = 0; i < Math.max(cleared, 1); i++) {
    tone(base * Math.pow(2, steps[i] / 12), i * 0.07, 0.16, 'square', 0.06);
  }
  if (result.labels.length) {
    tone(1318, 0.12, 0.25, 'triangle', 0.08);
    tone(1760, 0.2, 0.3, 'triangle', 0.08);
  }
  if (perfect) {
    [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, 0.3 + i * 0.08, 0.3, 'triangle', 0.09));
  }
}

function drawPopups() {
  const now = performance.now();
  popups = popups.filter(p => now - p.born < POPUP_MS);
  ctx.textAlign = 'center';
  ctx.lineJoin = 'round';
  popups.forEach((p, i) => {
    const t = (now - p.born) / POPUP_MS;
    ctx.globalAlpha = 1 - t * t;
    ctx.font = `bold ${p.size}px 'Courier New', monospace`;
    const y = canvas.height * 0.28 + i * 26 - t * 20;
    ctx.lineWidth = 4;
    ctx.strokeStyle = 'rgba(0,0,0,0.75)';
    ctx.strokeText(p.text, canvas.width / 2, y);
    ctx.fillStyle = p.text.startsWith('+') ? '#fff' : '#ffd54f';
    ctx.fillText(p.text, canvas.width / 2, y);
  });
  ctx.globalAlpha = 1;
}

function spawn() {
  current = next;
  next = randomPiece();
  holdUsed = false;
  lastMoveWasRotation = false;
  drawHold();
  if (collide(current.shape, current.x, current.y)) {
    endGame();
    return;
  }
  drawNext();
}

// Reserva la pieza actual (o la intercambia con la reservada).
// Solo una vez por pieza: se rehabilita cuando la siguiente pieza aparece en spawn().
function holdPiece() {
  if (holdUsed) return;
  const heldType = hold;
  hold = current.type;
  if (heldType === null) {
    spawn();
  } else {
    current = createPiece(heldType);
    lastMoveWasRotation = false;
    if (collide(current.shape, current.x, current.y)) {
      endGame();
      return;
    }
  }
  dropAccum = 0;
  holdUsed = true;
  drawHold();
}

function updateHUD() {
  scoreEl.textContent = score.toLocaleString();
  linesEl.textContent = mode && mode.goalLines ? `${lines}/${mode.goalLines}` : lines;
  levelEl.textContent = level;
  goalSection.hidden = !mode;
  goalEl.textContent = mode ? mode.goal + (reverseRotation() ? ' · ¡GIRO INVERSO!' : '') : '';
  updateTimer();
  // Barra de energía (solo Clásico).
  energySection.hidden = !!mode;
  energyFill.style.width = `${energy}%`;
  energyFill.classList.toggle('full', energy >= ENERGY_MAX);
  energyLabel.textContent = armed
    ? (armed === 'bomb' ? 'BOMBA ARMADA' : 'RAYO ARMADO')
    : energy >= ENERGY_MAX ? 'LISTO · E' : `${Math.floor(energy)}%`;
  // Combo visible desde la 2ª limpieza seguida; B2B indica que el próximo Tetris/T-spin puntúa x1.5.
  const comboText = combo >= 1 ? `x${combo + 1}` : '–';
  comboEl.textContent = b2b ? `${comboText} B2B` : comboText;
}

function drawBlock(context, x, y, colorIndex, size, alpha) {
  if (!colorIndex) return;
  const color = COLORS[colorIndex];
  context.globalAlpha = alpha ?? 1;
  context.fillStyle = color;
  context.fillRect(x * size + 1, y * size + 1, size - 2, size - 2);
  // highlight
  context.fillStyle = 'rgba(255,255,255,0.12)';
  context.fillRect(x * size + 1, y * size + 1, size - 2, 4);
  context.globalAlpha = 1;
}

function drawGrid() {
  ctx.strokeStyle = gridColor;
  ctx.lineWidth = 0.5;
  for (let c = 1; c < COLS; c++) {
    ctx.beginPath();
    ctx.moveTo(c * BLOCK, 0);
    ctx.lineTo(c * BLOCK, ROWS * BLOCK);
    ctx.stroke();
  }
  for (let r = 1; r < ROWS; r++) {
    ctx.beginPath();
    ctx.moveTo(0, r * BLOCK);
    ctx.lineTo(COLS * BLOCK, r * BLOCK);
    ctx.stroke();
  }
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawGrid();

  // Reto Fantasma: la pila solo se ve un instante tras fijar una pieza (y al terminar).
  // Sin pila visible tampoco se dibuja el ghost, que delataría dónde cae la pieza.
  const showBoard = gameOver || !mode || !mode.invisible || performance.now() - lastLockAt < 700;

  // board
  if (showBoard)
    for (let r = 0; r < ROWS; r++)
      for (let c = 0; c < COLS; c++)
        drawBlock(ctx, c, r, board[r][c], BLOCK);

  // Tras el game over la pieza que no cupo no se dibuja sobre la pila.
  if (!gameOver) {
    // ghost
    if (showBoard) {
      const gy = ghostY();
      for (let r = 0; r < current.shape.length; r++)
        for (let c = 0; c < current.shape[r].length; c++)
          if (current.shape[r][c])
            drawBlock(ctx, current.x + c, gy + r, current.shape[r][c], BLOCK, 0.2);
    }

    // current piece
    for (let r = 0; r < current.shape.length; r++)
      for (let c = 0; c < current.shape[r].length; c++)
        drawBlock(ctx, current.x + c, current.y + r, current.shape[r][c], BLOCK);

    if (armed) drawArmedOutline();
  }

  drawPopups();
}

// Dibuja una pieza centrada en un canvas de vista previa 4×4 (NEXT y HOLD).
// piece puede ser null (slot vacío).
function drawPreview(context, previewCanvas, piece, alpha) {
  const NB = 20;
  context.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
  if (!piece) return;
  const shape = piece.shape;
  // Centrar por las celdas ocupadas, no por la matriz (que trae filas/columnas vacías).
  const { minR, maxR, minC, maxC } = occupiedBounds(shape);
  // Offsets en celdas (pueden ser fraccionarios: drawBlock multiplica por NB).
  const offX = (previewCanvas.width / NB - (maxC - minC + 1)) / 2 - minC;
  const offY = (previewCanvas.height / NB - (maxR - minR + 1)) / 2 - minR;
  for (let r = 0; r < shape.length; r++)
    for (let c = 0; c < shape[r].length; c++)
      drawBlock(context, offX + c, offY + r, shape[r][c], NB, alpha);
}

function drawNext() {
  drawPreview(nextCtx, nextCanvas, next, 1);
}

// Atenuado mientras el hold está bloqueado en el turno actual.
function drawHold() {
  drawPreview(holdCtx, holdCanvas, hold ? createPiece(hold) : null, holdUsed ? 0.35 : 1);
}

// reason: 'topout' (tablero lleno), 'timeout' (tiempo agotado en un reto) o 'won' (reto cumplido).
function endGame(reason = 'topout') {
  gameOver = true;
  cancelAnimationFrame(animId);
  const won = reason === 'won';
  overlayTitle.textContent = won ? '¡RETO CUMPLIDO!' : reason === 'timeout' ? 'TIEMPO AGOTADO' : 'GAME OVER';
  overlayTitle.classList.toggle('win', won);
  overlayScore.textContent = `Puntuación: ${score.toLocaleString()}` + (mode ? ` · Tiempo ${formatTime(elapsed)}` : '');
  overlay.classList.remove('hidden');
}

function togglePause() {
  if (gameOver) return;
  paused = !paused;
  if (!paused) {
    lastTime = performance.now();
    loop(lastTime);
  } else {
    cancelAnimationFrame(animId);
    overlayTitle.textContent = 'PAUSA';
    overlayTitle.classList.remove('win');
    overlayScore.textContent = '';
    overlay.classList.remove('hidden');
  }
}

function loop(ts) {
  const dt = ts - lastTime;
  lastTime = ts;
  // El tope de 100 ms evita ganar tiempo en un reto dejando la pestaña en segundo plano.
  elapsed += Math.min(dt, 100);
  dropAccum += dt;
  if (elapsed >= nextGarbageAt) {
    nextGarbageAt += mode.garbageEveryMs;
    addGarbageRow();
  }
  checkChallenge();
  if (gameOver) {
    draw();
    return;
  }
  updateTimer();
  if (dropAccum >= dropInterval) {
    dropAccum = 0;
    if (!collide(current.shape, current.x, current.y + 1)) {
      current.y++;
      lastMoveWasRotation = false;
    } else {
      lockPiece();
      if (gameOver) {
        // endGame() ya canceló el bucle; no reprogramarlo.
        draw();
        return;
      }
    }
  }
  draw();
  animId = requestAnimationFrame(loop);
}

function init() {
  board = createBoard();
  if (mode && mode.prefillRows) {
    const rows = makePrefillRows(mode.prefillRows, COLS);
    rows.forEach((row, i) => { board[ROWS - rows.length + i] = row; });
  }
  score = 0;
  lines = 0;
  level = mode && mode.startLevel || 1;
  paused = false;
  gameOver = false;
  dropInterval = speedFor(level);
  dropAccum = 0;
  lastTime = performance.now();
  elapsed = 0;
  nextGarbageAt = mode && mode.garbageEveryMs ? mode.garbageEveryMs : Infinity;
  lastLockAt = performance.now();
  reverseAnnounced = false;
  energy = 0;
  armed = null;
  choosingAbility = false;
  offeredAbilities = [];
  abilityOverlay.classList.add('hidden');
  overlayTitle.classList.remove('win');
  hold = null;
  holdUsed = false;
  source = makePieceSource(Math.random, mode ? mode.pieces : undefined);
  combo = -1;
  b2b = false;
  lastMoveWasRotation = false;
  popups = [];
  next = randomPiece();
  spawn();
  updateHUD();
  overlay.classList.add('hidden');
  cancelAnimationFrame(animId);
  animId = requestAnimationFrame(loop);
}

document.addEventListener('keydown', e => {
  // Con el menú de habilidades abierto solo valen 1-3 y Esc.
  if (choosingAbility) {
    const choice = { Digit1: 0, Digit2: 1, Digit3: 2, Numpad1: 0, Numpad2: 1, Numpad3: 2 }[e.code];
    if (choice !== undefined) chooseAbility(choice);
    else if (e.code === 'Escape') closeAbilityMenu();
    return;
  }
  if (e.code === 'KeyP') { togglePause(); return; }
  if (e.code === 'KeyM') { muted = !muted; return; }
  if (paused || gameOver) return;
  switch (e.code) {
    case 'ArrowLeft':
      if (!collide(current.shape, current.x - 1, current.y)) { current.x--; lastMoveWasRotation = false; }
      break;
    case 'ArrowRight':
      if (!collide(current.shape, current.x + 1, current.y)) { current.x++; lastMoveWasRotation = false; }
      break;
    case 'ArrowDown':
      softDrop();
      break;
    case 'ArrowUp':
    case 'KeyX':
      tryRotate(reverseRotation() ? -1 : 1);
      break;
    case 'Space':
      e.preventDefault();
      hardDrop();
      break;
    case 'KeyC':
    case 'ShiftLeft':
    case 'ShiftRight':
      holdPiece();
      break;
    case 'KeyE':
      // Solo en Clásico, con la barra llena y sin otra habilidad armada.
      if (!mode && energy >= ENERGY_MAX && !armed) openAbilityMenu();
      break;
  }
  updateHUD();
});

restartBtn.addEventListener('click', init);

themeToggle.addEventListener('change', () => {
  applyTheme(themeToggle.checked ? 'dark' : 'light', true);
  themeToggle.blur(); // evita que Space active el switch en vez de la caída
});

// Selector de modo: "Clásico" (value "") más un reto por entrada de CHALLENGES.
CHALLENGES.forEach(c => {
  const option = document.createElement('option');
  option.value = c.id;
  option.textContent = c.name;
  modeSelect.appendChild(option);
});

modeSelect.addEventListener('change', () => {
  mode = CHALLENGES.find(c => c.id === modeSelect.value) || null;
  modeSelect.blur(); // las flechas del teclado no deben seguir cambiando el modo
  init();
});

applyTheme(document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark', false);

init();
