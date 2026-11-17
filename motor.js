// =====================================================
// MOTOR DE INFERENCIA - Parte 1: representación y reglas
// Tablero propio, rápido, para que el bot pueda "pensar"
// muchas jugadas por segundo. chess.js se queda solo para la interfaz.
// =====================================================

const BLANCO = 0, NEGRO = 1
const VACIO = 0
const FUERA = 7 // casilla fuera del tablero (borde)

// Codificación de piezas: tipo + 1 (1..6); las negras además llevan el bit 8 (9..14)
function pieza (color, tipo) { return (tipo + 1) | (color << 3) }
function tipoDe (p) { return (p & 7) - 1 }
function colorDe (p) { return p >> 3 }

// ---------- Tablero 10x12 ("mailbox") ----------
// El tablero de 8x8 va en medio de uno de 10x12 con un borde FUERA,
// así detectar "me salí del tablero" es solo preguntar si la casilla es FUERA.
// a8 = 21, h8 = 28, a1 = 91, h1 = 98
const SQ120 = new Int8Array(64)          // índice 0..63 (a8 = 0) -> 0..119
const SQ64 = new Int8Array(120).fill(-1) // 0..119 -> 0..63
for (let i = 0; i < 64; i++) {
    const s = 21 + Math.floor(i / 8) * 10 + (i % 8)
    SQ120[i] = s
    SQ64[s] = i
}

function nombreCasilla (s) {
    const i = SQ64[s]
    return 'abcdefgh'[i % 8] + (8 - (i >> 3))
}
function casillaDeNombre (n) {
    return SQ120[(8 - Number(n[1])) * 8 + 'abcdefgh'.indexOf(n[0])]
}

// Direcciones de movimiento en el tablero 10x12 (-10 = una fila hacia arriba)
const DIR_CABALLO = [-21, -19, -12, -8, 8, 12, 19, 21]
const DIR_ALFIL   = [-11, -9, 9, 11]
const DIR_TORRE   = [-10, -1, 1, 10]
const DIR_REY     = [-11, -10, -9, -1, 1, 9, 10, 11]

// ---------- Memoria de trabajo: la posición actual ----------
const pos = {
    tablero: new Uint8Array(120),
    turno: BLANCO,
    enroques: 0,  // bits: 1 = O-O blanco, 2 = O-O-O blanco, 4 = O-O negro, 8 = O-O-O negro
    alPaso: 0,    // casilla donde se puede capturar al paso (0 = ninguna)
    regla50: 0,   // medias jugadas desde la última captura o jugada de peón
    rey: [0, 0],  // dónde está cada rey
    hash: 0,      // "huella digital" de la posición
    pila: [],     // historial para poder deshacer jugadas
    hashes: []    // historial de huellas (para detectar repeticiones)
}

// Si una pieza sale de (o llega a) estas casillas, se pierden derechos de enroque
const MASCARA_ENROQUE = new Uint8Array(120).fill(15)
MASCARA_ENROQUE[95] = 12 // e1: el rey blanco se movió
MASCARA_ENROQUE[98] = 14 // h1
MASCARA_ENROQUE[91] = 13 // a1
MASCARA_ENROQUE[25] = 3  // e8: el rey negro se movió
MASCARA_ENROQUE[28] = 11 // h8
MASCARA_ENROQUE[21] = 7  // a8

// ---------- Hash Zobrist ----------
// Cada (pieza, casilla) tiene un número aleatorio; la huella de la posición es el XOR de todos.
// Sirve para reconocer posiciones repetidas y para la tabla de transposición (parte 3).
function aleatorio32 () { return (Math.random() * 0x100000000) | 0 }
const ZOB_PIEZA = new Int32Array(15 * 120).map(aleatorio32)
const ZOB_ENROQUE = new Int32Array(16).map(aleatorio32)
const ZOB_ALPASO = new Int32Array(120).map(aleatorio32)
const ZOB_TURNO = aleatorio32()

function calcularHash () {
    let h = 0
    for (let i = 0; i < 64; i++) {
        const s = SQ120[i], p = pos.tablero[s]
        if (p) h ^= ZOB_PIEZA[p * 120 + s]
    }
    if (pos.turno === NEGRO) h ^= ZOB_TURNO
    h ^= ZOB_ENROQUE[pos.enroques]
    if (pos.alPaso) h ^= ZOB_ALPASO[pos.alPaso]
    return h
}

// ---------- Cargar una posición (FEN) ----------
const FEN_INICIAL = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'

function cargarFEN (fen) {
    const [piezas, turno, enroques, alPaso, r50] = fen.split(' ')
    pos.tablero.fill(FUERA)
    for (let i = 0; i < 64; i++) pos.tablero[SQ120[i]] = VACIO

    let i = 0
    for (const ch of piezas) {
        if (ch === '/') continue
        if (ch >= '1' && ch <= '8') { i += Number(ch); continue }
        const color = ch === ch.toUpperCase() ? BLANCO : NEGRO
        const tipo = LETRA_PIEZA.indexOf(ch.toLowerCase())
        const s = SQ120[i]
        pos.tablero[s] = pieza(color, tipo)
        if (tipo === REY) pos.rey[color] = s
        i++
    }
    pos.turno = turno === 'w' ? BLANCO : NEGRO
    pos.enroques = (enroques.includes('K') ? 1 : 0) | (enroques.includes('Q') ? 2 : 0) |
                   (enroques.includes('k') ? 4 : 0) | (enroques.includes('q') ? 8 : 0)
    pos.alPaso = alPaso === '-' ? 0 : casillaDeNombre(alPaso)
    pos.regla50 = Number(r50) || 0
    pos.pila = []
    pos.hash = calcularHash()
    pos.hashes = [pos.hash]
}

// ---------- ¿Está atacada una casilla? ----------
function atacada (s, por) {
    const t = pos.tablero
    // peones: un peón blanco ataca hacia arriba (-9, -11), así que lo buscamos abajo (+9, +11)
    if (por === BLANCO) {
        const p = pieza(BLANCO, PEON)
        if (t[s + 9] === p || t[s + 11] === p) return true
    } else {
        const p = pieza(NEGRO, PEON)
        if (t[s - 9] === p || t[s - 11] === p) return true
    }
    const caballo = pieza(por, CABALLO), rey = pieza(por, REY)
    for (const d of DIR_CABALLO) if (t[s + d] === caballo) return true
    for (const d of DIR_REY) if (t[s + d] === rey) return true

    const alfil = pieza(por, ALFIL), torre = pieza(por, TORRE), dama = pieza(por, DAMA)
    for (const d of DIR_ALFIL) {
        let x = s + d
        while (t[x] === VACIO) x += d
        if (t[x] === alfil || t[x] === dama) return true
    }
    for (const d of DIR_TORRE) {
        let x = s + d
        while (t[x] === VACIO) x += d
        if (t[x] === torre || t[x] === dama) return true
    }
    return false
}

function enJaque () { return atacada(pos.rey[pos.turno], pos.turno ^ 1) }

// ---------- Codificación de jugadas ----------
// Una jugada se guarda en un solo número entero (muy rápido de copiar y comparar):
// bits 0-6: origen | bits 7-13: destino | bits 14-16: coronación | bits 17-18: especial
const NORMAL = 0, AL_PASO = 1, ENROQUE = 2, DOBLE = 3

function crearJugada (de, a, corona = 0, esp = NORMAL) { return de | (a << 7) | (corona << 14) | (esp << 17) }
function origen (m) { return m & 127 }
function destino (m) { return (m >> 7) & 127 }
function coronacion (m) { return (m >> 14) & 7 }
function especial (m) { return (m >> 17) & 3 }

function jugadaATexto (m) {
    const c = coronacion(m)
    return nombreCasilla(origen(m)) + nombreCasilla(destino(m)) + (c ? LETRA_PIEZA[c] : '')
}

// ---------- Generador de jugadas ----------
// Genera jugadas "pseudo-legales" (pueden dejar al rey en jaque);
// hacerJugada() se encarga de descartar las ilegales.
function generarJugadas (soloCapturas = false) {
    const t = pos.tablero, yo = pos.turno, rival = yo ^ 1
    const lista = []
    for (let i = 0; i < 64; i++) {
        const s = SQ120[i], p = t[s]
        if (p === VACIO || colorDe(p) !== yo) continue
        const tipo = tipoDe(p)

        if (tipo === PEON) {
            generarPeon(s, yo, lista, soloCapturas)
        } else if (tipo === CABALLO || tipo === REY) {
            // piezas que dan un solo "salto"
            const dirs = tipo === CABALLO ? DIR_CABALLO : DIR_REY
            for (const d of dirs) {
                const x = s + d, q = t[x]
                if (q === FUERA) continue
                if (q === VACIO) { if (!soloCapturas) lista.push(crearJugada(s, x)) }
                else if (colorDe(q) === rival) lista.push(crearJugada(s, x))
            }
        } else {
            // piezas que se deslizan (alfil, torre, dama)
            const dirs = tipo === ALFIL ? DIR_ALFIL : tipo === TORRE ? DIR_TORRE : DIR_REY
            for (const d of dirs) {
                let x = s + d
                while (t[x] === VACIO) {
                    if (!soloCapturas) lista.push(crearJugada(s, x))
                    x += d
                }
                if (t[x] !== FUERA && colorDe(t[x]) === rival) lista.push(crearJugada(s, x))
            }
        }
    }
    if (!soloCapturas) generarEnroques(yo, lista)
    return lista
}

function generarPeon (s, yo, lista, soloCapturas) {
    const t = pos.tablero
    const avance = yo === BLANCO ? -10 : 10
    const filaInicial = yo === BLANCO ? 8 : 3 // fila (s / 10) donde empiezan los peones
    const filaCorona = yo === BLANCO ? 2 : 9
    const x = s + avance

    // capturas en diagonal (incluye al paso)
    for (const lado of [-1, 1]) {
        const c = x + lado, q = t[c]
        if (q !== FUERA && q !== VACIO && colorDe(q) !== yo) agregarPeon(s, c, lista, filaCorona)
        else if (c === pos.alPaso) lista.push(crearJugada(s, c, 0, AL_PASO))
    }
    // avances
    if (t[x] === VACIO) {
        if (Math.floor(x / 10) === filaCorona) {
            agregarPeon(s, x, lista, filaCorona) // coronar cuenta como jugada "táctica"
        } else if (!soloCapturas) {
            lista.push(crearJugada(s, x))
            if (Math.floor(s / 10) === filaInicial && t[x + avance] === VACIO) {
                lista.push(crearJugada(s, x + avance, 0, DOBLE))
            }
        }
    }
}

function agregarPeon (de, a, lista, filaCorona) {
    if (Math.floor(a / 10) === filaCorona) {
        for (let c = DAMA; c >= CABALLO; c--) lista.push(crearJugada(de, a, c))
    } else {
        lista.push(crearJugada(de, a))
    }
}

function generarEnroques (yo, lista) {
    const t = pos.tablero, rival = yo ^ 1
    const e = yo === BLANCO ? 95 : 25 // casilla del rey (e1 / e8)
    const corto = yo === BLANCO ? 1 : 4, largo = yo === BLANCO ? 2 : 8
    // no se puede enrocar estando en jaque ni pasando por casillas atacadas
    if ((pos.enroques & corto) && t[e + 1] === VACIO && t[e + 2] === VACIO &&
        !atacada(e, rival) && !atacada(e + 1, rival) && !atacada(e + 2, rival)) {
        lista.push(crearJugada(e, e + 2, 0, ENROQUE))
    }
    if ((pos.enroques & largo) && t[e - 1] === VACIO && t[e - 2] === VACIO && t[e - 3] === VACIO &&
        !atacada(e, rival) && !atacada(e - 1, rival) && !atacada(e - 2, rival)) {
        lista.push(crearJugada(e, e - 2, 0, ENROQUE))
    }
}

// ---------- Hacer y deshacer jugadas ----------
// Devuelve false (y deshace) si la jugada deja al propio rey en jaque
function hacerJugada (m) {
    const t = pos.tablero
    const de = origen(m), a = destino(m), esp = especial(m)
    const p = t[de], capturada = t[a], yo = pos.turno

    pos.pila.push({ m, capturada, enroques: pos.enroques, alPaso: pos.alPaso, regla50: pos.regla50, hash: pos.hash })

    let h = pos.hash
    if (pos.alPaso) h ^= ZOB_ALPASO[pos.alPaso]
    h ^= ZOB_ENROQUE[pos.enroques]

    // mover la pieza (y coronar si toca)
    h ^= ZOB_PIEZA[p * 120 + de]
    t[de] = VACIO
    if (capturada) h ^= ZOB_PIEZA[capturada * 120 + a]
    const nueva = coronacion(m) ? pieza(yo, coronacion(m)) : p
    t[a] = nueva
    h ^= ZOB_PIEZA[nueva * 120 + a]

    if (esp === AL_PASO) {
        const c = a + (yo === BLANCO ? 10 : -10) // el peón capturado está "detrás" del destino
        h ^= ZOB_PIEZA[t[c] * 120 + c]
        t[c] = VACIO
    } else if (esp === ENROQUE) {
        const tDe = a > de ? a + 1 : a - 2 // de dónde sale la torre
        const tA = a > de ? a - 1 : a + 1  // a dónde llega
        const torre = t[tDe]
        h ^= ZOB_PIEZA[torre * 120 + tDe] ^ ZOB_PIEZA[torre * 120 + tA]
        t[tA] = torre
        t[tDe] = VACIO
    }
    if (tipoDe(p) === REY) pos.rey[yo] = a

    pos.alPaso = esp === DOBLE ? (de + a) >> 1 : 0
    if (pos.alPaso) h ^= ZOB_ALPASO[pos.alPaso]
    pos.enroques &= MASCARA_ENROQUE[de] & MASCARA_ENROQUE[a]
    h ^= ZOB_ENROQUE[pos.enroques]
    pos.regla50 = (capturada || tipoDe(p) === PEON) ? 0 : pos.regla50 + 1
    pos.turno = yo ^ 1
    h ^= ZOB_TURNO
    pos.hash = h
    pos.hashes.push(h)

    // ¿dejé a mi rey en jaque? entonces la jugada es ilegal
    if (atacada(pos.rey[yo], pos.turno)) {
        deshacerJugada()
        return false
    }
    return true
}

function deshacerJugada () {
    const u = pos.pila.pop()
    const t = pos.tablero, m = u.m
    const de = origen(m), a = destino(m), esp = especial(m)
    pos.turno ^= 1
    const yo = pos.turno

    const p = coronacion(m) ? pieza(yo, PEON) : t[a]
    t[de] = p
    t[a] = u.capturada
    if (esp === AL_PASO) {
        t[a + (yo === BLANCO ? 10 : -10)] = pieza(yo ^ 1, PEON)
    } else if (esp === ENROQUE) {
        const tDe = a > de ? a + 1 : a - 2
        const tA = a > de ? a - 1 : a + 1
        t[tDe] = t[tA]
        t[tA] = VACIO
    }
    if (tipoDe(p) === REY) pos.rey[yo] = de

    pos.enroques = u.enroques
    pos.alPaso = u.alPaso
    pos.regla50 = u.regla50
    pos.hash = u.hash
    pos.hashes.pop()
}

// "Jugada nula": pasar el turno sin mover (se usa en la búsqueda, parte 3)
function hacerNula () {
    pos.pila.push({ m: 0, capturada: 0, enroques: pos.enroques, alPaso: pos.alPaso, regla50: pos.regla50, hash: pos.hash })
    let h = pos.hash
    if (pos.alPaso) h ^= ZOB_ALPASO[pos.alPaso]
    pos.alPaso = 0
    pos.turno ^= 1
    h ^= ZOB_TURNO
    pos.hash = h
    pos.hashes.push(h)
}

function deshacerNula () {
    const u = pos.pila.pop()
    pos.turno ^= 1
    pos.alPaso = u.alPaso
    pos.hash = u.hash
    pos.hashes.pop()
}

// ¿Esta posición ya ocurrió antes? (solo hace falta revisar desde la última captura o jugada de peón)
function esRepeticion () {
    const n = pos.hashes.length - 1
    for (let i = n - 2; i >= 0 && i >= n - pos.regla50; i -= 2) {
        if (pos.hashes[i] === pos.hash) return true
    }
    return false
}

// ---------- Puente con chess.js ----------
// Copia la partida de chess.js al tablero del motor (jugada por jugada, para conocer las repeticiones)
function cargarDesdeJuego (juego) {
    cargarFEN(FEN_INICIAL)
    for (const h of juego.history({ verbose: true })) {
        hacerJugada(buscarJugada(h.from, h.to, h.promotion))
    }
}

function buscarJugada (de, a, corona) {
    const s1 = casillaDeNombre(de), s2 = casillaDeNombre(a)
    for (const m of generarJugadas()) {
        if (origen(m) === s1 && destino(m) === s2 &&
            (!coronacion(m) || LETRA_PIEZA[coronacion(m)] === (corona || 'q'))) return m
    }
    return 0
}

// ---------- Prueba: perft ----------
// Cuenta todas las posiciones posibles a cierta profundidad.
// Si el número coincide con el valor conocido, el generador de jugadas está bien.
function perft (prof) {
    if (prof === 0) return 1
    let n = 0
    for (const m of generarJugadas()) {
        if (hacerJugada(m)) {
            n += perft(prof - 1)
            deshacerJugada()
        }
    }
    return n
}


// =====================================================
// MOTOR DE INFERENCIA - Parte 2: evaluación
// Aplica la base de conocimiento (conocimiento.js) a la posición actual
// y la resume en un número: centipeones (100 = un peón de ventaja).
// =====================================================

// ---------- Tablas precalculadas ----------
// Se combinan una sola vez los datos de la base de conocimiento por código de pieza (1..14)
// y casilla (0..119), ya con signo: + para blancas, - para negras.
// Así evaluar() solo suma números y es mucho más rápida.
const MAT_MG = new Int16Array(15), MAT_EG = new Int16Array(15), FASE_P = new Int8Array(15)
const PST_MG = new Int16Array(15 * 120), PST_EG = new Int16Array(15 * 120)
for (let color = 0; color < 2; color++) {
    for (let tipo = 0; tipo < 6; tipo++) {
        const p = pieza(color, tipo), signo = color === BLANCO ? 1 : -1
        MAT_MG[p] = signo * VALOR_MG[tipo]
        MAT_EG[p] = signo * VALOR_EG[tipo]
        FASE_P[p] = PESO_FASE[tipo]
        for (let i = 0; i < 64; i++) {
            const idx = color === BLANCO ? i : i ^ 56 // las negras usan la tabla "volteada"
            PST_MG[p * 120 + SQ120[i]] = signo * TABLA_MG[tipo][idx]
            PST_EG[p * 120 + SQ120[i]] = signo * TABLA_EG[tipo][idx]
        }
    }
}

// Arreglos reutilizables (para no crear memoria nueva en cada evaluación)
const _peonesB = new Int8Array(10), _peonesN = new Int8Array(10) // peones por columna (1..8)
const _filaMaxBlanco = new Int8Array(10) // peón blanco más avanzado (hacia la fila 8) de cada columna
const _filaMinNegro = new Int8Array(10)  // peón negro más avanzado (hacia la fila 1) de cada columna
const _listaPeones = new Int8Array(16)   // índices 0..63 de los peones (blancos y negros)
const _listaTorres = new Int8Array(20)

// Mezcla medio juego y final según la fase (24 = medio juego puro, 0 = final puro)
function mezclar (mg, eg, fase) { return (mg * fase + eg * (FASE_TOTAL - fase)) / FASE_TOTAL }

// Devuelve la evaluación desde el punto de vista del bando que mueve.
// Si se pasa un objeto "detalle", lo llena con cada aspecto por separado
// (desde el punto de vista de las blancas): lo usa el módulo de explicación.
function evaluar (detalle = null) {
    const t = pos.tablero
    // cada aspecto tiene valor de medio juego (Mg) y de final (Eg); positivo = bueno para blancas
    let matMg = 0, matEg = 0, pstMg = 0, pstEg = 0
    let peoMg = 0, peoEg = 0, torMg = 0, torEg = 0, reyMg = 0, alfMg = 0, alfEg = 0
    let fase = 0, nPeones = 0, nTorres = 0
    let alfilesB = 0, alfilesN = 0, piezasB = 0, piezasN = 0, peonesB = 0, peonesN = 0

    _peonesB.fill(0); _peonesN.fill(0)
    _filaMaxBlanco.fill(-1); _filaMinNegro.fill(8)

    // 1) Recorrer el tablero: material, tablas de casillas y datos para las reglas
    for (let i = 0; i < 64; i++) {
        const s = SQ120[i], p = t[s]
        if (p === VACIO) continue
        matMg += MAT_MG[p]
        matEg += MAT_EG[p]
        pstMg += PST_MG[p * 120 + s]
        pstEg += PST_EG[p * 120 + s]
        fase += FASE_P[p]

        const tipo = (p & 7) - 1, blanca = p < 8
        if (tipo === PEON) {
            const fila = i >> 3, col = (i & 7) + 1
            if (blanca) {
                _peonesB[col]++; peonesB++
                if (fila > _filaMaxBlanco[col]) _filaMaxBlanco[col] = fila
            } else {
                _peonesN[col]++; peonesN++
                if (fila < _filaMinNegro[col]) _filaMinNegro[col] = fila
            }
            _listaPeones[nPeones++] = blanca ? i : i + 64 // +64 marca "peón negro"
        } else if (tipo !== REY) {
            if (blanca) piezasB += VALOR_MG[tipo]; else piezasN += VALOR_MG[tipo]
            if (tipo === ALFIL) { if (blanca) alfilesB++; else alfilesN++ }
            else if (tipo === TORRE && nTorres < 20) _listaTorres[nTorres++] = blanca ? i : i + 64
        }
    }

    // 2) Reglas de estructura de peones
    for (let k = 0; k < nPeones; k++) {
        const blanca = _listaPeones[k] < 64, i = _listaPeones[k] & 63
        const fila = i >> 3, col = (i & 7) + 1
        const propios = blanca ? _peonesB : _peonesN
        let mg = 0, eg = 0
        // peón aislado: sin peones propios en las columnas vecinas
        if (propios[col - 1] === 0 && propios[col + 1] === 0) {
            mg += HEURISTICA.PEON_AISLADO[0]
            eg += HEURISTICA.PEON_AISLADO[1]
        }
        // peón pasado: ningún peón rival delante, ni en su columna ni en las vecinas
        const pasado = blanca
            ? _filaMinNegro[col - 1] >= fila && _filaMinNegro[col] >= fila && _filaMinNegro[col + 1] >= fila
            : _filaMaxBlanco[col - 1] <= fila && _filaMaxBlanco[col] <= fila && _filaMaxBlanco[col + 1] <= fila
        if (pasado) {
            const avance = blanca ? 7 - fila : fila // 1 = recién salido, 6 = a punto de coronar
            mg += PEON_PASADO_MG[avance]
            eg += PEON_PASADO_EG[avance]
        }
        if (blanca) { peoMg += mg; peoEg += eg } else { peoMg -= mg; peoEg -= eg }
    }
    for (let col = 1; col <= 8; col++) {
        // peones doblados: castigo por cada peón extra en la misma columna
        if (_peonesB[col] > 1) { peoMg += HEURISTICA.PEON_DOBLADO[0] * (_peonesB[col] - 1); peoEg += HEURISTICA.PEON_DOBLADO[1] * (_peonesB[col] - 1) }
        if (_peonesN[col] > 1) { peoMg -= HEURISTICA.PEON_DOBLADO[0] * (_peonesN[col] - 1); peoEg -= HEURISTICA.PEON_DOBLADO[1] * (_peonesN[col] - 1) }
    }

    // 3) Torres en columnas abiertas / semiabiertas
    for (let k = 0; k < nTorres; k++) {
        const blanca = _listaTorres[k] < 64, col = (_listaTorres[k] & 7) + 1
        const propios = blanca ? _peonesB : _peonesN, rivales = blanca ? _peonesN : _peonesB
        if (propios[col] === 0) {
            const regla = rivales[col] === 0 ? HEURISTICA.TORRE_COL_ABIERTA : HEURISTICA.TORRE_COL_SEMIABIERTA
            if (blanca) { torMg += regla[0]; torEg += regla[1] } else { torMg -= regla[0]; torEg -= regla[1] }
        }
    }

    // 4) Par de alfiles
    if (alfilesB >= 2) { alfMg += HEURISTICA.PAR_DE_ALFILES[0]; alfEg += HEURISTICA.PAR_DE_ALFILES[1] }
    if (alfilesN >= 2) { alfMg -= HEURISTICA.PAR_DE_ALFILES[0]; alfEg -= HEURISTICA.PAR_DE_ALFILES[1] }

    // 5) Seguridad del rey: peones propios justo delante del rey (escudo)
    const fB = pos.rey[BLANCO] - 10, pB = pieza(BLANCO, PEON)
    const fN = pos.rey[NEGRO] + 10, pN = pieza(NEGRO, PEON)
    const escudoB = (t[fB - 1] === pB) + (t[fB] === pB) + (t[fB + 1] === pB)
    const escudoN = (t[fN - 1] === pN) + (t[fN] === pN) + (t[fN + 1] === pN)
    reyMg += (escudoB - escudoN) * HEURISTICA.ESCUDO_REY[0]

    // 6) Mezclar medio juego y final según la fase de la partida ("tapered eval")
    if (fase > FASE_TOTAL) fase = FASE_TOTAL
    let total = mezclar(matMg + pstMg + peoMg + torMg + reyMg + alfMg, matEg + pstEg + peoEg + torEg + alfEg, fase)

    // 7) Conocimiento de finales
    const ganaBlanco = total > 0
    const peonesFuerte = ganaBlanco ? peonesB : peonesN
    const piezasFuerte = ganaBlanco ? piezasB : piezasN, piezasDebil = ganaBlanco ? piezasN : piezasB
    // sin peones, una ventaja menor que una torre casi nunca alcanza para ganar
    if (peonesFuerte === 0 && piezasFuerte - piezasDebil < 400) total /= 8
    // "mop-up": si el rival solo tiene su rey, empujarlo a la orilla y acercar el nuestro para dar mate
    if ((ganaBlanco ? peonesN : peonesB) === 0 && piezasDebil === 0 && piezasFuerte >= 400) {
        const rd = SQ64[pos.rey[ganaBlanco ? NEGRO : BLANCO]], rf = SQ64[pos.rey[ganaBlanco ? BLANCO : NEGRO]]
        const fd = rd >> 3, cd = rd & 7
        const orilla = Math.max(3 - fd, fd - 4) + Math.max(3 - cd, cd - 4) // 0 en el centro, 6 en la esquina
        const distancia = Math.abs(fd - (rf >> 3)) + Math.abs(cd - (rf & 7))
        total += (ganaBlanco ? 1 : -1) * (orilla * 10 + (14 - distancia) * 4)
    }

    if (detalle) {
        detalle.material = mezclar(matMg, matEg, fase)
        detalle.posicion = mezclar(pstMg, pstEg, fase)
        detalle.peones = mezclar(peoMg, peoEg, fase)
        detalle.torres = mezclar(torMg, torEg, fase)
        detalle.rey = mezclar(reyMg, 0, fase)
        detalle.alfiles = mezclar(alfMg, alfEg, fase)
        detalle.fase = fase
        detalle.total = total
    }
    total = Math.round(total)
    return pos.turno === BLANCO ? total : -total
}

// ¿El bando tiene piezas además de peones y rey? (para la jugada nula)
function tienePiezas (color) {
    for (let i = 0; i < 64; i++) {
        const p = pos.tablero[SQ120[i]]
        if (p !== VACIO && colorDe(p) === color && tipoDe(p) !== PEON && tipoDe(p) !== REY) return true
    }
    return false
}

// =====================================================
// MOTOR DE INFERENCIA - Parte 3: búsqueda
// Minimax (negamax) con poda alfa-beta y las técnicas clásicas
// que permiten pensar más profundo en el mismo tiempo.
// =====================================================

const MATE = 30000
const INFINITO = 32000
const MAX_PLY = 100

// ---------- Tabla de transposición ----------
// "Memoria" del motor: guarda posiciones ya analizadas (por su hash)
// para no repetir trabajo cuando se llega a ellas por otro orden de jugadas.
const TT_TAM = 1 << 20, TT_MASCARA = TT_TAM - 1
const TT_EXACTO = 1, TT_ALFA = 2, TT_BETA = 3
const tt = {
    clave: new Int32Array(TT_TAM),
    jugada: new Int32Array(TT_TAM),
    valor: new Int16Array(TT_TAM),
    prof: new Int8Array(TT_TAM),
    tipo: new Uint8Array(TT_TAM)
}

function ttGuardar (prof, valor, tipo, jugada, ply) {
    const i = pos.hash & TT_MASCARA
    // los mates se guardan como "distancia desde esta posición", no desde la raíz
    if (valor > MATE - 500) valor += ply
    else if (valor < -MATE + 500) valor -= ply
    tt.clave[i] = pos.hash
    tt.jugada[i] = jugada
    tt.valor[i] = valor
    tt.prof[i] = prof
    tt.tipo[i] = tipo
}

// ---------- Estado de la búsqueda ----------
let nodos = 0, inicio = 0, limite = 0, parar = false
let mejorRaiz = 0, valorRaiz = 0
const asesinas = new Int32Array(MAX_PLY * 2 + 2) // 2 jugadas "asesinas" por nivel
const historia = new Int32Array(15 * 120)        // qué jugadas tranquilas han funcionado antes

function revisarTiempo () {
    if (performance.now() - inicio > limite) parar = true
}

// ---------- Ordenamiento de jugadas ----------
// Alfa-beta poda mucho más si se revisan primero las mejores jugadas:
// 1) la de la tabla de transposición, 2) capturas (MVV-LVA: víctima valiosa, atacante barato),
// 3) coronaciones, 4) jugadas asesinas, 5) el resto según la historia.
function puntuarJugadas (lista, ttJugada, ply) {
    const t = pos.tablero
    const puntos = new Int32Array(lista.length)
    for (let i = 0; i < lista.length; i++) {
        const m = lista[i]
        if (m === ttJugada) { puntos[i] = 2000000; continue }
        const victima = t[destino(m)], atacante = t[origen(m)]
        if (victima) puntos[i] = 1000000 + (tipoDe(victima) + 1) * 100 - tipoDe(atacante)
        else if (especial(m) === AL_PASO) puntos[i] = 1000100
        else if (coronacion(m)) puntos[i] = 900000 + coronacion(m)
        else if (m === asesinas[ply * 2]) puntos[i] = 800000
        else if (m === asesinas[ply * 2 + 1]) puntos[i] = 790000
        else puntos[i] = historia[atacante * 120 + destino(m)]
    }
    return puntos
}

// Trae al frente la jugada con más puntos (ordenamiento "perezoso": solo lo necesario)
function siguiente (lista, puntos, i) {
    let mejor = i
    for (let j = i + 1; j < lista.length; j++) if (puntos[j] > puntos[mejor]) mejor = j
    const m = lista[mejor]; lista[mejor] = lista[i]; lista[i] = m
    const p = puntos[mejor]; puntos[mejor] = puntos[i]; puntos[i] = p
    return m
}

// ---------- Búsqueda de quietud ----------
// Al llegar a la profundidad límite no se evalúa a media captura:
// se siguen revisando solo capturas hasta que la posición esté "quieta".
// Esto evita el "efecto horizonte" (creer que se gana una pieza que en realidad se pierde).
function quietud (alfa, beta, ply) {
    nodos++
    if ((nodos & 2047) === 0) revisarTiempo()
    if (parar) return 0

    const estatica = evaluar()
    if (ply >= MAX_PLY) return estatica
    if (estatica >= beta) return estatica // "stand pat": no estoy obligado a capturar
    if (estatica > alfa) alfa = estatica
    let mejor = estatica

    const lista = generarJugadas(true)
    const puntos = puntuarJugadas(lista, 0, ply)
    for (let i = 0; i < lista.length; i++) {
        const m = siguiente(lista, puntos, i)
        if (!hacerJugada(m)) continue
        const v = -quietud(-beta, -alfa, ply + 1)
        deshacerJugada()
        if (parar) return 0
        if (v > mejor) {
            mejor = v
            if (v > alfa) {
                alfa = v
                if (v >= beta) break
            }
        }
    }
    return mejor
}

// ---------- Búsqueda principal (negamax + alfa-beta) ----------
// Devuelve el valor de la posición para el bando que mueve.
function buscar (prof, alfa, beta, ply, permitirNula) {
    const raiz = ply === 0
    if (!raiz && (esRepeticion() || pos.regla50 >= 100)) return 0 // tablas

    const jaque = enJaque()
    if (jaque) prof++ // extensión: si hay jaque, pensar una jugada más
    if (prof <= 0) return quietud(alfa, beta, ply)

    nodos++
    if ((nodos & 2047) === 0) revisarTiempo()
    if (parar) return 0
    if (ply >= MAX_PLY) return evaluar()

    const esPV = beta - alfa > 1 // ¿es parte de la línea principal?

    // ¿ya analizamos esta posición antes?
    const i = pos.hash & TT_MASCARA
    let ttJugada = 0
    if (tt.clave[i] === pos.hash) {
        ttJugada = tt.jugada[i]
        if (!raiz && !esPV && tt.prof[i] >= prof) {
            let v = tt.valor[i]
            if (v > MATE - 500) v -= ply
            else if (v < -MATE + 500) v += ply
            const tipo = tt.tipo[i]
            if (tipo === TT_EXACTO || (tipo === TT_BETA && v >= beta) || (tipo === TT_ALFA && v <= alfa)) return v
        }
    }

    if (!jaque && !esPV) {
        const estatica = evaluar()
        // poda de futilidad inversa: voy tan bien que, aun perdiendo algo, sigo arriba de beta
        if (prof <= 3 && estatica - 120 * prof >= beta) return estatica
        // jugada nula: si aun "pasando" el turno el rival no me alcanza, la posición es muy buena
        if (permitirNula && prof >= 3 && estatica >= beta && tienePiezas(pos.turno)) {
            hacerNula()
            const v = -buscar(prof - 3 - (prof > 6 ? 1 : 0), -beta, -beta + 1, ply + 1, false)
            deshacerNula()
            if (parar) return 0
            if (v >= beta) return v >= MATE - 500 ? beta : v
        }
    }

    const lista = generarJugadas()
    const puntos = puntuarJugadas(lista, ttJugada, ply)
    const alfaOriginal = alfa
    let mejor = -INFINITO, mejorJugada = 0, legales = 0

    for (let k = 0; k < lista.length; k++) {
        const m = siguiente(lista, puntos, k)
        const tranquila = !pos.tablero[destino(m)] && !coronacion(m) && especial(m) !== AL_PASO
        if (!hacerJugada(m)) continue
        legales++

        let v
        if (legales === 1) {
            v = -buscar(prof - 1, -beta, -alfa, ply + 1, true)
        } else {
            // reducción de jugadas tardías (LMR): las jugadas mal ordenadas
            // casi nunca son buenas, así que primero se revisan con menos profundidad
            let r = 0
            if (prof >= 3 && legales > 3 && tranquila && !jaque && !enJaque()) r = legales > 8 ? 2 : 1
            // búsqueda de ventana nula (PVS): solo comprobar si es mejor que alfa
            v = -buscar(prof - 1 - r, -alfa - 1, -alfa, ply + 1, true)
            if (v > alfa && r > 0) v = -buscar(prof - 1, -alfa - 1, -alfa, ply + 1, true)
            if (v > alfa && v < beta) v = -buscar(prof - 1, -beta, -alfa, ply + 1, true)
        }
        deshacerJugada()
        if (parar) return 0

        if (v > mejor) {
            mejor = v
            mejorJugada = m
            if (raiz) { mejorRaiz = m; valorRaiz = v }
            if (v > alfa) {
                alfa = v
                if (v >= beta) {
                    // corte beta: recordar la jugada para ordenar mejor en el futuro
                    if (tranquila) {
                        if (asesinas[ply * 2] !== m) {
                            asesinas[ply * 2 + 1] = asesinas[ply * 2]
                            asesinas[ply * 2] = m
                        }
                        historia[pos.tablero[origen(m)] * 120 + destino(m)] += prof * prof
                    }
                    break
                }
            }
        }
    }

    if (legales === 0) return jaque ? -MATE + ply : 0 // jaque mate o ahogado

    const tipo = mejor >= beta ? TT_BETA : mejor > alfaOriginal ? TT_EXACTO : TT_ALFA
    ttGuardar(prof, mejor, tipo, mejorJugada, ply)
    return mejor
}

// Recupera la línea que el motor espera, siguiendo la tabla de transposición
function lineaPrincipal (primera, max = 8) {
    const linea = []
    let m = primera
    while (m && linea.length < max) {
        if (!generarJugadas().includes(m) || !hacerJugada(m)) break
        linea.push(m)
        const i = pos.hash & TT_MASCARA
        m = tt.clave[i] === pos.hash ? tt.jugada[i] : 0
    }
    for (let k = 0; k < linea.length; k++) deshacerJugada()
    return linea
}

// ---------- Profundización iterativa ----------
// Piensa a profundidad 1, luego 2, luego 3... hasta que se acaba el tiempo.
// Cada vuelta usa lo aprendido en la anterior (tabla de transposición, historia).
function pensar (limiteMs = 3000, profMax = 64) {
    inicio = performance.now()
    limite = limiteMs
    parar = false
    nodos = 0
    historia.fill(0)
    asesinas.fill(0)

    const resultado = { jugada: 0, valor: 0, profundidad: 0, nodos: 0, tiempo: 0, linea: [] }
    for (let prof = 1; prof <= profMax; prof++) {
        mejorRaiz = 0
        const v = buscar(prof, -INFINITO, INFINITO, 0, false)
        // aunque se acabe el tiempo a la mitad, la mejor jugada encontrada hasta ahí es confiable
        if (mejorRaiz) {
            resultado.jugada = mejorRaiz
            resultado.valor = parar ? valorRaiz : v
            resultado.profundidad = prof
        }
        if (parar) break
        if (Math.abs(v) > MATE - 500) break                     // ya encontró un mate
        if (performance.now() - inicio > limite * 0.5) break // no alcanzaría otra vuelta completa
    }
    resultado.nodos = nodos
    resultado.tiempo = Math.round(performance.now() - inicio)
    resultado.linea = lineaPrincipal(resultado.jugada)
    return resultado
}

// ---------- Libro de aperturas ----------
// Si las jugadas de la partida coinciden con el inicio de alguna línea del libro,
// devuelve la siguiente jugada de esa línea (elige al azar si hay varias).
function consultarLibro (jugadasPartida) {
    const hechas = jugadasPartida.join(' ')
    const opciones = []
    for (const ap of LIBRO_APERTURAS) {
        const linea = ap.linea.split(' ')
        if (linea.length <= jugadasPartida.length) continue
        if (linea.slice(0, jugadasPartida.length).join(' ') === hechas) {
            opciones.push({ jugada: linea[jugadasPartida.length], nombre: ap.nombre })
        }
    }
    if (opciones.length === 0) return null
    const elegida = opciones[Math.floor(Math.random() * opciones.length)]
    // si esa jugada aparece en varias aperturas (como 1.e4), todavía no se sabe cuál será
    const nombres = [...new Set(opciones.filter((o) => o.jugada === elegida.jugada).map((o) => o.nombre))]
    const nombre = nombres.length === 1
        ? nombres[0]
        : 'común a varias aperturas, como la ' + nombres[0] + ' y la ' + nombres[1]
    return { jugada: elegida.jugada, nombre }
}
