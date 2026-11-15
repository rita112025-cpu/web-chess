/*
 * app.js — 介面與遊戲流程
 * 棋規全部交給 engine.js（window.Chess），這裡只負責：顯示棋盤、處理點擊、電腦回合、悔棋。
 */
(function () {
  'use strict';
  const C = window.Chess;
  const $ = (id) => document.getElementById(id);

  const Board = window.Board;
  const glyph = Board.glyph, sideName = Board.sideName;
  const RESULT = {
    stalemate: '逼和，和局', insufficient: '子力不足，和局',
    fifty: '50 步規則，和局', repetition: '三次重複局面，和局'
  };
  const INIT = { 1: 8, 2: 2, 3: 2, 4: 2, 5: 1 }; // 每方開局各棋子數量，用來算被吃掉的棋子

  let st;                 // 目前局面
  let cur;                // C.status(st) 的結果：{ over, result, check, moves }
  let snaps = [];         // 每走一步前的局面快照，供悔棋
  let lastMove = null;    // 最後一步 { from, to }，用來標示
  let lastMoves = [];     // 每一步的歷史，悔棋時同步退回
  let selected = null;    // 目前選取的格子
  let flipped = false;    // 棋盤是否翻轉（黑方在下）
  let thinking = false;   // 電腦是否正在「思考」
  let human = 1;          // 玩家執的顏色：1 白、-1 黑、0 雙人同機
  let mode = 'ai';        // 'ai' | 'pvp'
  let token = 0;          // 新局／悔棋時遞增，讓過期的電腦回合作廢

  function pickSide() {
    const v = $('side').value;
    if (v === 'random') return Math.random() < 0.5 ? 1 : -1;
    return v === 'w' ? 1 : -1;
  }

  // 開新局：依模式決定玩家顏色，若電腦先手就讓它先走
  function newGame() {
    human = mode === 'ai' ? pickSide() : 0;
    flipped = human === -1;
    st = C.newState();
    snaps = []; lastMoves = []; lastMove = null;
    selected = null; thinking = false; token++;
    Board.closePromo();
    refresh();
    maybeAI();
  }

  function setMode(m) {
    mode = m;
    $('modeAi').classList.toggle('on', m === 'ai');
    $('modePvp').classList.toggle('on', m === 'pvp');
    $('sideRow').style.display = m === 'ai' ? '' : 'none';
    newGame();
  }

  function refresh() {
    cur = C.status(st);
    render();
  }

  // 走一步：先存快照（悔棋用），再交給引擎執行
  function doMove(m) {
    snaps.push(C.cloneState(st));
    lastMove = { from: m.from, to: m.to };
    lastMoves.push(lastMove);
    C.play(st, m);
    selected = null;
    refresh();
    maybeAI();
  }

  // 輪到電腦時，稍等一下再隨機走一步，讓玩家看得清楚
  function maybeAI() {
    if (mode !== 'ai' || cur.over || st.turn === human) return;
    thinking = true;
    render();
    const my = token;
    setTimeout(() => {
      if (my !== token) return; // 期間按了新局或悔棋
      const m = C.randomMove(st);
      thinking = false;
      if (m) doMove(m); else refresh();
    }, 450);
  }

  // 悔棋：對電腦時退到「再次輪到玩家」；雙人同機只退一步
  function undo() {
    if (!snaps.length) return;
    token++;
    thinking = false;
    do {
      st = snaps.pop();
      lastMoves.pop();
    } while (human !== 0 && st.turn !== human && snaps.length);
    lastMove = lastMoves[lastMoves.length - 1] || null;
    selected = null;
    refresh();
    maybeAI();
  }

  // 點擊格子：已選棋子且點到可走的格子就走棋；否則改選自己的棋子
  function onSquare(sq) {
    if (cur.over || thinking) return;
    if (human !== 0 && st.turn !== human) return;
    if (selected !== null) {
      const ms = cur.moves.filter((m) => m.from === selected && m.to === sq);
      if (ms.length > 1) return Board.askPromo(ms, st.turn, doMove); // 同一格有多個走法 = 兵升變
      if (ms.length === 1) return doMove(ms[0]);
    }
    selected = st.board[sq] * st.turn > 0 && selected !== sq ? sq : null;
    render();
  }

  // 各方被吃掉的棋子（由開局數量減去場上數量）
  function capturedList() {
    const cnt = { 1: {}, '-1': {} };
    for (const p of st.board) {
      if (!p || Math.abs(p) === 6) continue;
      const s = p > 0 ? 1 : -1, t = Math.abs(p);
      cnt[s][t] = (cnt[s][t] || 0) + 1;
    }
    const res = { 1: '', '-1': '' }; // res[s] = 被 s 方吃掉的對方棋子
    for (const s of [1, -1]) {
      for (const t of [5, 4, 3, 2, 1]) {
        const lost = Math.max(0, INIT[t] - (cnt[s][t] || 0));
        res[-s] += glyph(t).repeat(lost);
      }
    }
    return res;
  }

  function render() {
    // 選取棋子後，標出它所有可走的格子（有敵子或過路兵 = 圓圈，否則圓點）
    const targets = new Map();
    if (selected !== null) {
      for (const m of cur.moves) {
        if (m.from === selected) targets.set(m.to, st.board[m.to] || m.flag === 1 ? 'capture' : 'move');
      }
    }
    Board.draw($('board'), {
      st, flipped, selected, targets, last: lastMove, onSquare,
      checkSq: cur.check ? st.board.indexOf(6 * st.turn) : -1
    });

    // 上下兩條：玩家名稱與已吃掉的棋子
    const bottom = flipped ? -1 : 1, top = -bottom;
    const caps = capturedList();
    const label = (s) => sideName(s) + (human === 0 ? '' : s === human ? '（你）' : '（電腦）');
    $('topName').textContent = label(top);
    $('botName').textContent = label(bottom);
    $('topCaps').textContent = caps[top];
    $('botCaps').textContent = caps[bottom];
    $('topBar').classList.toggle('turn', !cur.over && st.turn === top);
    $('botBar').classList.toggle('turn', !cur.over && st.turn === bottom);

    // 狀態文字
    const status = $('status');
    status.classList.toggle('over', cur.over);
    if (cur.over) {
      status.textContent = cur.result === 'checkmate'
        ? '將死！' + sideName(-st.turn) + '獲勝'
        : RESULT[cur.result];
    } else if (thinking) {
      status.textContent = '電腦思考中…';
    } else {
      const who = human !== 0 && st.turn === human ? '輪到你了' : '輪到' + sideName(st.turn);
      status.textContent = who + (cur.check ? '（將軍！）' : '');
    }
    $('undoBtn').disabled = !snaps.length;
  }

  $('newBtn').onclick = newGame;
  $('undoBtn').onclick = undo;
  $('flipBtn').onclick = () => { flipped = !flipped; render(); };
  $('modeAi').onclick = () => setMode('ai');
  $('modePvp').onclick = () => setMode('pvp');
  $('side').onchange = newGame;

  // ---------- 畫面切換 ----------
  // 首頁、自由對弈、教學各自獨立：切換只是顯示／隱藏，不會重設或污染另一邊的狀態
  const VIEWS = { home: 'viewHome', play: 'viewPlay', tutor: 'viewTutor' };
  function show(view) {
    for (const v in VIEWS) $(VIEWS[v]).hidden = v !== view;
    $('homeBtn').hidden = view === 'home';
    Board.closePromo();
    window.scrollTo(0, 0);
  }

  $('goPlay').onclick = () => show('play');
  $('goLearn').onclick = () => { window.Tutorial.open('learn'); show('tutor'); };
  $('goChallenge').onclick = () => { window.Tutorial.open('challenge'); show('tutor'); };
  $('homeBtn').onclick = () => show('home');
  $('tFinish').onclick = () => show('home');
  // 點升變視窗的空白處可取消（取消後兵仍留在原位，可重新選擇）
  $('promo').onclick = (e) => { if (e.target === $('promo')) Board.closePromo(); };

  setMode('ai');
  show('home');
})();
