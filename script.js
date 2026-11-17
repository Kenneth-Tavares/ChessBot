// =====================================================
// INTERFAZ
// Conecta el tablero (chessboard2 + chess.js) con el sistema experto:
// base de conocimiento (conocimiento.js), motor de inferencia (motor.js)
// y módulo de explicación (explicacion.js).
// =====================================================

const game = new Chess()

const playerColor = 'w'    // el humano juega con este color; el bot con el otro
const TIEMPO_BOT = 3000    // milisegundos que el bot piensa cada jugada
const TIEMPO_TUTOR = 2000  // milisegundos que el tutor piensa su recomendación
const COLOR_FLECHA = '#15781B'

let selectedSquare = null  // casilla de la pieza seleccionada con clic
let evalBlancas = 0        // última evaluación (centipeones, + = ventaja blanca)
let tutorActivo = false    // ¿está encendido el modo tutor?
let recomendacion = null   // última jugada recomendada por el tutor: { de, a, descripcion }

const boardConfig = {
    showNotation: true,
    draggable: true,
    dropOffBoard: 'snapback',
    orientation: playerColor === 'w' ? 'white' : 'black',
    position: 'start',
    onDragStart,
    onDrop,
    onMousedownSquare
}

const board = Chessboard2('myBoard', boardConfig)

const statusEl = byID('gameStatus')
const fenEl = byID('gameFEN')
const pgnEl = byID('gamePGN')
const evalWhiteEl = byID('evalWhite')
const jugadaBotEl = byID('jugadaBot')
const razonesEl = byID('razones')
const tutorSwitchEl = byID('tutorSwitch')
const tutorRetroEl = byID('tutorRetro')
const tutorJugadaEl = byID('tutorJugada')
const tutorRazonesEl = byID('tutorRazones')

// =====================================================
// ELEGIR JUGADA (lo usan el bot y el tutor)
// =====================================================

// Devuelve { m, resultado, libro } para el bando al que le toca mover
function elegirJugada (tiempo) {
    // 1) copiar la partida a la memoria de trabajo del motor
    cargarDesdeJuego(game)

    // 2) primero consultar el conocimiento experto (libro de aperturas)
    const hechas = game.history({ verbose: true }).map((h) => h.from + h.to + (h.promotion || ''))
    let libro = consultarLibro(hechas)
    let m = 0, resultado = null
    if (libro) m = buscarJugada(libro.jugada.slice(0, 2), libro.jugada.slice(2, 4))

    // 3) si no hay jugada de libro, razonar con el motor de inferencia (búsqueda)
    if (!m) {
        libro = null
        resultado = pensar(tiempo)
        m = resultado.jugada
    }
    return { m, resultado, libro }
}

// =====================================================
// TURNO DEL BOT
// =====================================================

function botMove () {
    if (game.game_over()) return
    statusEl.innerHTML = 'El bot está pensando...'

    // pequeña pausa para que el navegador pinte el mensaje antes de que el bot piense
    setTimeout(() => {
        const { m, resultado, libro } = elegirJugada(TIEMPO_BOT)
        if (!m) return

        // pedir al módulo de explicación el "por qué" (versión técnica)
        const razones = explicarJugada(game, m, resultado, libro)

        // hacer la jugada en la partida real
        const c = coronacion(m)
        const hecha = game.move({
            from: nombreCasilla(origen(m)),
            to: nombreCasilla(destino(m)),
            promotion: c ? LETRA_PIEZA[c] : undefined
        })
        console.log('bot:', hecha.san, resultado || '(libro)')

        if (resultado) evalBlancas = game.turn() === 'w' ? -resultado.valor : resultado.valor
        board.fen(game.fen())
        jugadaBotEl.innerHTML = 'El bot jugó <strong>' + hecha.san + '</strong>'
        mostrarRazones(razonesEl, razones)
        updateStatus()
        actualizarTutor() // ahora le toca al humano: el tutor puede recomendar
    }, 50)
}

// =====================================================
// MODO TUTOR
// Usa el mismo motor y el mismo módulo de explicación, pero para el lado del humano
// y con textos para alguien que no sabe ajedrez. Dibuja una flecha con la jugada.
// =====================================================

function actualizarTutor () {
    board.clearArrows()
    recomendacion = null
    tutorRazonesEl.innerHTML = ''

    if (!tutorActivo) {
        tutorJugadaEl.textContent = 'Enciéndelo para que te recomiende una jugada y te explique por qué.'
        tutorRetroEl.textContent = ''
        return
    }
    if (game.game_over()) { tutorJugadaEl.textContent = 'La partida terminó.'; return }
    if (game.turn() !== playerColor) { tutorJugadaEl.textContent = 'Esperando a que juegue el bot...'; return }

    tutorJugadaEl.textContent = 'El tutor está pensando...'
    setTimeout(() => {
        // por si mientras tanto se apagó el tutor o cambió el turno
        if (!tutorActivo || game.turn() !== playerColor || game.game_over()) return

        const { m, resultado, libro } = elegirJugada(TIEMPO_TUTOR)
        if (!m) return
        const descripcion = describirJugada(m)
        const razones = explicarJugada(game, m, resultado, libro, true)
        if (razones.length === 0) {
            razones.push({ tipo: 'Evaluación', texto: 'Es la jugada que mejor resultado dio cuando la computadora calculó las posibles respuestas del rival.' })
        }

        const de = nombreCasilla(origen(m)), a = nombreCasilla(destino(m))
        recomendacion = { de, a, descripcion }
        board.addArrow({ start: de, end: a, color: COLOR_FLECHA })

        tutorJugadaEl.innerHTML = 'Te recomiendo: <strong>' + descripcion + '</strong>'
        mostrarRazones(tutorRazonesEl, razones)
    }, 50)
}

tutorSwitchEl.addEventListener('change', () => {
    tutorActivo = tutorSwitchEl.checked
    tutorRetroEl.textContent = ''
    actualizarTutor()
})

// =====================================================
// PANELES DE EXPLICACIÓN
// =====================================================

function mostrarRazones (lista, razones) {
    lista.innerHTML = ''
    for (const r of razones) {
        const li = document.createElement('li')
        li.className = 'razon tipo-' + r.tipo.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
        const etiqueta = document.createElement('span')
        etiqueta.className = 'etiqueta'
        etiqueta.textContent = r.tipo
        const texto = document.createElement('span')
        texto.textContent = r.texto
        li.append(etiqueta, texto)
        lista.append(li)
    }
}

// =====================================================
// MOVER PIEZAS (lo comparten arrastrar y hacer clic)
// =====================================================

function tryMove (from, to) {
    const move = game.move({
        from,
        to,
        promotion: 'q' // NOTA: el humano siempre corona dama, por simplicidad
    })

    board.clearCircles()
    selectedSquare = null

    if (!move) return false

    // retroalimentación del tutor: ¿siguió la recomendación?
    if (tutorActivo && recomendacion) {
        tutorRetroEl.textContent = (from === recomendacion.de && to === recomendacion.a)
            ? '¡Bien! Hiciste la jugada que recomendaba el tutor.'
            : 'Hiciste otra jugada. El tutor recomendaba: ' + recomendacion.descripcion + '.'
    }

    // evaluación rápida (sin búsqueda) para la barra después de la jugada del humano
    cargarDesdeJuego(game)
    evalBlancas = game.turn() === 'w' ? evaluar() : -evaluar()

    board.fen(game.fen())
    updateStatus()
    actualizarTutor() // borra la flecha mientras juega el bot
    setTimeout(botMove, 250) // deja que se pinte el tablero antes de que el bot piense
    return true
}

function showMovesFrom (square) {
    board.clearCircles()
    game.moves({ square, verbose: true }).forEach((m) => board.addCircle(m.to))
}

// ---------- arrastrar y soltar ----------

function onDragStart (dragStartEvt) {
    // no se pueden tomar piezas si terminó la partida
    if (game.game_over()) return false

    // solo en el turno del humano, y solo sus piezas
    if (game.turn() !== playerColor) return false
    if (playerColor === 'w' && !isWhitePiece(dragStartEvt.piece)) return false
    if (playerColor === 'b' && !isBlackPiece(dragStartEvt.piece)) return false

    // la pieza arrastrada queda seleccionada y se muestran sus jugadas
    selectedSquare = dragStartEvt.square
    showMovesFrom(dragStartEvt.square)
}

function onDrop (dropEvt) {
    // si se suelta en su misma casilla, se conserva la selección
    if (dropEvt.source === dropEvt.target) return 'snapback'

    if (!tryMove(dropEvt.source, dropEvt.target)) {
        board.clearCircles()
        selectedSquare = null
        return 'snapback'
    }
}

// ---------- clic para mover ----------

function onMousedownSquare (evt) {
    if (game.game_over() || game.turn() !== playerColor) return
    const sq = evt.square

    // ya hay una pieza seleccionada: ¿esta casilla es un destino legal?
    if (selectedSquare && selectedSquare !== sq) {
        const legal = game.moves({ square: selectedSquare, verbose: true })
        if (legal.some((m) => m.to === sq)) {
            tryMove(selectedSquare, sq)
            return
        }
    }

    // si no, seleccionar una pieza propia en esta casilla (o quitar la selección)
    const piece = game.get(sq)
    if (piece && piece.color === playerColor) {
        selectedSquare = sq
        showMovesFrom(sq)
    } else {
        selectedSquare = null
        board.clearCircles()
    }
}

function isWhitePiece (piece) { return /^w/.test(piece) }
function isBlackPiece (piece) { return /^b/.test(piece) }

// =====================================================
// BARRA DE EVALUACIÓN
// =====================================================

function updateEvalBar () {
    let cp = evalBlancas
    if (game.in_checkmate()) cp = game.turn() === 'w' ? -10000 : 10000
    else if (game.in_draw()) cp = 0
    // convertir centipeones a 0-100% (sigmoide)
    const pct = 100 / (1 + Math.exp(-cp / 400))
    evalWhiteEl.style.height = pct + '%'
}

// =====================================================
// ESTADO
// =====================================================

function updateStatus () {
    let statusHTML = ''
    const whosTurn = game.turn() === 'w' ? 'Blancas' : 'Negras'

    if (!game.game_over()) {
        if (game.in_check()) statusHTML = '¡' + whosTurn + ' en jaque! '
        statusHTML = statusHTML + 'Juegan ' + whosTurn.toLowerCase() + '.'
    } else if (game.in_checkmate()) {
        statusHTML = 'Fin: jaque mate. ¡Ganan las ' + (game.turn() === 'w' ? 'negras' : 'blancas') + '!'
    } else if (game.in_stalemate()) {
        statusHTML = 'Tablas por rey ahogado.'
    } else if (game.in_threefold_repetition()) {
        statusHTML = 'Tablas por triple repetición.'
    } else if (game.insufficient_material()) {
        statusHTML = 'Tablas por material insuficiente.'
    } else if (game.in_draw()) {
        statusHTML = 'Tablas por la regla de las 50 jugadas.'
    }

    statusEl.innerHTML = statusHTML
    fenEl.innerHTML = game.fen()
    pgnEl.innerHTML = game.pgn()
    updateEvalBar()
}

// =====================================================
// NUEVA PARTIDA
// =====================================================

function nuevaPartida () {
    game.reset()
    selectedSquare = null
    evalBlancas = 0
    board.clearCircles()
    board.fen(game.fen())
    jugadaBotEl.innerHTML = 'Esperando tu jugada...'
    razonesEl.innerHTML = ''
    tutorRetroEl.textContent = ''
    updateStatus()
    actualizarTutor()
    if (game.turn() !== playerColor) setTimeout(botMove, 300)
}

byID('btnNueva').addEventListener('click', nuevaPartida)

function byID (id) {
    return document.getElementById(id)
}

// se ejecuta una vez que todo lo anterior está definido
updateStatus()
actualizarTutor()
if (game.turn() !== playerColor) setTimeout(botMove, 300) // si el bot juega con blancas, empieza él
