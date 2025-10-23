import { BOARD_SIZE, DELTA_DIRS as directions, inBounds, getPossibleMovesFor } from './utils.js';

const deepCopyBoard = (board) => board.map(arr => arr.slice());
const opponentOf = (color) => (color === 'white' ? 'black' : 'white');

// 方向与边界检查由 utils 提供

const countDir = (b, row, col, dr, dc, color) => {
    let r = row + dr, c = col + dc, count = 0;
    while (inBounds(r, c) && b[r][c] === color) { count++; r += dr; c += dc; }
    const open = inBounds(r, c) && b[r][c] === null;
    return { count, open };
};

const isWinningMove = (b, row, col, color) => {
    if (b[row][col]) return false;
    for (const d of directions) {
        const a = countDir(b, row, col, d.dr, d.dc, color);
        const bdir = countDir(b, row, col, -d.dr, -d.dc, color);
        if (a.count + bdir.count + 1 >= 5) return true;
    }
    return false;
};

const evaluateMove = (b, row, col, color) => {
    let score = 0;
    for (const d of directions) {
        const a = countDir(b, row, col, d.dr, d.dc, color);
        const bdir = countDir(b, row, col, -d.dr, -d.dc, color);
        const total = a.count + bdir.count + 1;
        const openEnds = (a.open ? 1 : 0) + (bdir.open ? 1 : 0);
        if (total >= 5) score += 100000;
        else if (total === 4) score += openEnds === 2 ? 10000 : 5000;
        else if (total === 3) score += openEnds === 2 ? 800 : (openEnds === 1 ? 200 : 0);
        else if (total === 2) score += openEnds === 2 ? 50 : (openEnds === 1 ? 10 : 0);
        else score += total;
    }
    return score;
};

const evaluateBoardFor = (board, player) => {
    return evaluateLines(board, player) - evaluateLines(board, opponentOf(player));
};

const evaluateLines = (board, player) => {
    let score = 0;
    const lines = [];

    for (let i = 0; i < BOARD_SIZE; i++) {
        const row = [];
        const col = [];
        for (let j = 0; j < BOARD_SIZE; j++) {
            row.push(board[i][j]);
            col.push(board[j][i]);
        }
        lines.push(row, col);
    }

    for (let i = 0; i < BOARD_SIZE * 2 - 1; i++) {
        const diag1 = [];
        const diag2 = [];
        for (let j = 0; j <= i; j++) {
            const r1 = i - j;
            const c1 = j;
            const r2 = BOARD_SIZE - 1 - (i - j);
            const c2 = j;
            if (r1 < BOARD_SIZE && c1 < BOARD_SIZE) diag1.push(board[r1][c1]);
            if (r2 >= 0 && c2 < BOARD_SIZE) diag2.push(board[r2][c2]);
        }
        lines.push(diag1, diag2);
    }

    for (const line of lines) {
        score += evaluateLine(line, player);
    }
    return score;
};

const evaluateLine = (line, player) => {
    let score = 0;
    for (let i = 0; i <= line.length - 5; i++) {
        const segment = line.slice(i, i + 5);
        score += scoreSegment(segment, player);
    }
    return score;
};

const scoreSegment = (segment, player) => {
    const opponent = opponentOf(player);
    const playerCount = segment.filter(p => p === player).length;
    const emptyCount = segment.filter(p => p === null).length;
    const opponentCount = 5 - playerCount - emptyCount;

    if (playerCount === 5) return 100000;
    if (opponentCount === 4 && emptyCount === 1) return -50000; // 对手冲四，需强堵
    if (playerCount === 4 && emptyCount === 1) return 5000;     // 我方冲四

    if (opponentCount === 3 && emptyCount === 2) return -1000;  // 对手活三
    if (playerCount === 3 && emptyCount === 2) return 500;      // 我方活三

    if (playerCount === 2 && emptyCount === 3) return 50;       // 我方活二
    if (opponentCount === 2 && emptyCount === 3) return -100;   // 对手活二

    return playerCount; // 其他情况给基础分
};
// 简单置换表缓存（按局面+深度+轮次）
const TT = new Map();
const boardKey = (board, depth, isMax) => {
    let s = depth + (isMax ? 'M' : 'm') + ':';
    for (let r = 0; r < board.length; r++) {
        for (let c = 0; c < board[r].length; c++) {
            const v = board[r][c];
            s += v ? (v === 'black' ? 'b' : 'w') : '_';
        }
        s += '|';
    }
    return s;
};

const orderMoves = (board, moves, maxColor, isMaximizing) => {
    const me = isMaximizing ? maxColor : opponentOf(maxColor);
    const opp = opponentOf(me);
    return moves
        .map(m => {
            const attack = evaluateMove(board, m.row, m.col, me);
            const defend = evaluateMove(board, m.row, m.col, opp) * 1.1;
            return { m, s: attack + defend };
        })
        .sort((a, b) => b.s - a.s)
        .map(x => x.m);
};

const alphaBeta = (board, depth, alpha, beta, isMaximizing, maxColor) => {
    const evalScore = evaluateBoardFor(board, maxColor);
    if (depth === 0 || Math.abs(evalScore) >= 100000) {
        return evalScore;
    }

    const key = boardKey(board, depth, isMaximizing);
    const hit = TT.get(key);
    if (hit !== undefined) return hit;

    const moves = getPossibleMovesFor(board);
    const ordered = orderMoves(board, moves, maxColor, isMaximizing);
    const limited = ordered.slice(0, 12); // 限制前 12 个候选

    if (isMaximizing) {
        let best = -Infinity;
        for (const m of limited) {
            const newBoard = deepCopyBoard(board);
            newBoard[m.row][m.col] = maxColor;
            best = Math.max(best, alphaBeta(newBoard, depth - 1, alpha, beta, false, maxColor));
            alpha = Math.max(alpha, best);
            if (beta <= alpha) break;
        }
        TT.set(key, best);
        return best;
    } else {
        let best = Infinity;
        const opp = opponentOf(maxColor);
        for (const m of limited) {
            const newBoard = deepCopyBoard(board);
            newBoard[m.row][m.col] = opp;
            best = Math.min(best, alphaBeta(newBoard, depth - 1, alpha, beta, true, maxColor));
            beta = Math.min(beta, best);
            if (beta <= alpha) break;
        }
        TT.set(key, best);
        return best;
    }
};

export const findBestMoveOnBoard = (board, color) => {
    const moves = getPossibleMovesFor(board);
    if (!moves || moves.length === 0) return null;

    // 1) 立即取胜
    for (const m of moves) {
        if (isWinningMove(board, m.row, m.col, color)) return m;
    }
    // 2) 立即堵住对手的必胜点
    const opp = opponentOf(color);
    for (const m of moves) {
        if (isWinningMove(board, m.row, m.col, opp)) return m;
    }

    // 3) 搜索 + 启发式评分（攻防）
    let bestScore = -Infinity;
    let bestMove = moves[0];
    for (const m of moves) {
        const newBoard = deepCopyBoard(board);
        newBoard[m.row][m.col] = color;
        let score = alphaBeta(newBoard, 2, -Infinity, Infinity, false, color);
        score += evaluateMove(board, m.row, m.col, color);           // 进攻
        score += evaluateMove(board, m.row, m.col, opp) * 1.2;       // 防守稍加权重
        if (score > bestScore) {
            bestScore = score;
            bestMove = m;
        }
    }
    return bestMove;
};
// Worker/主线程均可复用：返回给定棋盘与执子方的最佳落点
