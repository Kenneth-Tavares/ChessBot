const game = new Chess()

const boardConfig = {
    showNotation: true,
    draggable: true,
    dropOffBoard: 'snapback',
    orientation: 'white',
    position: 'start',
    onDragStart,
    onDrop
}

const board = Chessboard2('myBoard', boardConfig);


const statusEl = byID('gameStatus')
const fenEl = byID('gameFEN')
const pgnEl = byID('gamePGN')

updateStatus()

function onDragStart (dragStartEvt) {
    //no picking pieces if game over
    if (game.game_over()) return false

    //only pick pieces for the side to move
    if (game.turn() === 'w' && !isWhitePiece(dragStartEvt.piece)) return false
    if (game.turn() === 'b' && !isBlackPiece(dragStartEvt.piece)) return false

    //what moves are available to from this square?
    const legalMoves = game.moves({
        square: dragStartEvt.square,
        verbose: true
    })

    //place circles on legal moves
    legalMoves.forEach((move) => {
        board.addCircle(move.to)
    })
}

function isWhitePiece (piece) { return /^w/.test(piece) }
function isBlackPiece (piece) { return /^b/.test(piece) }

function onDrop (dropEvt) {
    //see if move is legal
    const move = game.move({
        from: dropEvt.source,
        to: dropEvt.target,
        promotion: 'q' // NOTE: always promote to a queen for example simplicity
    })


    //remove all circles from the board
    board.clearCircles()

    //make the move if legal
    if (move) {
        //update board position with new game position
        board.fen(game.fen(), () => {
            updateStatus()
        })
    } else {
        return 'snapback'
    }  
}


// update the board position after the piece snap
// for castling, en passant, pawn promotion
// function onSnapEnd () {
//   board.position(game.fen())
// }

// update DOM elements with the current game status

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
}

function byID (id) {
    return document.getElementById(id)
}











