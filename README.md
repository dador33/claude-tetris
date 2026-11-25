# Tetris

Implementación del clásico **Tetris** en JavaScript vanilla, usando HTML5 Canvas y CSS. Sin dependencias externas, sin frameworks, sin proceso de build: solo abrir y jugar.

![Tech](https://img.shields.io/badge/HTML5-Canvas-orange)
![Tech](https://img.shields.io/badge/CSS3-blueviolet)
![Tech](https://img.shields.io/badge/JavaScript-Vanilla-yellow)

---

## Tabla de contenidos

- [Tetris](#tetris)
  - [Tabla de contenidos](#tabla-de-contenidos)
  - [Qué hace el proyecto](#qué-hace-el-proyecto)
  - [Cómo ejecutar el juego](#cómo-ejecutar-el-juego)
    - [Opción 1: abrir el archivo directamente](#opción-1-abrir-el-archivo-directamente)
    - [Opción 2: servidor local (recomendado)](#opción-2-servidor-local-recomendado)
  - [Controles](#controles)
  - [Retos](#retos)
  - [Habilidades](#habilidades)
  - [Cómo funciona](#cómo-funciona)
    - [1. `index.html`](#1-indexhtml)
    - [2. `style.css`](#2-stylecss)
    - [3. `game.js`](#3-gamejs)
    - [Flujo del juego](#flujo-del-juego)
  - [Tecnologías](#tecnologías)
  - [Estructura del proyecto](#estructura-del-proyecto)
  - [Personalización](#personalización)
  - [Licencia](#licencia)

---

## Qué hace el proyecto

Es una versión jugable del Tetris clásico con todas las mecánicas que esperarías:

- Tablero de **10 × 20** celdas.
- Las **7 piezas estándar** (I, O, T, S, Z, J, L) con colores diferenciados.
- **Rotación** con _wall kicks_ básicos (pequeños desplazamientos para que la pieza pueda rotar pegada a la pared).
- **Soft drop** (bajada acelerada) y **hard drop** (caída instantánea).
- **Pieza fantasma** (_ghost piece_): muestra dónde aterrizará la pieza actual.
- **Vista previa** de la siguiente pieza.
- **Hold**: reserva la pieza actual (o la intercambia con la reservada) una vez por pieza; el slot se atenúa mientras está bloqueado.
- **Generador "bolsa de 7"**: cada 7 piezas estándar salen los 7 tipos una vez, sin sequías largas.
- **Pentominós ocasionales** (5 bloques): **+**, **U** e **Y**. Cada pieza tiene un 10 % de probabilidad de ser uno, con al menos 5 piezas estándar entre dos pentominós.
- **Premio 1×1**: un Tetris (4 líneas) regala una pieza de un solo bloque, que sale en NEXT.
- **Sistema de puntuación** clásico de Tetris (100 / 300 / 500 / 800 multiplicado por nivel) con:
  - **Combo**: limpiar líneas con piezas consecutivas multiplica la puntuación (x2, x3, x4…). Se rompe al bloquear una pieza sin limpiar.
  - **Back-to-back (B2B)**: un Tetris o T-spin con líneas justo después de otro puntúa x1.5.
  - **T-spin**: la T girada en su último movimiento y con 3 de 4 esquinas ocupadas (400 / 800 / 1200 / 1600 × nivel).
  - **Perfect Clear**: dejar el tablero vacío suma 2000 × nivel.
  - **Efectos**: textos flotantes sobre el tablero, panel COMBO/B2B y sonidos sintetizados (WebAudio, sin archivos).
- **Habilidades** (modo Clásico): una barra de energía que se llena al limpiar líneas; llena, `E` ofrece 3 habilidades al azar (ver [Habilidades](#habilidades)).
- **Modo desafío**: selector de modo sobre el tablero. Cada reto tiene su objetivo, su temporizador y sus reglas (ver [Retos](#retos)).
- **Tema claro/oscuro** con un interruptor sobre el tablero. La preferencia se guarda en `localStorage` y, por defecto, sigue el tema del sistema.
- **Niveles** que aumentan cada 10 líneas y aceleran la caída.
- **Pausa** y **Game Over** con opción de reinicio.

---

## Cómo ejecutar el juego

No hay nada que instalar ni compilar. Tienes dos opciones:

### Opción 1: abrir el archivo directamente

```bash
open index.html        # macOS
xdg-open index.html    # Linux
start index.html       # Windows
```

### Opción 2: servidor local (recomendado)

Cualquier servidor estático funciona. Algunos ejemplos:

```bash
# Con Python 3
python3 -m http.server 8000

# Con Node.js (npx)
npx serve .

# Con PHP
php -S localhost:8000
```

Después abre `http://localhost:8000` en el navegador.

---

## Controles

| Tecla     | Acción                            |
| --------- | --------------------------------- |
| `←` / `→` | Mover la pieza horizontalmente    |
| `↑` o `X` | Rotar la pieza en sentido horario |
| `↓`       | Soft drop (bajar más rápido)      |
| `Espacio` | Hard drop (caída instantánea)     |
| `C` / `Shift` | Reservar pieza (hold), una vez por pieza |
| `E`       | Abrir el menú de habilidades (barra llena, solo Clásico) |
| `1` `2` `3` / `Esc` | Elegir habilidad / cancelar el menú |
| `M`       | Activar / silenciar el sonido     |
| `P`       | Pausar / reanudar                 |

---

## Retos

El selector **Modo** (sobre el tablero) cambia entre el modo **Clásico** y los retos. Al elegir uno la partida se reinicia y aparece el panel **OBJETIVO** con la meta y el temporizador. Los retos usan solo piezas estándar (salvo *Anillos*) y el premio 1×1 tras un Tetris sigue activo.

| Reto | Objetivo | Regla especial |
| ---- | -------- | -------------- |
| **Sprint: 40 líneas** | Limpiar 40 líneas en 2:00 | Cuenta atrás; si llega a 0 pierdes |
| **Supervivencia** | Aguantar 90 s | Cada 10 s sube una fila de basura con un hueco; la pieza activa sube con el tablero |
| **Obras** | Limpiar 20 líneas | Empieza con 8 filas de bloques grises fijos |
| **Fantasma** | Limpiar 10 líneas | La pila solo se ve 0,7 s tras fijar una pieza; sin ghost |
| **Rotación inversa** | Limpiar 30 líneas | Empieza en nivel 5; desde el nivel 6 `↑`/`X` giran en sentido antihorario |
| **Anillos** | Limpiar 15 líneas | Salen anillos 3×3 huecos: el hueco central no se puede rellenar hasta limpiar la fila de arriba |

Los retos son datos (`CHALLENGES` en `rules.js`): para añadir uno basta una entrada nueva con sus campos (`goalLines`, `timeLimitMs`, `surviveMs`, `garbageEveryMs`, `prefillRows`, `invisible`, `startLevel`, `reverseFromLevel`, `pieces`); aparece solo en el selector.

---

## Habilidades

Solo en el modo **Clásico** (en los retos la barra se oculta y `E` no hace nada).

- **Energía:** cada línea limpiada de forma normal suma 12,5 % (8 líneas llenan la barra). Las líneas que limpian las propias habilidades no cargan energía.
- **Uso:** con la barra llena (`LISTO · E`) pulsa `E`. El juego se pausa y se ofrecen **3 habilidades al azar**; elige con `1`, `2`, `3` o con el ratón. `Esc` cancela y conserva la energía. Elegir vacía la barra.

| Habilidad | Efecto |
| --------- | ------ |
| **Bomba 3×3** | Queda armada: al fijarse la próxima pieza borra un área 3×3 centrada en ella |
| **Rayo** | Queda armada: al fijarse la próxima pieza borra su columna y su fila más baja |
| **Borrar color** | Quita del tablero todos los bloques del color de la pieza actual |
| **Gravedad** | Compacta cada columna hacia abajo y limpia las filas que queden completas |
| **Cambiar pieza** | Cambia la pieza actual por otra estándar al azar (si no cabe, se devuelve la energía) |

Una habilidad armada se ve como un contorno pulsante sobre la pieza (rojo para la bomba, amarillo para el rayo) y sigue armada aunque uses HOLD. Las líneas que limpian las habilidades puntúan 100 × líneas × nivel y cuentan para LINES y nivel, pero no para combo, B2B ni Perfect Clear.

---

## Cómo funciona

El juego se compone de tres archivos que cooperan:

### 1. `index.html`

Define la estructura visual:

- Un `<canvas id="board">` de **240 × 480** píxeles donde se renderiza el tablero, con un panel a cada lado (HOLD y controles a la izquierda; NEXT y marcadores a la derecha).
- Un panel lateral con `SCORE`, `LINES`, `LEVEL`, vista de la siguiente pieza y la lista de controles.
- Un overlay para los estados **PAUSA** y **GAME OVER**.

### 2. `style.css`

Aporta el aspecto visual con estética _dark / retro arcade_: fondo oscuro, tipografía monoespaciada para los marcadores y _backdrop blur_ en los overlays.

### 3. `game.js`

Contiene toda la lógica del juego. A grandes rasgos:

- **Modelo del tablero**: una matriz `ROWS × COLS` donde cada celda guarda `0` (vacía) o un índice de color (1–13) que identifica la pieza (1–7 estándar, 8–10 pentominós, 11 la pieza 1×1, 12 el anillo hueco, 13 bloque fijo/basura, que no es una pieza).
- **Piezas**: definidas como matrices cuadradas. Para rotar se calcula la transposición + reverso de filas (`rotateCW`).
- **Detección de colisiones** (`collide`): comprueba que ninguna celda de la pieza salga del tablero ni se solape con bloques ya fijados.
- **Wall kicks** (`tryRotate`): si la rotación choca, intenta desplazar la pieza ±1 y ±2 columnas antes de descartar el giro.
- **Game loop** (`loop`): basado en `requestAnimationFrame`, acumula el tiempo transcurrido y baja la pieza una fila cuando se supera `dropInterval`.
- **Limpieza de líneas** (`clearLines`): recorre el tablero de abajo hacia arriba; cada fila completa se elimina y se inserta una vacía en la cima.
- **Puntuación**: usa la tabla clásica `[0, 100, 300, 500, 800]` multiplicada por el nivel actual; el hard drop suma 2 puntos por celda recorrida y el soft drop 1 punto por fila.
- **Nivel y velocidad**: el nivel sube cada 10 líneas; la velocidad de caída se calcula como `max(100, 1000 − (level − 1) × 90)` milisegundos.
- **Ghost piece** (`ghostY`): proyecta la posición final de la pieza actual hacia abajo y la dibuja con `globalAlpha = 0.2`.

### Flujo del juego

```
init()
  ├─ createBoard()                  → matriz vacía
  ├─ next = randomPiece()
  ├─ spawn()                        → mueve next a current y genera nueva next
  └─ requestAnimationFrame(loop)
        ↓
   loop(timestamp)
     ├─ acumula dt
     ├─ si dt ≥ dropInterval → baja la pieza o llama a lockPiece()
     ├─ draw()  (grid + tablero + ghost + pieza actual)
     └─ requestAnimationFrame(loop)

   keydown → mover / rotar / soft-drop / hard-drop / pausa
```

Cuando una pieza recién generada ya colisiona al aparecer (`spawn`), se dispara `endGame()` y se muestra el overlay de **Game Over**.

---

## Tecnologías

- **HTML5** — marcado y dos elementos `<canvas>` (tablero y vista previa).
- **CSS3** — _flexbox_, variables de color, `backdrop-filter` y `box-shadow`.
- **JavaScript (ES6+) vanilla** — `const`/`let`, _arrow functions_, _spread operator_, `Array.from`, _template literals_…
- **Canvas 2D API** — para todo el renderizado del juego.
- **`requestAnimationFrame`** — para el bucle de juego sincronizado con el navegador.

**Sin dependencias.** No hay `package.json`, ni bundler, ni transpilador.

---

## Estructura del proyecto

```
03-tetris/
├── index.html      # Estructura del DOM y canvas
├── style.css       # Estilos del juego (dark theme)
├── rules.js        # Reglas puras: bolsa de 7, T-spin y puntuación (sin DOM)
├── game.js         # Estado, bucle, dibujo, entrada y sonido
├── tests.js        # Pruebas de rules.js (navegador o `node tests.js`)
├── tests.html      # Ejecuta tests.js en el navegador
└── README.md
```

---

## Personalización

Algunos parámetros fáciles de tunear en `game.js`:

| Constante      | Significado                              | Por defecto           |
| -------------- | ---------------------------------------- | --------------------- |
| `COLS`         | Columnas del tablero                     | `10`                  |
| `ROWS`         | Filas del tablero                        | `20`                  |
| `BLOCK`        | Tamaño en píxeles de cada celda          | `24`                  |
| `COLORS`       | Paleta de colores por tipo de pieza      | 11 colores            |
| `PENTOMINO_CHANCE` / `PENTOMINO_COOLDOWN` (en `rules.js`) | Frecuencia de pentominós | `0.1` / `5` |
| `LINE_SCORES` (en `rules.js`) | Puntos por 1, 2, 3 o 4 líneas eliminadas | `[0,100,300,500,800]` |
| `dropInterval` | Velocidad inicial de caída en ms         | `1000`                |

> Si cambias `COLS`, `ROWS` o `BLOCK`, recuerda ajustar también `width` y `height` del `<canvas id="board">` en `index.html` para que coincida (`COLS × BLOCK` × `ROWS × BLOCK`).

---

## Licencia

Proyecto de uso libre con fines educativos y de práctica.
