import { 
    getBoard, getCurrentPlayer, isGameOver, placePiece, togglePlayer, 
    resetGame as resetGameState, updateScore, resetScore as resetScoreState, getScores, 
    getPossibleMoves, forceGameOver
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
    const boardCanvas = document.getElementById('board-canvas');
    const stonesCanvas = document.getElementById('stones-canvas');
    const gctx = boardCanvas.getContext('2d');
    const sctx = stonesCanvas.getContext('2d');
    const statusElement = document.getElementById('status-area');
    const statusElementMobile = document.getElementById('status-area-mobile');
    const scoreElement = document.getElementById('score-area');
    const scoreElementMobile = document.getElementById('score-area-mobile');
    // 记分板（桌面/移动端）
    const scoreDigitsDesktop = document.getElementById('score-digits-desktop');
    const scoreDigitsMobile = document.getElementById('score-digits-mobile');
    const playerBlackDesktop = document.getElementById('player-black-desktop');
    const playerWhiteDesktop = document.getElementById('player-white-desktop');
    const playerBlackMobile = document.getElementById('player-black-mobile');
    const playerWhiteMobile = document.getElementById('player-white-mobile');
    const timerBlackDesktop = document.getElementById('timer-black');
    const timerWhiteDesktop = document.getElementById('timer-white');
    const timerBlackMobile = document.getElementById('timer-black-mobile');
    const timerWhiteMobile = document.getElementById('timer-white-mobile');
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
    const timerSound = document.getElementById('timer-sound');

    let aiMode = false;
    // 计时（每方 40 秒）
    const INITIAL_SECONDS = 40;
    let timeBlack = INITIAL_SECONDS;
    let timeWhite = INITIAL_SECONDS;
    let tickHandle = null;
    let tickingPlayer = 'black';


    // Canvas 渲染参数
    const geom = { dpr: 1, w: 0, h: 0, cell: 0, pad: 0 };

    const setCanvasSize = () => {
        const rect = boardElement.getBoundingClientRect();
        const size = Math.min(rect.width, rect.height);
        const dpr = Math.max(1, window.devicePixelRatio || 1);
        [boardCanvas, stonesCanvas].forEach(c => {
            c.width = Math.round(size * dpr);
            c.height = Math.round(size * dpr);
            c.style.width = `${size}px`;
            c.style.height = `${size}px`;
        });
        gctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        sctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        geom.dpr = dpr; geom.w = size; geom.h = size;
        const spaces = BOARD_SIZE - 1;
        geom.cell = size / (spaces + 2);
        geom.pad = geom.cell; // 边缘留整格，所有格子等宽
    };

    const drawGrid = () => {
        const { w, h, cell, pad } = geom;
        gctx.clearRect(0, 0, w, h);
        // 背景由 CSS 提供，这里只画网格
        gctx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue('--line-color') || '#bbb';
        gctx.lineWidth = 1;
        gctx.beginPath();
        for (let i = 0; i < BOARD_SIZE; i++) {
            const x = pad + i * cell;
            gctx.moveTo(x, pad);
            gctx.lineTo(x, h - pad);
            const y = pad + i * cell;
            gctx.moveTo(pad, y);
            gctx.lineTo(w - pad, y);
        }
        gctx.stroke();
        // 星位
        const starsIdx = [3, 7, 11];
        const starR = Math.max(2, Math.min(4, cell * 0.08));
        gctx.fillStyle = '#666';
        const points = [
            { r: 3, c: 3 }, { r: 3, c: 11 }, { r: 7, c: 7 }, { r: 11, c: 3 }, { r: 11, c: 11 }
        ];
        points.forEach(p => {
            const x = pad + p.c * cell; const y = pad + p.r * cell;
            gctx.beginPath();
            gctx.arc(x, y, starR, 0, Math.PI * 2);
            gctx.fill();
        });
        // 边框
        gctx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue('--board-border-color') || '#ccc';
        gctx.strokeRect(0.5, 0.5, w - 1, h - 1);
    };

    // 当前高亮、提示
    let lastMove = null; // {row,col}
    let hintMove = null; // {row,col}
    let winningLinePositions = null; // Array<{row,col}>

    const drawStones = () => {
        const { w, h, cell, pad } = geom;
        sctx.clearRect(0, 0, w, h);
        const board = getBoard();
        for (let r = 0; r < BOARD_SIZE; r++) {
            for (let c = 0; c < BOARD_SIZE; c++) {
                const color = board[r][c];
                if (!color) continue;
                const x = pad + c * cell, y = pad + r * cell;
                const radius = cell * 0.42;

                // 轻微地面的阴影
                sctx.save();
                sctx.globalAlpha = 0.18;
                sctx.fillStyle = '#000';
                sctx.beginPath();
                sctx.ellipse(x, y + radius * 0.12, radius * 0.84, radius * 0.62, 0, 0, Math.PI * 2);
                sctx.fill();
                sctx.restore();

                // 棋子主体的径向渐变，高光中心稍微偏左上
                const cx = x - radius * 0.35;
                const cy = y - radius * 0.35;
                const grad = sctx.createRadialGradient(cx, cy, radius * 0.1, x, y, radius);

                if (color === 'black') {
                    grad.addColorStop(0, '#6b6b6b');
                    grad.addColorStop(0.6, '#2e2e2e');
                    grad.addColorStop(1, '#0f0f0f');
                    sctx.fillStyle = grad;
                    sctx.beginPath();
                    sctx.arc(x, y, radius, 0, Math.PI * 2);
                    sctx.fill();
                } else {
                    const whiteBase = getComputedStyle(document.documentElement).getPropertyValue('--white-piece-bg') || '#ffffff';
                    const border = getComputedStyle(document.documentElement).getPropertyValue('--white-piece-border') || '#dcdcdc';
                    grad.addColorStop(0, '#ffffff');
                    grad.addColorStop(0.6, whiteBase.trim() || '#f7f7f7');
                    grad.addColorStop(1, '#d6d6d6');
                    sctx.fillStyle = grad;
                    sctx.beginPath();
                    sctx.arc(x, y, radius, 0, Math.PI * 2);
                    sctx.fill();
                    sctx.lineWidth = 1;
                    sctx.strokeStyle = border;
                    sctx.stroke();
                }

                // 轻微的镜面高光
                sctx.save();
                sctx.globalAlpha = 0.25;
                const glow = sctx.createRadialGradient(cx, cy, 0, cx, cy, radius * 0.6);
                glow.addColorStop(0, 'rgba(255,255,255,0.9)');
                glow.addColorStop(1, 'rgba(255,255,255,0)');
                sctx.fillStyle = glow;
                sctx.beginPath();
                sctx.arc(x, y, radius, 0, Math.PI * 2);
                sctx.fill();
                sctx.restore();
            }
        }
        // 最后一步高亮
        if (lastMove) {
            const x = pad + lastMove.col * cell, y = pad + lastMove.row * cell;
            sctx.beginPath();
            sctx.arc(x, y, cell * 0.5, 0, Math.PI * 2);
            sctx.lineWidth = 2;
            sctx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue('--hint-border-color') || '#0a84ff';
            sctx.stroke();
        }
        // 提示高亮
        if (hintMove) {
            const x = pad + hintMove.col * cell, y = pad + hintMove.row * cell;
            sctx.beginPath();
            sctx.arc(x, y, cell * 0.5, 0, Math.PI * 2);
            sctx.setLineDash([4, 4]);
            sctx.lineWidth = 2;
            sctx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue('--hint-border-color') || '#0a84ff';
            sctx.stroke();
            sctx.setLineDash([]);
        }
        // 胜利连线高亮
        if (winningLinePositions && winningLinePositions.length) {
            sctx.lineWidth = 3;
            sctx.strokeStyle = '#3ddc97';
            winningLinePositions.forEach(p => {
                const x = pad + p.col * cell, y = pad + p.row * cell;
                sctx.beginPath();
                sctx.arc(x, y, cell * 0.55, 0, Math.PI * 2);
                sctx.stroke();
            });
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
        lastMove = { row, col };
        drawStones();

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

    const stopTimer = () => { if (tickHandle) { clearInterval(tickHandle); tickHandle = null; } };
    const formatTime = (s) => {
        const m = Math.floor(s / 60).toString().padStart(2, '0');
        const ss = (s % 60).toString().padStart(2, '0');
        return `${m}:${ss}`;
    };
    const setRingVars = (container, remaining) => {
        if (!container) return;
        const avatar = container.querySelector('.avatar');
        if (!avatar) return;
        const deg = Math.max(0, Math.round((remaining / INITIAL_SECONDS) * 360));
        const warnThreshold = Math.max(8, Math.floor(INITIAL_SECONDS * 0.25));
        const color = remaining <= warnThreshold ? '#ff3b30' : getComputedStyle(document.documentElement).getPropertyValue('--button-bg-color') || '#0a84ff';
        avatar.style.setProperty('--pdeg', `${deg}deg`);
        avatar.style.setProperty('--ring-color', color.trim());
    };

    const updateTimerDisplays = () => {
        const tb = formatTime(timeBlack);
        const tw = formatTime(timeWhite);
        if (timerBlackDesktop) timerBlackDesktop.textContent = tb;
        if (timerWhiteDesktop) timerWhiteDesktop.textContent = tw;
        if (timerBlackMobile) timerBlackMobile.textContent = tb;
        if (timerWhiteMobile) timerWhiteMobile.textContent = tw;

        setRingVars(playerBlackDesktop, timeBlack);
        setRingVars(playerBlackMobile, timeBlack);
        setRingVars(playerWhiteDesktop, timeWhite);
        setRingVars(playerWhiteMobile, timeWhite);
    };
    const startTimerFor = (player) => {
        stopTimer();
        tickingPlayer = player;
        if (player === 'black') timeBlack = INITIAL_SECONDS; else timeWhite = INITIAL_SECONDS;
        tickHandle = setInterval(() => {
            if (player === 'black') timeBlack = Math.max(0, timeBlack - 1); else timeWhite = Math.max(0, timeWhite - 1);
            updateTimerDisplays();
            const remaining = player === 'black' ? timeBlack : timeWhite;
            if (remaining > 0 && remaining <= 5) {
                playSound(timerSound);
            }
            if ((player === 'black' && timeBlack <= 0) || (player === 'white' && timeWhite <= 0)) {
                stopTimer();
                forceGameOver();
                const winner = player === 'black' ? 'white' : 'black';
                handleWinByTimeout(winner);
            }
        }, 1000);
    };
    const addPulse = (container) => {
        if (!container) return;
        const av = container.querySelector('.avatar');
        if (!av) return;
        av.classList.remove('pulse');
        // 强制重绘以重启动画
        // eslint-disable-next-line no-unused-expressions
        av.offsetWidth;
        av.classList.add('pulse');
        setTimeout(() => av.classList.remove('pulse'), 320);
    };
    const setActivePlayerVisual = (player) => {
        const active = 'active';
        [playerBlackDesktop, playerBlackMobile].forEach(el => el?.classList.toggle(active, player === 'black'));
        [playerWhiteDesktop, playerWhiteMobile].forEach(el => el?.classList.toggle(active, player === 'white'));
        if (player === 'black') { addPulse(playerBlackDesktop); addPulse(playerBlackMobile); }
        else { addPulse(playerWhiteDesktop); addPulse(playerWhiteMobile); }
    };

    const handleWin = (player, winningLine) => {
        playSound(winSound);
        updateScore(player);
        updateScoreDisplay();
        stopTimer();
        winningLinePositions = winningLine || null;
        drawStones();

        setTimeout(() => {
            showWinModal(player);
        }, 1500);
    };

    const handleWinByTimeout = (winner) => {
        playSound(winSound);
        updateScore(winner);
        updateScoreDisplay();
        setTimeout(() => { showWinModal(winner); }, 300);
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
        setActivePlayerVisual(player);
        if (aiMode && player === 'white') {
            setBoardInteractive(false);
        } else {
            setBoardInteractive(true);
        }
        startTimerFor(player);
    };

    const updateScoreDisplay = () => {
        const scores = getScores();
        const text = `黑子: ${scores.black} | 白子: ${scores.white}`;
        scoreElement.textContent = text;
        if (scoreElementMobile) scoreElementMobile.textContent = text;
        const digits = `${scores.black} : ${scores.white}`;
        if (scoreDigitsDesktop) scoreDigitsDesktop.textContent = digits;
        if (scoreDigitsMobile) scoreDigitsMobile.textContent = digits;
    };

    const resetGame = () => {
        playSound(resetSound);
        hideModals();
        resetGameState();
        lastMove = null;
        hintMove = null;
        winningLinePositions = null;
        drawGrid();
        drawStones();
        updateStatus();
        timeBlack = INITIAL_SECONDS;
        timeWhite = INITIAL_SECONDS;
        updateTimerDisplays();
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
            hintMove = { row: move.row, col: move.col };
            drawStones();
            setTimeout(() => { hintMove = null; drawStones(); }, 600);
        }
    };

    const pickCellFromEvent = (evt) => {
        const rect = stonesCanvas.getBoundingClientRect();
        const x = (evt.clientX || (evt.touches && evt.touches[0].clientX)) - rect.left;
        const y = (evt.clientY || (evt.touches && evt.touches[0].clientY)) - rect.top;
        const { cell, pad } = geom;
        const col = Math.round((x - pad) / cell);
        const row = Math.round((y - pad) / cell);
        if (row < 0 || row >= BOARD_SIZE || col < 0 || col >= BOARD_SIZE) return null;
        return { row, col };
    };

    const onCanvasClick = (event) => {
        if (aiMode && getCurrentPlayer() === 'white') return;
        const cell = pickCellFromEvent(event);
        if (cell) handlePlayerMove(cell.row, cell.col);
    };
    stonesCanvas.addEventListener('click', onCanvasClick);
    stonesCanvas.addEventListener('touchstart', (e) => { onCanvasClick(e); }, { passive: true });

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
    setCanvasSize();
    drawGrid();
    drawStones();
    updateStatus();
    updateScoreDisplay();
    updateTimerDisplays();

    // Resize 监听
    window.addEventListener('resize', () => {
        setCanvasSize();
        drawGrid();
        drawStones();
    });
});
