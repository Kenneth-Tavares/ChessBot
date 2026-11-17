// =====================================================
// MÓDULO DE EXPLICACIÓN
// Responde "¿por qué el bot eligió esta jugada?".
// Funciona con reglas de producción SI-ENTONCES:
//   SI la jugada captura una pieza  ENTONCES concepto CAPTURA
//   SI ataca dos piezas a la vez    ENTONCES concepto HORQUILLA
//   ...
// Cada regla que se cumple agrega un concepto de la base de conocimiento
// (CONCEPTOS en conocimiento.js) con su texto ya rellenado.
// =====================================================

const ARTICULO = ['el peón', 'el caballo', 'el alfil', 'la torre', 'la dama', 'el rey']

function articulo (tipo) { return ARTICULO[tipo] }

// "a", "a y b", "a, b y c"
function unir (lista) {
    if (lista.length <= 1) return lista.join('')
    return lista.slice(0, -1).join(', ') + ' y ' + lista[lista.length - 1]
}

// ---------- Hechos sobre la posición (consultas a la memoria de trabajo) ----------

// Casillas que ataca la pieza que está en s
function ataquesDesde (s) {
    const t = pos.tablero, p = t[s], tipo = tipoDe(p), color = colorDe(p)
    const res = []
    if (tipo === PEON) {
        const adelante = color === BLANCO ? -10 : 10
        for (const d of [adelante - 1, adelante + 1]) if (t[s + d] !== FUERA) res.push(s + d)
    } else if (tipo === CABALLO || tipo === REY) {
        for (const d of (tipo === CABALLO ? DIR_CABALLO : DIR_REY)) if (t[s + d] !== FUERA) res.push(s + d)
    } else {
        const dirs = tipo === ALFIL ? DIR_ALFIL : tipo === TORRE ? DIR_TORRE : DIR_REY
        for (const d of dirs) {
            let x = s + d
            while (t[x] !== FUERA) {
                res.push(x)
                if (t[x] !== VACIO) break
                x += d
            }
        }
    }
    return res
}

// Valor de la pieza más barata del bando "por" que ataca la casilla s (Infinity si ninguna)
function menorAtacante (s, por) {
    let menor = Infinity
    for (let i = 0; i < 64; i++) {
        const x = SQ120[i], p = pos.tablero[x]
        if (p === VACIO || colorDe(p) !== por) continue
        if (ataquesDesde(x).includes(s)) {
            const valor = tipoDe(p) === REY ? 10000 : VALOR_MG[tipoDe(p)]
            if (valor < menor) menor = valor
        }
    }
    return menor
}

// Una pieza está en peligro si la atacan y (no está defendida, o la ataca algo más barato)
function enPeligro (s) {
    const p = pos.tablero[s]
    if (p === VACIO || tipoDe(p) === REY) return false
    const color = colorDe(p)
    const atacante = menorAtacante(s, color ^ 1)
    if (atacante === Infinity) return false
    return !atacada(s, color) || atacante < VALOR_MG[tipoDe(p)]
}

// Un peón es pasado si ningún peón rival puede detenerlo (ni en su columna ni en las vecinas)
function esPeonPasado (s, color) {
    const paso = color === BLANCO ? -10 : 10, rival = pieza(color ^ 1, PEON)
    for (let x = s + paso; pos.tablero[x] !== FUERA; x += paso) {
        if (pos.tablero[x - 1] === rival || pos.tablero[x] === rival || pos.tablero[x + 1] === rival) return false
    }
    return true
}

function peonesPropiosEnColumna (s, color) {
    const col = SQ64[s] & 7, peon = pieza(color, PEON)
    let n = 0
    for (let fila = 0; fila < 8; fila++) if (pos.tablero[SQ120[fila * 8 + col]] === peon) n++
    return n
}

// Convierte la línea del motor a notación de ajedrez (Nf3, exd5...) usando chess.js
function lineaEnSAN (fen, linea, max = 6) {
    const copia = new Chess(fen)
    const san = []
    for (const m of linea.slice(0, max)) {
        const c = coronacion(m)
        const hecha = copia.move({ from: nombreCasilla(origen(m)), to: nombreCasilla(destino(m)), promotion: c ? LETRA_PIEZA[c] : undefined })
        if (!hecha) break
        san.push(hecha.san)
    }
    return san.join(' ')
}

function textoValor (valor) {
    // valor desde el punto de vista de las blancas
    if (Math.abs(valor) > MATE - 500) {
        const n = Math.ceil((MATE - Math.abs(valor)) / 2)
        return 'mate en ' + n + ' para las ' + (valor > 0 ? 'blancas' : 'negras')
    }
    const quien = valor > 0 ? 'blancas' : 'negras'
    const num = (valor > 0 ? '+' : '') + (valor / 100).toFixed(2)
    const a = Math.abs(valor)
    if (a < 30) return num + ' (igualdad)'
    if (a < 100) return num + ' (ligera ventaja de las ' + quien + ')'
    if (a < 300) return num + ' (ventaja de las ' + quien + ')'
    return num + ' (ventaja decisiva de las ' + quien + ')'
}

// Valoración para quien no sabe ajedrez (valor desde el punto de vista de quien mueve)
function textoValorSencillo (valor) {
    if (valor > MATE - 500) return 'Tienes la partida ganada: hay un jaque mate forzado.'
    if (valor < -MATE + 500) return 'La partida está perdida: el rival tiene un jaque mate forzado.'
    const peones = Math.abs(valor / 100).toFixed(1)
    if (Math.abs(valor) < 30) return 'La partida está pareja.'
    if (valor > 0) {
        if (valor < 100) return 'Vas un poco mejor (como ' + peones + ' peones de ventaja).'
        if (valor < 300) return 'Vas ganando (como ' + peones + ' peones de ventaja).'
        return 'Vas ganando por mucho (como ' + peones + ' peones de ventaja).'
    }
    if (valor > -100) return 'El rival va un poco mejor (como ' + peones + ' peones).'
    if (valor > -300) return 'El rival va ganando (como ' + peones + ' peones).'
    return 'El rival va ganando por mucho (como ' + peones + ' peones).'
}

// "Mueve el caballo de g1 a f3" (para el modo tutor)
function describirJugada (m) {
    const tipo = tipoDe(pos.tablero[origen(m)])
    const de = nombreCasilla(origen(m)), a = nombreCasilla(destino(m))
    if (especial(m) === ENROQUE) return 'Enrocar (el rey va de ' + de + ' a ' + a + ')'
    return 'Mover ' + articulo(tipo) + ' de ' + de + ' a ' + a
}

// ---------- Motor de reglas de explicación ----------
// juego: partida de chess.js ANTES de la jugada
// m: jugada elegida (formato del motor)
// resultado: lo que devolvió pensar() (null si fue jugada de libro)
// libro: { nombre } si la jugada salió del libro de aperturas
// sencillo: true = textos para quien no sabe ajedrez (modo tutor)
// Requiere que pos (motor) tenga cargada la misma posición que juego.
function explicarJugada (juego, m, resultado, libro, sencillo = false) {
    const razones = []
    const agregar = (id, datos = {}) => {
        const c = CONCEPTOS[id]
        let texto = sencillo ? c.sencillo : c.plantilla
        if (!texto) return // este concepto no se muestra en este modo
        for (const k in datos) texto = texto.replace('{' + k + '}', datos[k])
        texto = texto[0].toUpperCase() + texto.slice(1)
        razones.push({ id, tipo: c.tipo, prioridad: c.prioridad, texto })
    }

    const yo = pos.turno, rival = yo ^ 1
    const de = origen(m), a = destino(m)
    const p = pos.tablero[de], tipo = tipoDe(p), capturada = pos.tablero[a]
    const peligroAntes = enPeligro(de)
    const antes = {}
    evaluar(antes)

    // --- Reglas de conocimiento experto y resultado ---
    if (libro) agregar('APERTURA', { nombre: libro.nombre })
    if (resultado) {
        if (resultado.valor > MATE - 500) agregar('MATE', { n: Math.ceil((MATE - resultado.valor) / 2) })
        else if (resultado.valor < -MATE + 500) agregar('RECIBE_MATE')
    }

    // --- Reglas tácticas que se ven ANTES de mover ---
    if (capturada) agregar('CAPTURA', { pieza: articulo(tipoDe(capturada)), casilla: nombreCasilla(a) })
    else if (especial(m) === AL_PASO) agregar('CAPTURA', { pieza: 'el peón (al paso)', casilla: nombreCasilla(a) })
    if (coronacion(m)) agregar('PROMOCION', { pieza: NOMBRE_PIEZA[coronacion(m)] })
    if (especial(m) === ENROQUE) agregar('ENROQUE')

    // --- Reglas que se ven DESPUÉS de mover ---
    hacerJugada(m)
    const movida = pos.tablero[a]

    if (enJaque()) agregar('JAQUE')

    // SI la pieza movida ataca piezas valiosas o indefensas ENTONCES amenaza / horquilla
    const objetivos = []
    for (const s of ataquesDesde(a)) {
        const q = pos.tablero[s]
        if (q === VACIO || colorDe(q) !== rival) continue
        const tq = tipoDe(q)
        if (tq === REY) { objetivos.push('el rey'); continue }
        if (VALOR_MG[tq] > VALOR_MG[tipoDe(movida)] || !atacada(s, rival)) {
            objetivos.push(articulo(tq) + ' de ' + nombreCasilla(s))
        }
    }
    if (objetivos.length >= 2) agregar('HORQUILLA', { pieza: articulo(tipoDe(movida)), objetivos: unir(objetivos) })
    else if (objetivos.length === 1 && objetivos[0] !== 'el rey') agregar('AMENAZA', { objetivo: objetivos[0] })

    // SI la pieza estaba en peligro y ahora no ENTONCES la salvó
    if (peligroAntes && !capturada && !enPeligro(a)) agregar('SALVA_PIEZA', { pieza: articulo(tipo) })

    // --- Reglas estratégicas ---
    const filaFondo = yo === BLANCO ? 7 : 0
    const jugadasHechas = pos.hashes.length
    if ((tipo === CABALLO || tipo === ALFIL) && (SQ64[de] >> 3) === filaFondo && jugadasHechas < 40) {
        agregar('DESARROLLO', { pieza: articulo(tipo) })
    }
    if (tipo === PEON && esPeonPasado(a, yo) && !coronacion(m)) agregar('PEON_PASADO')
    const ocupaCentro = CENTRO.includes(SQ64[a]) && tipo !== REY
    const controlaCentro = (tipo === PEON || tipo === CABALLO) && ataquesDesde(a).some((s) => CENTRO.includes(SQ64[s]))
    if (jugadasHechas < 50 && (ocupaCentro || controlaCentro)) agregar('CENTRO')
    if (tipo === TORRE && peonesPropiosEnColumna(a, yo) === 0 && (SQ64[de] & 7) !== (SQ64[a] & 7)) agregar('COLUMNA')

    // si ninguna regla anterior aplicó, al menos explicar si la casilla nueva es mejor
    if (razones.length === 0 && especial(m) !== ENROQUE) {
        const antesIdx = yo === BLANCO ? SQ64[de] : SQ64[de] ^ 56
        const despuesIdx = yo === BLANCO ? SQ64[a] : SQ64[a] ^ 56
        if (TABLA_MG[tipo][despuesIdx] > TABLA_MG[tipo][antesIdx]) agregar('ACTIVIDAD', { pieza: articulo(tipo) })
    }
    deshacerJugada()

    // --- "¿Cómo llegó a esa conclusión?": comparar la evaluación antes y al final de la línea esperada ---
    if (resultado && resultado.linea.length > 0) {
        let hechas = 0
        for (const j of resultado.linea) {
            if (!hacerJugada(j)) break
            hechas++
        }
        const despues = {}
        evaluar(despues)
        for (let k = 0; k < hechas; k++) deshacerJugada()

        const signo = yo === BLANCO ? 1 : -1
        const mejoras = Object.keys(ASPECTOS)
            .map((k) => ({ k, delta: (despues[k] - antes[k]) * signo }))
            .filter((x) => x.delta >= 15)
            .sort((x, y) => y.delta - x.delta)
            .slice(0, 2)
            .map((x) => sencillo ? ASPECTOS_SENCILLO[x.k] : ASPECTOS[x.k] + ' (+' + (x.delta / 100).toFixed(2) + ')')
        if (mejoras.length) agregar('MEJORA', { aspectos: unir(mejoras) })

        if (resultado.linea.length > 1) agregar('PLAN', { linea: lineaEnSAN(juego.fen(), resultado.linea) })
        agregar('VALORACION', {
            valor: sencillo ? textoValorSencillo(resultado.valor) : textoValor(resultado.valor * signo),
            prof: resultado.profundidad,
            nodos: resultado.nodos.toLocaleString('es-MX')
        })
    }

    razones.sort((x, y) => y.prioridad - x.prioridad)
    return razones
}
