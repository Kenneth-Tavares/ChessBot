# ChessBot
bot de ajedrez para la clase de introduccion a la ingenieria de conocimiento


Configuración rápida (al inicio de `script.js`):

| Constante      | Para qué sirve                                   |
|----------------|--------------------------------------------------|
| `playerColor`  | `'w'` = juegas con blancas, `'b'` = con negras    |
| `TIEMPO_BOT`   | milisegundos que piensa el bot (más = más fuerte) |
| `TIEMPO_TUTOR` | milisegundos que piensa el tutor                  |

## Arquitectura (sistema experto)

```
 ┌──────────────────────┐      ┌─────────────────────┐
 │  conocimiento.js     │◄─────│  motor.js           │
 │  BASE DE CONOCIMIENTO│      │  MOTOR DE INFERENCIA│
 │  (qué sabe)          │      │  (cómo razona)      │
 └──────────▲───────────┘      └──────────▲──────────┘
            │                             │
            │   ┌─────────────────────┐   │
            └───│  explicacion.js     │───┘
                │  MÓDULO DE          │
                │  EXPLICACIÓN        │
                │  (por qué)          │
                └──────────▲──────────┘
                           │
                ┌──────────┴──────────┐
                │  script.js +        │
                │  index.html + css   │
                │  INTERFAZ           │
                └─────────────────────┘
```

Los scripts se cargan en este orden (cada uno usa lo del anterior):
`conocimiento.js` → `motor.js` → `explicacion.js` → `script.js`.

---

### `conocimiento.js`: base de conocimiento

Solo datos: **lo que el bot sabe** de ajedrez, sin lógica. Es la parte más
cercana a la ontología del proyecto.

- **Tipos de pieza** (`PEON`, `CABALLO`, ...) y sus nombres.
- **Valor material** de cada pieza, diferente en medio juego (`VALOR_MG`) y en
  final (`VALOR_EG`). Por ejemplo, en el final el peón vale más porque puede coronar.
- **Fase de la partida** (`PESO_FASE`): cuántas piezas quedan, para saber si es
  medio juego o final.
- **Tablas de casillas** (`TABLA_MG`, `TABLA_EG`): qué tan buena es cada casilla
  para cada pieza. Convierten en números reglas como "caballo en la orilla,
  desgracia en la familia" o "en el final el rey va al centro".
- **`HEURISTICA`**: reglas de estrategia (par de alfiles, peones doblados o
  aislados, torres en columnas abiertas, peones que protegen al rey) y bonos por
  peón pasado.
- **`CONCEPTOS`**: el vocabulario de las explicaciones. Cada concepto tiene:
  - `tipo`: su clase (Resultado, Táctica, Estrategia, Experto, Evaluación, Plan)
  - `prioridad`: qué se muestra primero
  - `plantilla`: texto técnico (panel del bot)
  - `sencillo`: texto para quien no sabe ajedrez (modo tutor)
- **`ASPECTOS` / `ASPECTOS_SENCILLO`**: nombres de las partes de la evaluación
  (material, seguridad del rey, ...).
- **`LIBRO_APERTURAS`**: 15 aperturas clásicas con nombre. Es conocimiento
  tomado de expertos humanos.

### `motor.js`: motor de inferencia

Es **cómo razona** el bot. Usa su propio tablero, mucho más rápido que chess.js
(cerca de 1 millón de posiciones por segundo), y se divide en tres partes:

**Parte 1: representación y reglas**
- `pos` es la **memoria de trabajo**: la posición actual (piezas, turno,
  enroques, captura al paso, etc.).
- El tablero es de 10x12 con un borde de casillas `FUERA`, para detectar
  fácilmente cuando una pieza se sale.
- Cada jugada se guarda en un solo número entero (origen, destino, coronación y
  tipo especial).
- `generarJugadas`, `hacerJugada`, `deshacerJugada`: las reglas del ajedrez.
- **Hash Zobrist**: una "huella digital" de cada posición, que sirve para
  detectar repeticiones y para la memoria del motor.
- `perft`: prueba de validación que cuenta todas las jugadas posibles y las
  compara con valores conocidos.

**Parte 2: evaluación** (`evaluar`)
- Aplica la base de conocimiento a una posición y la resume en un número en
  **centipeones** (100 = un peón de ventaja).
- Mezcla los valores de medio juego y final según la fase (*tapered eval*).
- Incluye conocimiento de finales: sin peones, una ventaja pequeña no gana;
  cuando el rival solo tiene su rey, lo empuja a la orilla para darle mate.
- Puede devolver el **detalle** de cada aspecto, que usa el módulo de explicación.

**Parte 3: búsqueda** (`pensar`)
- **Minimax con poda alfa-beta**: imagina "si yo juego esto y el rival contesta
  aquello..." y descarta las ramas que no hace falta revisar.
- **Búsqueda de quietud**: no se detiene a mitad de un intercambio de piezas,
  para evitar el "efecto horizonte".
- **Tabla de transposición**: recuerda posiciones ya analizadas.
- **Ordenamiento de jugadas** (capturas, jugadas asesinas, historia): revisa
  primero las más prometedoras.
- **Jugada nula y reducciones (LMR)**: dedican menos tiempo a líneas casi
  seguramente malas.
- **Profundización iterativa**: piensa a profundidad 1, 2, 3... hasta que se
  acaba el tiempo.
- `consultarLibro`: busca si la partida va por una apertura del libro.

### `explicacion.js`: módulo de explicación

Responde **"¿por qué esta jugada?"** con **reglas de producción SI-ENTONCES**.
Cada regla que se cumple agrega un concepto de la base de conocimiento:

| SI...                                              | ENTONCES      |
|----------------------------------------------------|---------------|
| la jugada viene del libro de aperturas             | `APERTURA`    |
| la búsqueda encontró un mate forzado               | `MATE`        |
| captura una pieza                                  | `CAPTURA`     |
| corona un peón                                     | `PROMOCION`   |
| deja al rey rival en jaque                         | `JAQUE`       |
| la pieza movida ataca 2+ piezas valiosas a la vez  | `HORQUILLA`   |
| ataca una pieza valiosa o indefensa                | `AMENAZA`     |
| la pieza estaba en peligro y ya no                 | `SALVA_PIEZA` |
| es un enroque                                      | `ENROQUE`     |
| caballo/alfil sale de su fila inicial al principio | `DESARROLLO`  |
| ocupa o controla las casillas centrales            | `CENTRO`      |
| avanza un peón que nadie puede detener             | `PEON_PASADO` |
| la torre llega a una columna sin peones propios    | `COLUMNA`     |

También responde **"¿cómo llegó a esa conclusión?"**: compara la evaluación
antes de la jugada y al final de la línea que espera el motor, y dice qué
aspecto mejoró (`MEJORA`). Además muestra la línea esperada (`PLAN`) y la
valoración final (`VALORACION`).

`explicarJugada(..., sencillo)` usa el texto técnico (panel del bot) o el
sencillo (modo tutor). `describirJugada` convierte una jugada en texto como
"Mover el caballo de g1 a f3".

### `script.js`: interfaz

- **Turno del bot** (`botMove`):
  1. `elegirJugada` copia la partida al motor.
  2. Consulta el libro de aperturas.
  3. Si no hay jugada de libro, piensa con `pensar()`.
  4. Pide la explicación técnica, hace la jugada y llena el panel "¿Por qué jugó eso?".
- **Modo tutor** (`actualizarTutor`): cuando está encendido y es tu turno, usa el
  mismo motor para tu lado, dibuja una **flecha verde** con la jugada recomendada
  y la explica en lenguaje sencillo. Al jugar te dice si seguiste la
  recomendación.
- Mover piezas arrastrando o con clic, barra de evaluación, estado de la
  partida (jaque, mate, tablas) y botón de nueva partida.

### `index.html` y `style.css`

Estructura y estilos de la página: tablero, barra de evaluación, panel del bot,
panel del tutor con su interruptor y botón de nueva partida. Cada razón se
colorea según su tipo de concepto (táctica, estrategia, experto, ...).

## Librerías externas

- [chessboard2](https://github.com/oakmac/chessboard2): dibuja el tablero y las flechas.
- [chess.js 0.12.1](https://github.com/jhlywa/chess.js): valida las jugadas del
  humano y lleva el historial de la partida.

## Pendientes / ideas

- Mover el motor a un **Web Worker** para que la página no se congele mientras piensa.
- Dejar que el humano elija la pieza al coronar (ahora siempre corona dama).
