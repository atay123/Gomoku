export const BOARD_SIZE = 15;

// 行列方向（适配 game.js 的 {r,c} 写法）
export const LINE_DIRS = [
  { r: 0, c: 1 },
  { r: 1, c: 0 },
  { r: 1, c: 1 },
  { r: 1, c: -1 }
];

// 行列增量（适配 ai.js 的 {dr,dc} 写法）
export const DELTA_DIRS = [
  { dr: 0, dc: 1 },
  { dr: 1, dc: 0 },
  { dr: 1, dc: 1 },
  { dr: 1, dc: -1 }
];

export const inBounds = (r, c) => r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE;

// 纯函数：根据给定棋盘返回候选落点
export const getPossibleMovesFor = (b) => {
  const moves = [];
  const hasPiece = (r, c) => r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE && b[r][c];

  // 棋盘为空时，从中心开局
  if (b.every(row => row.every(cell => !cell))) {
    return [{ row: Math.floor(BOARD_SIZE / 2), col: Math.floor(BOARD_SIZE / 2) }];
  }

  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      if (b[r][c]) continue; // Skip occupied cells
      if (
        hasPiece(r - 1, c - 1) || hasPiece(r - 1, c) || hasPiece(r - 1, c + 1) ||
        hasPiece(r, c - 1)     || hasPiece(r, c + 1)     ||
        hasPiece(r + 1, c - 1) || hasPiece(r + 1, c) || hasPiece(r + 1, c + 1)
      ) {
        moves.push({ row: r, col: c });
      }
    }
  }

  if (moves.length === 0) {
    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE; c++) {
        if (!b[r][c]) moves.push({ row: r, col: c });
      }
    }
  }
  return moves;
};
