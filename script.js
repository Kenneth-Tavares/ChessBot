// 1. Initialize chess rules engine and board UI
const game = new Chess();
const statusEl = document.getElementById('status');

const board = Chessboard2('myBoard', {
  draggable: true,
  position: 'start',
  onDrop: handleMove
});

// 2. Handle Player Move
function handleMove(change) {
  // Attempt move in legal logic engine
  const move = game.move({
    from: change.source,
    to: change.target,
    promotion: 'q' // Default to queen promotion
  });

  // If move was illegal according to chess.js, snap piece back
  if (move === null) return 'snapback';

  updateStatus();

  // Make bot move after a short delay (250ms)
  if (!game.game_over()) {
    window.setTimeout(makeBotMove, 250);
  }
}

// 3. Simple Random-Move Bot Logic
function makeBotMove() {
  const possibleMoves = game.moves();

  // Exit if no legal moves left
  if (possibleMoves.length === 0) return;

  // Pick a random legal move
  const randomIdx = Math.floor(Math.random() * possibleMoves.length);
  game.move(possibleMoves[randomIdx]);

  // Update board visual representation
  board.position(game.fen());
  updateStatus();
}

// 4. Update Game Status Text
function updateStatus() {
  let status = '';
  let moveColor = game.turn() === 'w' ? 'White' : 'Black';

  if (game.in_checkmate()) {
    status = `Game over, ${moveColor} is in checkmate.`;
  } else if (game.in_draw()) {
    status = 'Game over, drawn position.';
  } else {
    status = `${moveColor} to move`;
    if (game.in_check()) {
      status += `, ${moveColor} is in check`;
    }
  }

  statusEl.textContent = status;
}