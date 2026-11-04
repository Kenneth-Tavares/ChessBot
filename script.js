const game = new Chess()

const playerColor = 'w'   // the human plays this colour; the bot plays the other
const BOT_DEPTH = 4       // search depth in plies (3 is instant, 4+ starts to lag)

let selectedSquare = null // square of the piece selected by clicking

const boardConfig = {
    showNotation: true,
    draggable: true,
    dropOffBoard: 'snapback',
    orientation: 'white',
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

// =====================================================
// EVALUATION
// =====================================================

const PIECE_VALUES = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 0 }

// returns centipawns from WHITE's point of view (+ = white is better)
function evaluate (g) {
    let score = 0
    const b = g.board() // 8x8 array, row 0 = rank 8
    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            const sq = b[r][c]
            if (!sq) continue
            let val = PIECE_VALUES[sq.type]
            // small bonus for being near the centre
            const centre = 3.5 - Math.max(Math.abs(r - 3.5), Math.abs(c - 3.5))
            if (sq.type !== 'k') val += centre * 5
            score += sq.color === 'w' ? val : -val
        }
    }
    return score
}

// =====================================================
// SEARCH (negamax + alpha-beta pruning)
// =====================================================

// returns a score from the point of view of the side to move
function search (depth, alpha, beta) {
    const moves = game.moves()

    // no legal moves: checkmate or stalemate
    if (moves.length === 0) {
        return game.in_check() ? -100000 - depth : 0   // faster mates score higher
    }
    if (game.insufficient_material()) return 0
    if (depth === 0) return (game.turn() === 'w' ? 1 : -1) * evaluate(game)

    for (const m of moves) {
        game.move(m)
        const score = -search(depth - 1, -beta, -alpha)
        game.undo()
        if (score >= beta) return beta   // prune
        if (score > alpha) alpha = score
    }
    return alpha
}

function shuffle (arr) {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]]
    }
    return arr
}

function findBestMove (depth) {
    let best = null
    let alpha = -Infinity
    // shuffled so equal-scoring moves vary between games
    for (const m of shuffle(game.moves())) {
        game.move(m)
        const score = -search(depth - 1, -Infinity, -alpha)
        game.undo()
        if (score > alpha) { alpha = score; best = m }
    }
    return best
}

function botMove () {
    if (game.game_over()) return
    const move = findBestMove(BOT_DEPTH)
    console.log('bot move:', move)
    if (!move) return
    game.move(move)
    board.fen(game.fen())
    updateStatus()
}

// =====================================================
// MOVING PIECES (shared by dragging and clicking)
// =====================================================

function tryMove (from, to) {
    const move = game.move({
        from,
        to,
        promotion: 'q' // NOTE: always promote to a queen for simplicity
    })

    board.clearCircles()
    selectedSquare = null

    if (!move) return false

    board.fen(game.fen())
    updateStatus()
    setTimeout(botMove, 250) // lets the UI repaint before the bot thinks
    return true
}

function showMovesFrom (square) {
    board.clearCircles()
    game.moves({ square, verbose: true }).forEach((m) => board.addCircle(m.to))
}

// ---------- drag and drop ----------

function onDragStart (dragStartEvt) {
    // no picking pieces if game over
    if (game.game_over()) return false

    // only the human's turn, and only the human's pieces
    if (game.turn() !== playerColor) return false
    if (playerColor === 'w' && !isWhitePiece(dragStartEvt.piece)) return false
    if (playerColor === 'b' && !isBlackPiece(dragStartEvt.piece)) return false

    // treat the dragged piece as the selected one and show its moves
    selectedSquare = dragStartEvt.square
    showMovesFrom(dragStartEvt.square)
}

function onDrop (dropEvt) {
    // dropped back on its own square: keep the selection, just snap back
    if (dropEvt.source === dropEvt.target) return 'snapback'

    if (!tryMove(dropEvt.source, dropEvt.target)) {
        board.clearCircles()
        selectedSquare = null
        return 'snapback'
    }
}

// ---------- click to move ----------

function onMousedownSquare (evt) {
    if (game.game_over() || game.turn() !== playerColor) return
    const sq = evt.square

    // a piece is already selected: is this square a legal target?
    if (selectedSquare && selectedSquare !== sq) {
        const legal = game.moves({ square: selectedSquare, verbose: true })
        if (legal.some((m) => m.to === sq)) {
            tryMove(selectedSquare, sq)
            return
        }
    }

    // otherwise select your own piece on this square (or deselect)
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
// EVAL BAR
// =====================================================

function updateEvalBar () {
    let cp = evaluate(game)
    if (game.in_checkmate()) cp = game.turn() === 'w' ? -10000 : 10000
    // squash centipawns into 0-100% (sigmoid)
    const pct = 100 / (1 + Math.exp(-cp / 400))
    evalWhiteEl.style.height = pct + '%'
}

// =====================================================
// STATUS
// =====================================================

function updateStatus () {
    let statusHTML = ''
    const whosTurn = game.turn() === 'w' ? 'White' : 'Black'

    if (!game.game_over()) {
        if (game.in_check()) statusHTML = whosTurn + ' is in check! '
        statusHTML = statusHTML + whosTurn + ' to move.'
    }   else if (game.in_checkmate() && game.turn() === 'w') {
        statusHTML = 'Game over: white is in checkmate. Black wins!'
    }   else if (game.in_checkmate() && game.turn() === 'b') {
        statusHTML = 'Game over: Black is in checkmate. White wins!'
    }   else if (game.in_stalemate() && game.turn() === 'w') {
        statusHTML = 'Game is drawn. White is stalemated.'
    }   else if (game.in_stalemate() && game.turn() === 'b') {
        statusHTML = 'Game is drawn. Black is stalemated.'
    }   else if (game.in_threefold_repetition()) {
        statusHTML = 'Game is drawn by threefold repetition rule.'
    }   else if (game.insufficient_material()) {
        statusHTML = 'Game is drawn by insufficient material.'
    }   else if (game.in_draw()) {
        statusHTML = 'Game is drawn by fifty-move rule.'
    }

    statusEl.innerHTML = statusHTML
    fenEl.innerHTML = game.fen()
    pgnEl.innerHTML = game.pgn()
    updateEvalBar()
}

function byID (id) {
    return document.getElementById(id)
}

// run once everything above is defined
updateStatus()