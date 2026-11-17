// tipos de piezas
const PEON = 0, CABALLO = 1, ALFIL = 2, TORRE = 3, DAMA = 4, REY = 5;
const NOMBRE_PIEZA = ['peón', 'caballo', 'alfil', 'torre', 'dama', 'rey']
const LETRA_PIEZA  = ['p', 'n', 'b', 'r', 'q', 'k']

// Valores de las piezas en medio juego (MG) y en el final (EG)
// Orden: Peon, Caballo, Alfil, Torre, Dama, Rey
const VALOR_MG = [82, 337, 365, 477, 1025, 0]
const VALOR_EG = [94, 281, 297, 512,  936, 0]
// Peso para saber si es el final
const PESO_FASE = [0, 1, 1, 2, 4, 0]
const FASE_TOTAL = 24;

const TABLA_MG = [
  // PEÓN: avanzar y controlar el centro es bueno
  [  0,   0,   0,   0,   0,   0,   0,   0,
    98, 134,  61,  95,  68, 126,  34, -11,
    -6,   7,  26,  31,  65,  56,  25, -20,
   -14,  13,   6,  21,  23,  12,  17, -23,
   -27,  -2,  -5,  12,  17,   6,  10, -25,
   -26,  -4,  -4, -10,   3,   3,  33, -12,
   -35,  -1, -20, -23, -15,  24,  38, -22,
     0,   0,   0,   0,   0,   0,   0,   0],
  // CABALLO: "caballo en la orilla, desgracia en la familia"
  [-167, -89, -34, -49,  61, -97, -15,-107,
   -73, -41,  72,  36,  23,  62,   7, -17,
   -47,  60,  37,  65,  84, 129,  73,  44,
    -9,  17,  19,  53,  37,  69,  18,  22,
   -13,   4,  16,  13,  28,  19,  21,  -8,
   -23,  -9,  12,  10,  19,  17,  25, -16,
   -29, -53, -12,  -3,  -1,  18, -14, -19,
  -105, -21, -58, -33, -17, -28, -19, -23],
  // ALFIL: diagonales largas
  [-29,   4, -82, -37, -25, -42,   7,  -8,
   -26,  16, -18, -13,  30,  59,  18, -47,
   -16,  37,  43,  40,  35,  50,  37,  -2,
    -4,   5,  19,  50,  37,  37,   7,  -2,
    -6,  13,  13,  26,  34,  12,  10,   4,
     0,  15,  15,  15,  14,  27,  18,  10,
     4,  15,  16,   0,   7,  21,  33,   1,
   -33,  -3, -14, -21, -13, -12, -39, -21],
  // TORRE: la séptima fila es muy fuerte
  [ 32,  42,  32,  51,  63,   9,  31,  43,
    27,  32,  58,  62,  80,  67,  26,  44,
    -5,  19,  26,  36,  17,  45,  61,  16,
   -24, -11,   7,  26,  24,  35,  -8, -20,
   -36, -26, -12,  -1,   9,  -7,   6, -23,
   -45, -25, -16, -17,   3,   0,  -5, -33,
   -44, -16, -20,  -9,  -1,  11,  -6, -71,
   -19, -13,   1,  17,  16,   7, -37, -26],
  // DAMA: no conviene sacarla demasiado pronto
  [-28,   0,  29,  12,  59,  44,  43,  45,
   -24, -39,  -5,   1, -16,  57,  28,  54,
   -13, -17,   7,   8,  29,  56,  47,  57,
   -27, -27, -16, -16,  -1,  17,  -2,   1,
    -9, -26,  -9, -10,  -2,  -4,   3,  -3,
   -14,   2, -11,  -2,  -5,   2,  14,   5,
   -35,  -8,  11,   2,   8,  15,  -3,   1,
    -1, -18,  -9,  10, -15, -25, -31, -50],
  // REY (medio juego): escondido y enrocado
  [-65,  23,  16, -15, -56, -34,   2,  13,
    29,  -1, -20,  -7,  -8,  -4, -38, -29,
    -9,  24,   2, -16, -20,   6,  22, -22,
   -17, -20, -12, -27, -30, -25, -14, -36,
   -49,  -1, -27, -39, -46, -44, -33, -51,
   -14, -14, -22, -46, -44, -30, -15, -27,
     1,   7,  -8, -64, -43, -16,   9,   8,
   -15,  36,  12, -54,   8, -28,  24,  14]
]


const TABLA_EG = [
  // PEÓN: en el final, mientras más cerca de coronar, mejor
  [  0,   0,   0,   0,   0,   0,   0,   0,
   178, 173, 158, 134, 147, 132, 165, 187,
    94, 100,  85,  67,  56,  53,  82,  84,
    32,  24,  13,   5,  -2,   4,  17,  17,
    13,   9,  -3,  -7,  -7,  -8,   3,  -1,
     4,   7,  -6,   1,   0,  -5,  -1,  -8,
    13,   8,   8,  10,  13,   0,   2,  -7,
     0,   0,   0,   0,   0,   0,   0,   0],
  // CABALLO
  [-58, -38, -13, -28, -31, -27, -63, -99,
   -25,  -8, -25,  -2,  -9, -25, -24, -52,
   -24, -20,  10,   9,  -1,  -9, -19, -41,
   -17,   3,  22,  22,  22,  11,   8, -18,
   -18,  -6,  16,  25,  16,  17,   4, -18,
   -23,  -3,  -1,  15,  10,  -3, -20, -22,
   -42, -20, -10,  -5,  -2, -20, -23, -44,
   -29, -51, -23, -15, -22, -18, -50, -64],
  // ALFIL
  [-14, -21, -11,  -8,  -7,  -9, -17, -24,
    -8,  -4,   7, -12,  -3, -13,  -4, -14,
     2,  -8,   0,  -1,  -2,   6,   0,   4,
    -3,   9,  12,   9,  14,  10,   3,   2,
    -6,   3,  13,  19,   7,  10,  -3,  -9,
   -12,  -3,   8,  10,  13,   3,  -7, -15,
   -14, -18,  -7,  -1,   4,  -9, -15, -27,
   -23,  -9, -23,  -5,  -9, -16,  -5, -17],
  // TORRE
  [ 13,  10,  18,  15,  12,  12,   8,   5,
    11,  13,  13,  11,  -3,   3,   8,   3,
     7,   7,   7,   5,   4,  -3,  -5,  -3,
     4,   3,  13,   1,   2,   1,  -1,   2,
     3,   5,   8,   4,  -5,  -6,  -8, -11,
    -4,   0,  -5,  -1,  -7, -12,  -8, -16,
    -6,  -6,   0,   2,  -9,  -9, -11,  -3,
    -9,   2,   3,  -1,  -5, -13,   4, -20],
  // DAMA
  [ -9,  22,  22,  27,  27,  19,  10,  20,
   -17,  20,  32,  41,  58,  25,  30,   0,
   -20,   6,   9,  49,  47,  35,  19,   9,
     3,  22,  24,  45,  57,  40,  57,  36,
   -18,  28,  19,  47,  31,  34,  39,  23,
   -16, -27,  15,   6,   9,  17,  10,   5,
   -22, -23, -30, -16, -16, -23, -36, -32,
   -33, -28, -22, -43,  -5, -32, -20, -41],
  // REY (final): ¡el rey debe ir al centro y pelear!
  [-74, -35, -18, -18, -11,  15,   4, -17,
   -12,  17,  14,  17,  17,  38,  23,  11,
    10,  17,  23,  15,  20,  45,  44,  13,
    -8,  22,  24,  27,  26,  33,  26,   3,
   -18,  -4,  21,  24,  27,  23,   9, -11,
   -19,  -3,  11,  21,  23,  16,   7,  -9,
   -27, -11,   4,  13,  14,   4,  -5, -17,
   -53, -34, -21, -11, -28, -14, -24, -43]
]


// Cada regla tiene un valor para medio juego [0] y otro para final [1]
const HEURISTICA = {
  PAR_DE_ALFILES:      [30, 50],   // tener los dos alfiles es una ventaja
  PEON_DOBLADO:        [-10, -20], // dos peones propios en la misma columna
  PEON_AISLADO:        [-10, -15], // peón sin peones propios en las columnas vecinas
  TORRE_COL_ABIERTA:   [25, 10],   // columna sin peones
  TORRE_COL_SEMIABIERTA: [12, 5],  // columna sin peones propios
  ESCUDO_REY:          [10, 0]     // por cada peón propio delante del rey (solo en medio juego)
}

// Bono por peón pasado según cuánto haya avanzado (0 = fila inicial del bando, 7 = coronación)
const PEON_PASADO_MG = [0, 5, 10, 15, 25, 40, 60, 0]
const PEON_PASADO_EG = [0, 10, 20, 35, 60, 100, 150, 0]


// ---------- Principios y tácticas (para el módulo de explicación) ----------
// Cada concepto tiene:
//   tipo:      su clase en la ontología (Resultado, Táctica, Estrategia, Experto, Evaluación, Plan)
//   prioridad: el número más alto se muestra primero
//   plantilla: texto técnico (panel del bot)
//   sencillo:  texto para alguien que no sabe ajedrez (modo tutor); null = no se muestra en el tutor
// Las llaves {x} se reemplazan con datos de la jugada.
const CONCEPTOS = {
  // --- Resultado ---
  MATE: {
    tipo: 'Resultado', prioridad: 100,
    plantilla: 'Fuerza jaque mate en {n} jugada(s).',
    sencillo: 'Lleva a jaque mate (ganar la partida) en {n} jugada(s), haga lo que haga el rival.'
  },
  RECIBE_MATE: {
    tipo: 'Resultado', prioridad: 99,
    plantilla: 'Todas las jugadas pierden; esta retrasa el mate lo más posible.',
    sencillo: 'La partida está perdida, pero esta es la jugada que más resiste.'
  },
  // --- Táctica ---
  PROMOCION: {
    tipo: 'Táctica', prioridad: 90,
    plantilla: 'Corona el peón y lo convierte en {pieza}.',
    sencillo: 'El peón llega al otro lado del tablero y se convierte en {pieza}: ganas una pieza muy poderosa.'
  },
  CAPTURA: {
    tipo: 'Táctica', prioridad: 80,
    plantilla: 'Captura {pieza} en {casilla}.',
    sencillo: 'Te comes {pieza} del rival en {casilla}. Con menos piezas, el rival tiene menos con qué atacar y defenderse.'
  },
  HORQUILLA: {
    tipo: 'Táctica', prioridad: 75,
    plantilla: 'Ataque doble: {pieza} amenaza a {objetivos} a la vez.',
    sencillo: '{pieza} ataca dos cosas al mismo tiempo: {objetivos}. El rival solo puede salvar una en su turno, así que probablemente ganas la otra.'
  },
  JAQUE: {
    tipo: 'Táctica', prioridad: 70,
    plantilla: 'Da jaque al rey.',
    sencillo: 'Atacas al rey rival (jaque). Está obligado a protegerlo en su siguiente turno, así que no puede hacer sus propios planes.'
  },
  AMENAZA: {
    tipo: 'Táctica', prioridad: 65,
    plantilla: 'Amenaza {objetivo}.',
    sencillo: 'Atacas {objetivo}. Si el rival no reacciona, podrás capturar esa pieza en tu siguiente turno.'
  },
  SALVA_PIEZA: {
    tipo: 'Táctica', prioridad: 60,
    plantilla: 'Pone a salvo {pieza}, que estaba en peligro.',
    sencillo: '{pieza} estaba en peligro: el rival podía capturar esa pieza gratis o a cambio de algo de menos valor. Con esta jugada queda a salvo.'
  },
  // --- Estrategia ---
  ENROQUE: {
    tipo: 'Estrategia', prioridad: 55,
    plantilla: 'Enroca: pone al rey a salvo y activa la torre.',
    sencillo: 'El enroque es una jugada especial: el rey se esconde en una esquina, detrás de sus peones, y la torre sale a jugar. Así es mucho más difícil que te den jaque mate.'
  },
  PEON_PASADO: {
    tipo: 'Estrategia', prioridad: 50,
    plantilla: 'Avanza un peón pasado rumbo a coronar.',
    sencillo: 'Ya no hay peones rivales que puedan detener a este peón. Si llega al otro lado del tablero se convierte en dama.'
  },
  DESARROLLO: {
    tipo: 'Estrategia', prioridad: 45,
    plantilla: 'Desarrolla {pieza} a una casilla activa.',
    sencillo: 'Al inicio de la partida conviene sacar las piezas de su lugar de origen para que participen: {pieza} sale a una casilla desde donde controla más del tablero.'
  },
  CENTRO: {
    tipo: 'Estrategia', prioridad: 40,
    plantilla: 'Ocupa o controla el centro.',
    sencillo: 'Las 4 casillas del centro son las más importantes: desde ahí las piezas alcanzan más casillas y pueden ir rápido a cualquier lado.'
  },
  COLUMNA: {
    tipo: 'Estrategia', prioridad: 35,
    plantilla: 'Coloca la torre en una columna abierta.',
    sencillo: 'La torre se pone en una columna sin peones propios, como una carretera libre: puede recorrerla de punta a punta y atacar.'
  },
  ACTIVIDAD: {
    tipo: 'Estrategia', prioridad: 20,
    plantilla: 'Mejora la posición de {pieza}.',
    sencillo: '{pieza} se mueve a una casilla donde es más útil: controla más espacio o está mejor protegida.'
  },
  // --- Conocimiento experto (libro de aperturas) ---
  APERTURA: {
    tipo: 'Experto', prioridad: 95,
    plantilla: 'Jugada de libro ({nombre}).',
    sencillo: 'Es una jugada de libro ({nombre}): una forma de empezar la partida que los expertos llevan muchos años estudiando y se sabe que funciona.'
  },
  // --- Evaluación (el "¿cómo llegó a esa conclusión?") ---
  MEJORA: {
    tipo: 'Evaluación', prioridad: 15,
    plantilla: 'Según su evaluación, la jugada mejora: {aspectos}.',
    sencillo: 'La computadora calculó varias jugadas hacia adelante y vio que así mejora {aspectos}.'
  },
  // --- Plan (lo que el motor prevé) ---
  PLAN: {
    tipo: 'Plan', prioridad: 10,
    plantilla: 'Línea esperada: {linea}.',
    sencillo: null // la notación de ajedrez no le dice nada a quien no juega
  },
  VALORACION: {
    tipo: 'Evaluación', prioridad: 5,
    plantilla: 'Valoración: {valor} (pensó {prof} jugadas adelante, {nodos} posiciones).',
    sencillo: '¿Cómo vas? {valor}'
  }
}

// Nombres "humanos" de cada parte de la evaluación (los usa el módulo de explicación)
const ASPECTOS = {
  material: 'el material',
  posicion: 'la posición de las piezas',
  peones:   'la estructura de peones',
  torres:   'la actividad de las torres',
  rey:      'la seguridad del rey',
  alfiles:  'el par de alfiles'
}

// Lo mismo, explicado para quien no sabe ajedrez (modo tutor)
const ASPECTOS_SENCILLO = {
  material: 'las piezas que tienes contra las del rival',
  posicion: 'qué tan bien colocadas están tus piezas',
  peones:   'la cadena de peones (que protejan bien y no se estorben)',
  torres:   'la libertad de movimiento de tus torres',
  rey:      'la protección de tu rey',
  alfiles:  'tener los dos alfiles, que juntos son muy fuertes'
}

// Casillas centrales (índices con a8 = 0): d5, e5, d4, e4
const CENTRO = [27, 28, 35, 36]

// ---------- Libro de aperturas ----------
// Conocimiento adquirido de expertos humanos (teoría de aperturas).
// Si la partida sigue una de estas líneas, el bot juega la siguiente jugada sin pensar.
// Formato: jugadas en notación "de-a" (e2e4 = peón de e2 a e4), separadas por espacios.
const LIBRO_APERTURAS = [
  { nombre: 'Apertura Española (Ruy López)', linea: 'e2e4 e7e5 g1f3 b8c6 f1b5 a7a6 b5a4 g8f6 e1g1 f8e7' },
  { nombre: 'Apertura Italiana',             linea: 'e2e4 e7e5 g1f3 b8c6 f1c4 f8c5 c2c3 g8f6 d2d4 e5d4' },
  { nombre: 'Apertura Escocesa',             linea: 'e2e4 e7e5 g1f3 b8c6 d2d4 e5d4 f3d4 g8f6 d4c6 b7c6' },
  { nombre: 'Defensa Petrov',                linea: 'e2e4 e7e5 g1f3 g8f6 f3e5 d7d6 e5f3 f6e4 d2d4 d6d5' },
  { nombre: 'Defensa Siciliana (Najdorf)',   linea: 'e2e4 c7c5 g1f3 d7d6 d2d4 c5d4 f3d4 g8f6 b1c3 a7a6' },
  { nombre: 'Defensa Siciliana (Clásica)',   linea: 'e2e4 c7c5 g1f3 b8c6 d2d4 c5d4 f3d4 g8f6 b1c3 d7d6' },
  { nombre: 'Defensa Francesa',              linea: 'e2e4 e7e6 d2d4 d7d5 b1c3 g8f6 c1g5 f8e7 e4e5 f6d7' },
  { nombre: 'Defensa Caro-Kann',             linea: 'e2e4 c7c6 d2d4 d7d5 b1c3 d5e4 c3e4 c8f5 e4g3 f5g6' },
  { nombre: 'Defensa Escandinava',           linea: 'e2e4 d7d5 e4d5 d8d5 b1c3 d5a5 d2d4 g8f6 g1f3 c8f5' },
  { nombre: 'Gambito de Dama Declinado',     linea: 'd2d4 d7d5 c2c4 e7e6 b1c3 g8f6 c1g5 f8e7 e2e3 e8g8' },
  { nombre: 'Defensa Eslava',                linea: 'd2d4 d7d5 c2c4 c7c6 g1f3 g8f6 b1c3 d5c4 a2a4 c8f5' },
  { nombre: 'Defensa India de Rey',          linea: 'd2d4 g8f6 c2c4 g7g6 b1c3 f8g7 e2e4 d7d6 g1f3 e8g8' },
  { nombre: 'Defensa Nimzo-India',           linea: 'd2d4 g8f6 c2c4 e7e6 b1c3 f8b4 e2e3 e8g8 f1d3 d7d5' },
  { nombre: 'Sistema Londres',               linea: 'd2d4 d7d5 g1f3 g8f6 c1f4 e7e6 e2e3 c7c5 c2c3 b8c6' },
  { nombre: 'Apertura Inglesa',              linea: 'c2c4 e7e5 b1c3 g8f6 g1f3 b8c6 g2g3 d7d5 c4d5 f6d5' }
]