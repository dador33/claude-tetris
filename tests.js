'use strict';

// Pruebas de rules.js. Se ejecutan en el navegador (tests.html) o con `node tests.js`.

const R = typeof module !== 'undefined'
  ? require('./rules.js')
  : {
    makeBag, makePieceSource, PENTOMINO_TYPES, SINGLE_TYPE, HOLLOW_TYPE, GARBAGE_TYPE,
    CHALLENGES, challengeStatus, makeGarbageRow, makePrefillRows, formatTime, isTSpin, scoreClear,
    ABILITIES, ENERGY_MAX, addEnergy, pickAbilities, explode, clearRowAndColumn, removeColor,
    compactColumns, removeFullRows, pickSwapType, abilityPoints,
  };

const results = [];

function test(name, fn) {
  try { fn(); results.push({ name, ok: true }); }
  catch (e) { results.push({ name, ok: false, msg: e.message }); }
}

function eq(actual, expected) {
  const a = JSON.stringify(actual), b = JSON.stringify(expected);
  if (a !== b) throw new Error(`esperado ${b}, obtenido ${a}`);
}

// Entrada base: una línea, sin nada especial, nivel 1.
function clear(overrides) {
  return R.scoreClear({ cleared: 1, tspin: false, perfect: false, combo: -1, b2b: false, level: 1, ...overrides });
}

// ---- Bolsa de 7 ----
test('bag: cada 7 piezas salen los 7 tipos sin repetir', () => {
  const bag = R.makeBag();
  for (let round = 0; round < 5; round++) {
    const got = Array.from({ length: 7 }, () => bag.next()).sort();
    eq(got, [1, 2, 3, 4, 5, 6, 7]);
  }
});

test('bag: con rng fijo es determinista', () => {
  const a = R.makeBag(() => 0.3), b = R.makeBag(() => 0.3);
  eq(Array.from({ length: 14 }, () => a.next()), Array.from({ length: 14 }, () => b.next()));
});

// ---- Fuente de piezas (pentominós y premio 1×1) ----
// Generador pseudoaleatorio con semilla, para pruebas reproducibles.
function seeded(seed) {
  return () => {
    seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

test('fuente: las piezas estándar siguen saliendo en bolsas de 7', () => {
  const src = R.makePieceSource(seeded(42));
  const standard = Array.from({ length: 700 }, () => src.next()).filter(t => t <= 7);
  for (let i = 0; i + 7 <= standard.length; i += 7) {
    eq(standard.slice(i, i + 7).sort(), [1, 2, 3, 4, 5, 6, 7]);
  }
});

test('fuente: salen pentominós, pero nunca cerca unos de otros', () => {
  const src = R.makePieceSource(seeded(7));
  const seq = Array.from({ length: 2000 }, () => src.next());
  const at = seq.flatMap((t, i) => (R.PENTOMINO_TYPES.includes(t) ? [i] : []));
  if (at.length < 50) throw new Error(`demasiado pocos pentominós: ${at.length}`);
  for (let i = 1; i < at.length; i++) {
    if (at[i] - at[i - 1] <= 5) throw new Error(`pentominós a ${at[i] - at[i - 1]} piezas de distancia`);
  }
  if (seq.includes(R.SINGLE_TYPE)) throw new Error('salió un 1×1 sin premio');
});

test('fuente: con rng=0 el primer pentominó llega tras 5 piezas estándar', () => {
  const src = R.makePieceSource(() => 0);
  const seq = Array.from({ length: 12 }, () => src.next());
  eq(seq.map(t => R.PENTOMINO_TYPES.includes(t)),
    [false, false, false, false, false, true, false, false, false, false, false, true]);
});

test('fuente: reward() da exactamente un 1×1 en la siguiente pieza', () => {
  const src = R.makePieceSource(seeded(1));
  src.next();
  src.reward();
  eq(src.next(), R.SINGLE_TYPE);
  if (Array.from({ length: 50 }, () => src.next()).includes(R.SINGLE_TYPE)) throw new Error('segundo 1×1 inesperado');
});

test('fuente: dos premios seguidos dan dos 1×1', () => {
  const src = R.makePieceSource(seeded(3));
  src.reward();
  src.reward();
  eq([src.next(), src.next()], [R.SINGLE_TYPE, R.SINGLE_TYPE]);
});

// ---- Retos ----
const byId = id => R.CHALLENGES.find(c => c.id === id);

test('retos: ids únicos y cada uno tiene objetivo y condición de fin', () => {
  eq(new Set(R.CHALLENGES.map(c => c.id)).size, R.CHALLENGES.length);
  for (const c of R.CHALLENGES) {
    if (!c.name || !c.goal) throw new Error(`${c.id}: falta nombre u objetivo`);
    if (!c.goalLines && !c.surviveMs) throw new Error(`${c.id}: no se puede ganar`);
  }
});

test('challengeStatus: gana por líneas antes de que acabe el tiempo', () => {
  eq(R.challengeStatus(byId('sprint'), { lines: 40, elapsedMs: 119000 }), 'won');
  eq(R.challengeStatus(byId('sprint'), { lines: 39, elapsedMs: 119000 }), 'playing');
});

test('challengeStatus: pierde por tiempo, pero llegar justo con las líneas gana', () => {
  eq(R.challengeStatus(byId('sprint'), { lines: 12, elapsedMs: 120000 }), 'lost');
  eq(R.challengeStatus(byId('sprint'), { lines: 40, elapsedMs: 120000 }), 'won');
});

test('challengeStatus: supervivencia gana al aguantar el tiempo', () => {
  eq(R.challengeStatus(byId('garbage'), { lines: 0, elapsedMs: 89999 }), 'playing');
  eq(R.challengeStatus(byId('garbage'), { lines: 0, elapsedMs: 90000 }), 'won');
});

test('challengeStatus: reto sin tiempo nunca pierde por reloj', () => {
  eq(R.challengeStatus(byId('prefill'), { lines: 5, elapsedMs: 9999999 }), 'playing');
});

test('makeGarbageRow: exactamente un hueco, el resto basura', () => {
  const row = R.makeGarbageRow(10, seeded(5));
  eq(row.length, 10);
  eq(row.filter(v => v === 0).length, 1);
  eq(row.filter(v => v === R.GARBAGE_TYPE).length, 9);
});

test('makeGarbageRow: el hueco cae en columnas distintas', () => {
  const rng = seeded(9);
  const holes = new Set(Array.from({ length: 60 }, () => R.makeGarbageRow(10, rng).indexOf(0)));
  if (holes.size < 6) throw new Error(`hueco poco variable: ${holes.size} columnas`);
});

test('makePrefillRows: nunca una fila completa y solo bloques fijos', () => {
  const rows = R.makePrefillRows(500, 10, seeded(11));
  eq(rows.length, 500);
  for (const row of rows) {
    eq(row.length, 10);
    if (row.every(v => v !== 0)) throw new Error('fila completa');
    if (row.some(v => v !== 0 && v !== R.GARBAGE_TYPE)) throw new Error('bloque no fijo');
  }
});

test('makePrefillRows: caso límite rng=0 (todo lleno) deja un hueco', () => {
  const rows = R.makePrefillRows(1, 10, () => 0);
  eq(rows[0].filter(v => v === 0).length >= 1, true);
});

test('formatTime: m:ss, redondea hacia arriba y no baja de 0', () => {
  eq(R.formatTime(120000), '2:00');
  eq(R.formatTime(59001), '1:00');
  eq(R.formatTime(9500), '0:10');
  eq(R.formatTime(0), '0:00');
  eq(R.formatTime(-500), '0:00');
});

test('fuente: reto sin especiales solo da piezas estándar', () => {
  const src = R.makePieceSource(seeded(2), { specials: [] });
  if (Array.from({ length: 500 }, () => src.next()).some(t => t > 7)) throw new Error('salió una pieza especial');
});

test('fuente: reto de anillos saca anillos con su propia frecuencia', () => {
  const src = R.makePieceSource(seeded(4), { specials: [R.HOLLOW_TYPE], chance: 0.25, cooldown: 3 });
  const seq = Array.from({ length: 400 }, () => src.next());
  const at = seq.flatMap((t, i) => (t === R.HOLLOW_TYPE ? [i] : []));
  if (at.length < 40) throw new Error(`pocos anillos: ${at.length}`);
  for (let i = 1; i < at.length; i++) if (at[i] - at[i - 1] <= 3) throw new Error('anillos demasiado seguidos');
  if (seq.some(t => R.PENTOMINO_TYPES.includes(t))) throw new Error('salió un pentominó en el reto de anillos');
});

// ---- Habilidades ----
// Tablero pequeño desde texto: '.' vacío, dígito = tipo.
const B = (...rows) => rows.map(r => [...r].map(ch => (ch === '.' ? 0 : Number(ch))));
const S = board => board.map(r => r.map(v => (v ? String(v) : '.')).join(''));
const count = board => board.flat().filter(v => v).length;

test('energía: 12,5 por línea con tope en 100', () => {
  eq(R.addEnergy(0, 1), 12.5);
  eq(R.addEnergy(0, 8), 100);
  eq(R.addEnergy(90, 4), 100);
  eq(R.addEnergy(50, 0), 50);
});

test('pickAbilities: 3 distintas del pool y deterministas con semilla', () => {
  const ids = R.ABILITIES.map(a => a.id);
  for (let i = 0; i < 50; i++) {
    const got = R.pickAbilities(R.ABILITIES, 3, seeded(i));
    eq(new Set(got).size, 3);
    if (!got.every(id => ids.includes(id))) throw new Error('id fuera del pool');
  }
  eq(R.pickAbilities(R.ABILITIES, 3, seeded(8)), R.pickAbilities(R.ABILITIES, 3, seeded(8)));
});

test('pickAbilities: con suficientes tiradas salen las 5', () => {
  const rng = seeded(21);
  const seen = new Set();
  for (let i = 0; i < 40; i++) R.pickAbilities(R.ABILITIES, 3, rng).forEach(id => seen.add(id));
  eq(seen.size, R.ABILITIES.length);
});

test('explode: vacía el 3×3 centrado sin tocar el resto', () => {
  const board = B('11111', '11111', '11111', '11111');
  eq(S(R.explode(board, 2, 1)), ['1...1', '1...1', '1...1', '11111']);
  eq(S(board), ['11111', '11111', '11111', '11111']); // no muta
});

test('explode: en una esquina no se sale del tablero', () => {
  eq(S(R.explode(B('111', '111', '111'), 0, 2)), ['111', '..1', '..1']);
});

test('clearRowAndColumn: vacía la columna, quita la fila y baja lo de arriba', () => {
  const r = R.clearRowAndColumn(B('12.', '345', '678'), 2, 1);
  eq(S(r.board), ['...', '1..', '3.5']);
  eq(r.lines, 1);
});

test('removeColor: quita solo los bloques de ese tipo', () => {
  eq(S(R.removeColor(B('121', '313'), 1)), ['.2.', '3.3']);
});

test('compactColumns: sin huecos, mismo número de bloques y mismo orden vertical', () => {
  const board = B('1.2', '...', '3..', '.4.', '5..');
  const out = R.compactColumns(board);
  eq(S(out), ['...', '...', '1..', '3..', '542']);
  eq(count(out), count(board));
});

test('removeFullRows: filas completas no contiguas', () => {
  const r = R.removeFullRows(B('1.1', '111', '.1.', '111'));
  eq(r.cleared, 2);
  eq(S(r.board), ['...', '...', '1.1', '.1.']);
});

test('removeFullRows: sin filas completas devuelve una copia igual', () => {
  const board = B('1.', '.1');
  const r = R.removeFullRows(board);
  eq([r.cleared, S(r.board)], [0, ['1.', '.1']]);
});

test('pickSwapType: nunca el mismo tipo y siempre estándar', () => {
  const rng = seeded(13);
  for (let t = 1; t <= 12; t++)
    for (let i = 0; i < 50; i++) {
      const s = R.pickSwapType(t, rng);
      if (s === t || s < 1 || s > 7) throw new Error(`tipo ${t} → ${s}`);
    }
});

test('abilityPoints: 100 × líneas × nivel', () => {
  eq(R.abilityPoints(3, 2), 600);
  eq(R.abilityPoints(0, 5), 0);
});

// ---- Puntuación base ----
test('una línea, nivel 1: 100 y empieza la cadena', () => {
  eq(clear({}), { points: 100, combo: 0, b2b: false, labels: [] });
});

test('el nivel multiplica: Tetris nivel 2 = 1600', () => {
  eq(clear({ cleared: 4, level: 2 }).points, 1600);
});

// ---- Combo ----
test('combo: la 3ª limpieza seguida da x3', () => {
  const r = clear({ combo: 1 });
  eq(r.points, 300);
  eq(r.combo, 2);
  eq(r.labels, ['COMBO x3']);
});

test('sin líneas la cadena se rompe y no suma puntos', () => {
  eq(clear({ cleared: 0, combo: 3 }), { points: 0, combo: -1, b2b: false, labels: [] });
});

// ---- Back-to-back ----
test('Tetris sin B2B previo: 800 y activa B2B', () => {
  const r = clear({ cleared: 4 });
  eq(r.points, 800);
  eq(r.b2b, true);
  eq(r.labels, ['TETRIS']);
});

test('Tetris con B2B previo: x1.5 = 1200', () => {
  const r = clear({ cleared: 4, b2b: true });
  eq(r.points, 1200);
  eq(r.labels, ['TETRIS', 'B2B']);
});

test('una limpieza normal rompe el B2B y no recibe bonus', () => {
  const r = clear({ cleared: 1, b2b: true });
  eq(r.points, 100);
  eq(r.b2b, false);
});

test('un bloqueo sin líneas conserva el B2B', () => {
  eq(clear({ cleared: 0, b2b: true }).b2b, true);
});

// ---- T-spin ----
test('T-spin double: 1200, activa B2B y se etiqueta', () => {
  const r = clear({ cleared: 2, tspin: true });
  eq(r.points, 1200);
  eq(r.b2b, true);
  eq(r.labels, ['T-SPIN DOUBLE']);
});

test('T-spin sin líneas: 400 x nivel, rompe cadena, conserva B2B', () => {
  eq(clear({ cleared: 0, tspin: true, level: 2, combo: 2, b2b: true }),
    { points: 800, combo: -1, b2b: true, labels: ['T-SPIN'] });
});

test('isTSpin: exige T, rotación previa y 3+ esquinas', () => {
  eq(R.isTSpin(3, true, 3), true);
  eq(R.isTSpin(3, true, 4), true);
  eq(R.isTSpin(3, true, 2), false);
  eq(R.isTSpin(3, false, 3), false);
  eq(R.isTSpin(1, true, 3), false);
});

// ---- Perfect Clear ----
test('Perfect Clear suma 2000 x nivel sin multiplicar por combo', () => {
  const r = clear({ cleared: 4, perfect: true, combo: 1 });
  eq(r.points, 800 * 3 + 2000);
  eq(r.labels, ['TETRIS', 'COMBO x3', 'PERFECT CLEAR']);
});

// ---- Informe ----
const failed = results.filter(r => !r.ok);
if (typeof document !== 'undefined') {
  document.body.style.cssText = 'font-family:monospace;padding:16px;background:#111;color:#eee';
  document.body.innerHTML =
    `<h1>${failed.length ? '✗' : '✓'} ${results.length - failed.length}/${results.length} pruebas</h1>` +
    results.map(r => `<div style="color:${r.ok ? '#81c784' : '#e57373'}">${r.ok ? '✓' : '✗'} ${r.name}${r.ok ? '' : ' — ' + r.msg}</div>`).join('');
} else {
  results.forEach(r => console.log(`${r.ok ? 'OK  ' : 'FAIL'} ${r.name}${r.ok ? '' : ' — ' + r.msg}`));
  console.log(`\n${results.length - failed.length}/${results.length} pruebas OK`);
  process.exitCode = failed.length ? 1 : 0;
}
