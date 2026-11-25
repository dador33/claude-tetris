'use strict';

// Reglas puras del juego: sin DOM, sin estado global, sin Math.random directo.
// Se cargan antes de game.js y se prueban en tests.html (o con `node tests.js`).

const LINE_SCORES = [0, 100, 300, 500, 800];
const TSPIN_SCORES = [400, 800, 1200, 1600]; // por 0, 1, 2 y 3 líneas
const PERFECT_CLEAR_BONUS = 2000;            // × nivel
const B2B_MULTIPLIER = 1.5;
const TSPIN_NAMES = ['', ' SINGLE', ' DOUBLE', ' TRIPLE'];

// Generador "bolsa de 7": reparte los 7 tipos en orden aleatorio y vuelve a
// mezclar al vaciarse, así nunca hay sequías largas de una misma pieza.
// rng se inyecta para poder probarlo de forma determinista.
function makeBag(rng = Math.random) {
  let bag = [];
  return {
    next() {
      if (bag.length === 0) {
        bag = [1, 2, 3, 4, 5, 6, 7];
        for (let i = bag.length - 1; i > 0; i--) {
          const j = Math.floor(rng() * (i + 1));
          [bag[i], bag[j]] = [bag[j], bag[i]];
        }
      }
      return bag.pop();
    },
  };
}

// Ids de pieza especiales. Deben coincidir con los índices de PIECES y COLORS en game.js.
const PENTOMINO_TYPES = [8, 9, 10]; // +, U, Y
const SINGLE_TYPE = 11;             // 1×1, premio tras un Tetris
const PENTOMINO_CHANCE = 0.1;       // probabilidad por pieza, cuando el enfriamiento lo permite
const PENTOMINO_COOLDOWN = 5;       // mínimo de piezas estándar entre dos pentominós

// Fuente de piezas: bolsa de 7 + pentominós ocasionales + premios 1×1.
// Los pentominós no alteran la bolsa: las piezas estándar siguen saliendo en
// grupos de 7 sin repetir. reward() encola una pieza 1×1 que saldrá la próxima vez.
// Opciones (cada reto puede fijar las suyas): specials = tipos que pueden colarse
// ([] = solo piezas estándar), chance = probabilidad por pieza, cooldown = mínimo
// de piezas estándar entre dos especiales.
function makePieceSource(rng = Math.random, options = {}) {
  const { specials = PENTOMINO_TYPES, chance = PENTOMINO_CHANCE, cooldown = PENTOMINO_COOLDOWN } = options;
  const bag = makeBag(rng);
  let standardSinceSpecial = 0;
  let pendingRewards = 0;
  return {
    next() {
      if (pendingRewards > 0) {
        pendingRewards--;
        return SINGLE_TYPE;
      }
      if (specials.length > 0 && standardSinceSpecial >= cooldown && rng() < chance) {
        standardSinceSpecial = 0;
        return specials[Math.floor(rng() * specials.length)];
      }
      standardSinceSpecial++;
      return bag.next();
    },
    reward() {
      pendingRewards++;
    },
  };
}

// ---- Modo desafío ----

const HOLLOW_TYPE = 12;  // anillo 3×3 hueco: el hueco central no se puede rellenar
const GARBAGE_TYPE = 13; // bloques grises fijos (basura y tablero pre-colocado)

// Un reto es solo datos; game.js los interpreta.
//   goalLines / timeLimitMs: limpiar N líneas antes de que acabe el tiempo.
//   surviveMs: ganar al aguantar ese tiempo.
//   garbageEveryMs: sube una fila de basura cada X ms.
//   prefillRows: filas de bloques fijos al empezar.
//   invisible: las piezas se ocultan poco después de fijarse.
//   startLevel / reverseFromLevel: nivel inicial y nivel desde el que se rota al revés.
//   pieces: opciones de makePieceSource.
const CHALLENGES = [
  { id: 'sprint', name: 'Sprint: 40 líneas', goal: 'Limpia 40 líneas en 2:00',
    goalLines: 40, timeLimitMs: 120000, pieces: { specials: [] } },
  { id: 'garbage', name: 'Supervivencia', goal: 'Aguanta 90 s. Sube basura cada 10 s',
    surviveMs: 90000, garbageEveryMs: 10000, pieces: { specials: [] } },
  { id: 'prefill', name: 'Obras', goal: 'Limpia 20 líneas del tablero lleno',
    goalLines: 20, prefillRows: 8, pieces: { specials: [] } },
  { id: 'ghost', name: 'Fantasma', goal: 'Limpia 10 líneas. Las piezas se ocultan',
    goalLines: 10, invisible: true, pieces: { specials: [] } },
  { id: 'reverse', name: 'Rotación inversa', goal: 'Limpia 30 líneas. Desde el nivel 6 se gira al revés',
    goalLines: 30, startLevel: 5, reverseFromLevel: 6, pieces: { specials: [] } },
  { id: 'rings', name: 'Anillos', goal: 'Limpia 15 líneas esquivando anillos huecos',
    goalLines: 15, pieces: { specials: [HOLLOW_TYPE], chance: 0.25, cooldown: 3 } },
];

// 'won' | 'lost' (tiempo agotado) | 'playing'. Perder por tablero lleno lo decide game.js.
function challengeStatus(challenge, { lines, elapsedMs }) {
  if (challenge.goalLines && lines >= challenge.goalLines) return 'won';
  if (challenge.surviveMs && elapsedMs >= challenge.surviveMs) return 'won';
  if (challenge.timeLimitMs && elapsedMs >= challenge.timeLimitMs) return 'lost';
  return 'playing';
}

// Fila de basura: llena salvo un hueco aleatorio.
function makeGarbageRow(cols, rng = Math.random) {
  const hole = Math.floor(rng() * cols);
  return Array.from({ length: cols }, (_, c) => (c === hole ? 0 : GARBAGE_TYPE));
}

// Filas iniciales: cada celda se rellena con ~75 % de probabilidad, pero nunca
// una fila completa (siempre queda al menos un hueco).
function makePrefillRows(count, cols, rng = Math.random) {
  return Array.from({ length: count }, () => {
    const row = Array.from({ length: cols }, () => (rng() < 0.75 ? GARBAGE_TYPE : 0));
    if (row.every(v => v !== 0)) row[Math.floor(rng() * cols)] = 0;
    return row;
  });
}

// m:ss, redondeando hacia arriba (cuenta atrás natural); nunca negativo.
function formatTime(ms) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

// ---- Habilidades (solo modo Clásico) ----
// Todas las funciones de tablero son puras: reciben una matriz y devuelven otra nueva.

const ENERGY_PER_LINE = 12.5; // 8 líneas llenan la barra
const ENERGY_MAX = 100;

// armed: se aplica al fijar la próxima pieza. Si no, es inmediata.
const ABILITIES = [
  { id: 'bomb', name: 'Bomba 3×3', desc: 'La próxima pieza borra un área 3×3 al fijarse', armed: true },
  { id: 'ray', name: 'Rayo', desc: 'La próxima pieza borra su fila más baja y su columna', armed: true },
  { id: 'color', name: 'Borrar color', desc: 'Quita todos los bloques del color de la pieza actual', armed: false },
  { id: 'gravity', name: 'Gravedad', desc: 'Compacta las columnas y limpia filas completas', armed: false },
  { id: 'swap', name: 'Cambiar pieza', desc: 'Cambia la pieza actual por otra estándar', armed: false },
];

function addEnergy(energy, lines) {
  return Math.min(ENERGY_MAX, energy + lines * ENERGY_PER_LINE);
}

// n ids distintos del pool, en orden aleatorio.
function pickAbilities(pool, n, rng = Math.random) {
  const ids = pool.map(a => a.id);
  for (let i = ids.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [ids[i], ids[j]] = [ids[j], ids[i]];
  }
  return ids.slice(0, n);
}

const copyBoard = board => board.map(row => [...row]);

// Vacía el área 3×3 centrada en (cx, cy); lo que cae fuera del tablero se ignora.
function explode(board, cx, cy) {
  const out = copyBoard(board);
  for (let y = cy - 1; y <= cy + 1; y++)
    for (let x = cx - 1; x <= cx + 1; x++)
      if (out[y] && x >= 0 && x < out[y].length) out[y][x] = 0;
  return out;
}

// Vacía la columna col y elimina la fila row (lo de arriba baja una fila).
function clearRowAndColumn(board, row, col) {
  const cols = board[0].length;
  const out = copyBoard(board).map(r => r.map((v, c) => (c === col ? 0 : v)));
  out.splice(row, 1);
  out.unshift(new Array(cols).fill(0));
  return { board: out, lines: 1 };
}

function removeColor(board, type) {
  return board.map(row => row.map(v => (v === type ? 0 : v)));
}

// Cada columna cae hasta el fondo, sin huecos, conservando el orden vertical.
function compactColumns(board) {
  const rows = board.length, cols = board[0].length;
  const out = Array.from({ length: rows }, () => new Array(cols).fill(0));
  for (let c = 0; c < cols; c++) {
    let dest = rows - 1;
    for (let r = rows - 1; r >= 0; r--) {
      if (board[r][c]) out[dest--][c] = board[r][c];
    }
  }
  return out;
}

// Elimina las filas completas y añade vacías arriba.
function removeFullRows(board) {
  const cols = board[0].length;
  const kept = board.filter(row => row.some(v => v === 0)).map(row => [...row]);
  const cleared = board.length - kept.length;
  const empty = Array.from({ length: cleared }, () => new Array(cols).fill(0));
  return { board: [...empty, ...kept], cleared };
}

// Tipo estándar (1–7) al azar distinto del actual.
function pickSwapType(currentType, rng = Math.random) {
  const options = [1, 2, 3, 4, 5, 6, 7].filter(t => t !== currentType);
  return options[Math.floor(rng() * options.length)];
}

// Líneas limpiadas por habilidades: puntuación plana, sin combo, B2B ni Perfect Clear.
function abilityPoints(lines, level) {
  return 100 * lines * level;
}

// T-spin: pieza T, último movimiento fue una rotación y al menos 3 de las 4
// esquinas de su caja 3×3 están ocupadas (paredes y suelo cuentan como ocupadas).
function isTSpin(type, lastMoveWasRotation, occupiedCorners) {
  return type === 3 && lastMoveWasRotation && occupiedCorners >= 3;
}

// Puntuación de un bloqueo de pieza. Es la única regla de puntos por líneas.
//   combo: encadenados previos (-1 = sin cadena). Con N limpiezas seguidas el
//          multiplicador es xN (la 1ª x1, la 2ª x2, ...).
//   b2b:   la última limpieza fue "difícil" (Tetris o T-spin con líneas).
// Devuelve { points, combo, b2b, labels } con el nuevo estado y los textos a mostrar.
// level es el nivel vigente al bloquear (antes de subir por estas líneas).
function scoreClear({ cleared, tspin, perfect, combo, b2b, level }) {
  if (cleared === 0) {
    // Sin líneas: la cadena se rompe; B2B se conserva.
    return {
      points: tspin ? TSPIN_SCORES[0] * level : 0,
      combo: -1,
      b2b,
      labels: tspin ? ['T-SPIN'] : [],
    };
  }

  const difficult = tspin || cleared === 4;
  const base = tspin ? TSPIN_SCORES[Math.min(cleared, 3)] : LINE_SCORES[cleared];
  const b2bApplies = difficult && b2b;
  const newCombo = combo + 1;

  let points = Math.round(base * level * (b2bApplies ? B2B_MULTIPLIER : 1) * (newCombo + 1));
  if (perfect) points += PERFECT_CLEAR_BONUS * level;

  const labels = [];
  if (tspin) labels.push('T-SPIN' + TSPIN_NAMES[Math.min(cleared, 3)]);
  else if (cleared === 4) labels.push('TETRIS');
  if (b2bApplies) labels.push('B2B');
  if (newCombo >= 1) labels.push(`COMBO x${newCombo + 1}`);
  if (perfect) labels.push('PERFECT CLEAR');

  return { points, combo: newCombo, b2b: difficult, labels };
}

if (typeof module !== 'undefined') {
  module.exports = {
    makeBag, makePieceSource, PENTOMINO_TYPES, SINGLE_TYPE, HOLLOW_TYPE, GARBAGE_TYPE,
    CHALLENGES, challengeStatus, makeGarbageRow, makePrefillRows, formatTime, isTSpin, scoreClear,
    ABILITIES, ENERGY_MAX, addEnergy, pickAbilities, explode, clearRowAndColumn, removeColor,
    compactColumns, removeFullRows, pickSwapType, abilityPoints,
  };
}
