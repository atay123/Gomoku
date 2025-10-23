// Web Worker：异步计算最佳落点
import { findBestMoveOnBoard } from './ai.js';

self.onmessage = (e) => {
  const { board, player, reqId } = e.data || {};
  try {
    const move = findBestMoveOnBoard(board, player);
    self.postMessage({ reqId, move });
  } catch (err) {
    self.postMessage({ reqId, error: err?.message || String(err) });
  }
};

