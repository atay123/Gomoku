import { BOARD_SIZE, LINE_DIRS, getPossibleMovesFor } from './utils.js';

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
    for (const dir of LINE_DIRS) {
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
    return getPossibleMovesFor(b);
}

// 非落子结束对局（如超时认负）
export const forceGameOver = () => { gameOver = true; };
