export const BOARD_SIZE = 15;
export let board = Array(BOARD_SIZE).fill(null).map(() => Array(BOARD_SIZE).fill(null));
export let currentPlayer = 'black'; // black starts
export let gameOver = false;
export let scores = { black: 0, white: 0 };
export let lastPieceElement = null;

export const getBoard = () => board;
export const getCurrentPlayer = () => currentPlayer;
export const isGameOver = () => gameOver;

export const placePiece = (row, col, player) => {
    if (gameOver || board[row][col]) {
        return null;
    }
    board[row][col] = player;
    const winningLine = checkWin(row, col, player);
    if (winningLine) {
        gameOver = true;
    }
    return winningLine;
}

export const togglePlayer = () => {
    currentPlayer = currentPlayer === 'black' ? 'white' : 'black';
}

export const resetGame = () => {
    board = Array(BOARD_SIZE).fill(null).map(() => Array(BOARD_SIZE).fill(null));
    currentPlayer = 'black';
    gameOver = false;
    lastPieceElement = null;
}

export const updateScore = (winner) => {
    scores[winner]++;
}

export const resetScore = () => {
    scores = { black: 0, white: 0 };
}

export const getScores = () => scores;

export const setLastPieceElement = (element) => {
    lastPieceElement = element;
}

export const getLastPieceElement = () => lastPieceElement;

const checkWin = (row, col, player) => {
    const directions = [
        { r: 0, c: 1 },  // Horizontal
        { r: 1, c: 0 },  // Vertical
        { r: 1, c: 1 },  // Diagonal \
        { r: 1, c: -1 }  // Diagonal /
    ];

    for (const dir of directions) {
        const line = [{ row, col }];
        let count = 1;

        // Check in the positive direction
        for (let i = 1; i < 5; i++) {
            const r = row + dir.r * i;
            const c = col + dir.c * i;
            if (r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE && board[r][c] === player) {
                line.push({ row: r, col: c });
                count++;
            } else {
                break;
            }
        }

        // Check in the negative direction
        for (let i = 1; i < 5; i++) {
            const r = row - dir.r * i;
            const c = col - dir.c * i;
            if (r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE && board[r][c] === player) {
                line.push({ row: r, col: c });
                count++;
            } else {
                break;
            }
        }

        if (count >= 5) {
            return line;
        }
    }
    return null;
};

export const getPossibleMoves = (b = board) => {
    const moves = [];
    const hasPiece = (r, c) => r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE && b[r][c];

    // 棋盘为空时，从中心开局
    if (b.every(row => row.every(cell => !cell))) {
        return [{ row: Math.floor(BOARD_SIZE / 2), col: Math.floor(BOARD_SIZE / 2) }];
    }

    for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
            if (b[r][c]) continue; // Skip occupied cells

            // 仅允许围绕已有棋子的一圈位置作为候选，缩小搜索空间
            if (hasPiece(r - 1, c - 1) || hasPiece(r - 1, c) || hasPiece(r - 1, c + 1) ||
                hasPiece(r, c - 1)     || hasPiece(r, c + 1)     ||
                hasPiece(r + 1, c - 1) || hasPiece(r + 1, c) || hasPiece(r + 1, c + 1)) {
                moves.push({ row: r, col: c });
            }
        }
    }

    // 保险：如果没有候选（极少见），退回到所有空位
    if (moves.length === 0) {
        for (let r = 0; r < BOARD_SIZE; r++) {
            for (let c = 0; c < BOARD_SIZE; c++) {
                if (!b[r][c]) moves.push({ row: r, col: c });
            }
        }
    }

    return moves;
}