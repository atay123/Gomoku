import { 
    getBoard, getCurrentPlayer, isGameOver, placePiece, togglePlayer, 
    resetGame as resetGameState, updateScore, resetScore as resetScoreState, getScores, 
    getPossibleMoves
} from './game.js';
import { BOARD_SIZE } from './utils.js';

document.addEventListener('DOMContentLoaded', () => {
    const isMobile = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);
    // 初始化 AI Worker
    let reqSeq = 0;
    const aiWorker = new Worker(new URL('./ai.worker.js', import.meta.url), { type: 'module' });
    const pending = new Map();
    aiWorker.onmessage = (e) => {
        const { reqId, move, error } = e.data || {};
        const resolver = pending.get(reqId);
        if (!resolver) return;
        pending.delete(reqId);
        if (error) resolver.reject(new Error(error));
        else resolver.resolve(move);
    };

    const computeBestMoveAsync = (board, player) => {
        return new Promise((resolve, reject) => {
            const reqId = ++reqSeq;
            pending.set(reqId, { resolve, reject });
            aiWorker.postMessage({ board, player, reqId });
        });
    };
    const boardElement = document.getElementById('board');
    const statusElement = document.getElementById('status-area');
    const statusElementMobile = document.getElementById('status-area-mobile');
    const scoreElement = document.getElementById('score-area');
    const scoreElementMobile = document.getElementById('score-area-mobile');
    const resetButton = document.getElementById('reset-button');
    const aiButton = document.getElementById('ai-button');
    const hintButton = document.getElementById('hint-button');
    const resetScoreButton = document.getElementById('reset-score-button');
    const modalOverlay = document.getElementById('modal-overlay');
    const winMessage = document.getElementById('win-message');
    const winModal = document.getElementById('win-modal');
    const playAgainButton = document.getElementById('play-again-button');
    const confirmResetModal = document.getElementById('confirm-reset-modal');
    const confirmResetButton = document.getElementById('confirm-reset-button');
    const cancelResetButton = document.getElementById('cancel-reset-button');
    const cancelWinButton = document.getElementById('cancel-win-button');
    const toggleThemeButton = document.getElementById('toggle-theme-button');
    const muteButton = document.getElementById('mute-button');
    const toggleThemeButtonMobile = document.getElementById('toggle-theme-button-mobile');
    const muteButtonMobile = document.getElementById('mute-button-mobile');

    // Audio elements
    const placeSound = document.getElementById('place-sound');
    const winSound = document.getElementById('win-sound');
    const resetSound = document.getElementById('reset-sound');
    const hintSound = document.getElementById('hint-sound');
    const resetScoreSound = document.getElementById('reset-score-sound');

    let aiMode = false;


    const renderBoard = () => {
        boardElement.innerHTML = '';
        const board = getBoard();
        for (let row = 0; row < BOARD_SIZE; row++) {
            for (let col = 0; col < BOARD_SIZE; col++) {
                const intersection = document.createElement('div');
                intersection.classList.add('intersection');
                intersection.dataset.row = row;
                intersection.dataset.col = col;
                intersection.setAttribute('role', 'button');
                intersection.setAttribute('tabindex', '0');
                if (board[row][col]) {
                    const pieceElement = document.createElement('div');
                    pieceElement.classList.add('piece', board[row][col]);
                    intersection.appendChild(pieceElement);
                }
                boardElement.appendChild(intersection);
            }
        }
    };

    const handlePlayerMove = (row, col) => {
        if (isGameOver()) return;

        const boardState = getBoard();
        // 已占交叉点：忽略点击，不播放音效、不切换玩家
        if (boardState[row][col]) {
            return;
        }

        const currentPlayer = getCurrentPlayer();
        const winningLine = placePiece(row, col, currentPlayer);
        
        playSound(placeSound);
        renderBoard();

        const newPieceElement = boardElement.querySelector(`[data-row='${row}'][data-col='${col}']`).firstChild;
        const prevHighlighted = boardElement.querySelector('.piece.new-piece');
        if (prevHighlighted) prevHighlighted.classList.remove('new-piece');
        if (newPieceElement) newPieceElement.classList.add('new-piece');

        if (winningLine) {
            handleWin(currentPlayer, winningLine);
        } else {
            togglePlayer();
            updateStatus();
            if (aiMode && getCurrentPlayer() === 'white') {
                setTimeout(handleAIMove, 500);
            }
        }
    };

    const handleAIMove = async () => {
        try {
            const bestMove = await computeBestMoveAsync(getBoard(), 'white');
            if (bestMove) handlePlayerMove(bestMove.row, bestMove.col);
        } catch (e) {
            // 兜底：忽略错误，由玩家继续
            console.error('AI worker error:', e);
        }
    };

    const handleWin = (player, winningLine) => {
        playSound(winSound);
        updateScore(player);
        updateScoreDisplay();

        for (const piece of winningLine) {
            const pieceElement = boardElement.querySelector(`[data-row='${piece.row}'][data-col='${piece.col}']`).firstChild;
            if (pieceElement) {
                pieceElement.classList.add('winning-piece');
            }
        }

        setTimeout(() => {
            showWinModal(player);
        }, 1500);
    };

    const setBoardInteractive = (enabled) => {
        if (enabled) {
            boardElement.classList.remove('board-disabled');
        } else {
            boardElement.classList.add('board-disabled');
        }
    };

    const updateStatus = () => {
        const player = getCurrentPlayer();
        const text = aiMode && player === 'white' ? 'AI思考中…' : `轮到 ${player === 'black' ? '黑子' : '白子'}`;
        statusElement.textContent = text;
        if (statusElementMobile) statusElementMobile.textContent = text;
        if (aiMode && player === 'white') {
            setBoardInteractive(false);
        } else {
            setBoardInteractive(true);
        }
    };

    const updateScoreDisplay = () => {
        const scores = getScores();
        const text = `黑子: ${scores.black} | 白子: ${scores.white}`;
        scoreElement.textContent = text;
        if (scoreElementMobile) scoreElementMobile.textContent = text;
    };

    const resetGame = () => {
        playSound(resetSound);
        hideModals();
        resetGameState();
        renderBoard();
        updateStatus();
    };

    const resetScore = () => {
        playSound(resetScoreSound);
        resetScoreState();
        updateScoreDisplay();
    };

    const showWinModal = (winner) => {
        winMessage.textContent = `${winner === 'black' ? '黑子' : '白子'} 胜利!`;
        confirmResetModal.style.display = 'none';
        winModal.style.display = 'block';
        modalOverlay.style.display = 'flex';
    };

    const showConfirmResetModal = () => {
        winModal.style.display = 'none';
        confirmResetModal.style.display = 'block';
        modalOverlay.style.display = 'flex';
    };

    const hideModals = () => {
        modalOverlay.style.display = 'none';
    };

    const showHint = async () => {
        if (isGameOver()) return;
        playSound(hintSound);

        const player = getCurrentPlayer();
        // 使用 Worker 计算最佳落点，仅高亮不修改棋盘
        let move = null;
        try {
            move = await computeBestMoveAsync(getBoard(), player);
        } catch {}

        // 兜底：如果AI未返回结果，回退到可落子列表的第一个
        if (!move) {
            const moves = getPossibleMoves();
            if (moves && moves.length > 0) move = moves[0];
        }

        if (move) {
            const hintElement = boardElement.querySelector(`[data-row='${move.row}'][data-col='${move.col}']`);
            if (hintElement) {
                hintElement.classList.add('hint');
                setTimeout(() => {
                    hintElement.classList.remove('hint');
                }, 600);
            }
        }
    };

    boardElement.addEventListener('click', (event) => {
        // 禁用 AI 回合点击（白方为AI）
        if (aiMode && getCurrentPlayer() === 'white') {
            return;
        }
        const target = event.target;
        if (target.classList.contains('intersection')) {
            const row = parseInt(target.dataset.row, 10);
            const col = parseInt(target.dataset.col, 10);
            handlePlayerMove(row, col);
        }
    });

    // 键盘可访问性：回车或空格在焦点格子落子
    boardElement.addEventListener('keydown', (event) => {
        if (aiMode && getCurrentPlayer() === 'white') return;
        const target = event.target;
        if (!target.classList || !target.classList.contains('intersection')) return;
        if (event.key === 'Enter' || event.key === ' ' || event.key === 'Spacebar') {
            const row = parseInt(target.dataset.row, 10);
            const col = parseInt(target.dataset.col, 10);
            handlePlayerMove(row, col);
            event.preventDefault();
        }
    });

    resetButton.addEventListener('click', resetGame);
    resetScoreButton.addEventListener('click', showConfirmResetModal);

    aiButton.addEventListener('click', () => {
        aiMode = !aiMode;
        aiButton.textContent = aiMode ? '双人对战' : '人机对战';
        resetGame();
    });

    hintButton.addEventListener('click', showHint);

    playAgainButton.addEventListener('click', () => {
        hideModals();
        resetGame();
    });

    confirmResetButton.addEventListener('click', () => {
        resetScore();
        hideModals();
    });

    cancelResetButton.addEventListener('click', () => {
        hideModals();
    });

    cancelWinButton.addEventListener('click', () => {
        hideModals();
    });

    // --- Theme and Mute Logic ---
    let isMuted = false;

    const setMuteIconFor = (btn) => {
        if (!btn) return;
        const onIcon = btn.querySelector('.icon-sound-on');
        const offIcon = btn.querySelector('.icon-sound-off');
        if (!onIcon || !offIcon) return;
        if (isMuted) {
            onIcon.style.display = 'none';
            offIcon.style.display = '';
            btn.setAttribute('title', '取消静音');
            btn.setAttribute('aria-label', '取消静音');
        } else {
            onIcon.style.display = '';
            offIcon.style.display = 'none';
            btn.setAttribute('title', '静音');
            btn.setAttribute('aria-label', '静音');
        }
    };
    const setMuteIcon = () => { setMuteIconFor(muteButton); setMuteIconFor(muteButtonMobile); };

    const setThemeIconFor = (btn) => {
        if (!btn) return;
        const sun = btn.querySelector('.icon-sun');
        const moon = btn.querySelector('.icon-moon');
        const isDark = document.body.classList.contains('dark-theme');
        if (!sun || !moon) return;
        if (isDark) {
            sun.style.display = 'none';
            moon.style.display = '';
            btn.setAttribute('title', '切换为亮色');
            btn.setAttribute('aria-label', '切换为亮色');
        } else {
            sun.style.display = '';
            moon.style.display = 'none';
            btn.setAttribute('title', '切换为暗色');
            btn.setAttribute('aria-label', '切换为暗色');
        }
    };
    const setThemeIcon = () => { setThemeIconFor(toggleThemeButton); setThemeIconFor(toggleThemeButtonMobile); };

    const playSound = (sound) => {
        if (isMuted) return;
        sound.currentTime = 0;
        sound.play().catch(error => console.error("Audio playback failed:", error));
    };

    const onToggleTheme = () => {
        document.body.classList.toggle('dark-theme');
        const isDark = document.body.classList.contains('dark-theme');
        localStorage.setItem('theme', isDark ? 'dark' : 'light');
        setThemeIcon();
    };
    toggleThemeButton?.addEventListener('click', onToggleTheme);
    toggleThemeButtonMobile?.addEventListener('click', onToggleTheme);

    const onToggleMute = () => {
        isMuted = !isMuted;
        localStorage.setItem('muted', isMuted);
        setMuteIcon();
    };
    muteButton?.addEventListener('click', onToggleMute);
    muteButtonMobile?.addEventListener('click', onToggleMute);

    const loadPreferences = () => {
        const savedTheme = localStorage.getItem('theme');
        if (savedTheme === 'dark') {
            document.body.classList.add('dark-theme');
        }
        setThemeIcon();

        const savedMuted = localStorage.getItem('muted');
        if (savedMuted === 'true') {
            isMuted = true;
        }
        setMuteIcon();
    };

    loadPreferences();

    // 移动端仅限制棋盘区域的滚动/回弹
    if (isMobile) {
        boardElement.addEventListener('touchmove', (e) => {
            e.preventDefault();
        }, { passive: false });
        boardElement.style.touchAction = 'none';
    }

    // Initial setup
    renderBoard();
    updateStatus();
    updateScoreDisplay();
});
