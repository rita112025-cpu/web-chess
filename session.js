/*
 * session.js — 教學／挑戰的「一個練習步驟」邏輯（純邏輯，無畫面，可用 Node 測試）
 *
 * 一個 session 管理一個預設局面：選棋、走棋、判定成功或失敗、解釋非法走法。
 * 它有自己的局面（由 FEN 載入），完全不會碰自由對弈的狀態。
 * 走法是否合法、是否將死等一律交給 engine.js 判定。
 */
(function (root) {
  'use strict';
  const C = root.Chess || require('./engine.js');
  const K = 6, P = 1, N = 2, B = 3, R = 4, Q = 5;
  const sq = (name) => (8 - +name[1]) * 8 + (name.charCodeAt(0) - 97);

  /*
   * 解釋「為什麼這步不合法」。from 是自己的棋子，to 是點擊的目標格，st 是目前局面。
   * 先判斷是不是規則導致（自己人擋住、國王安全），再依棋子種類說明走法。
   */
  function explainIllegal(st, from, to) {
    const p = st.board[from], t = Math.abs(p), s = p > 0 ? 1 : -1;
    const target = st.board[to];
    if (target * p > 0) return '那一格已經有自己的棋子，不能走到上面。';

    const dr = (to >> 3) - (from >> 3), dc = (to & 7) - (from & 7);
    const adr = Math.abs(dr), adc = Math.abs(dc);

    // 走法本身符合棋子規則，卻被擋下 → 一定是國王安全問題
    if (C.pseudoMoves(st).some((m) => m.from === from && m.to === to)) {
      if (t === K) return '那一格正被對方攻擊，國王不能走進被攻擊的位置。';
      if (C.inCheck(st)) return '你的國王正被將軍！必須走一步來化解：移開國王、擋住攻擊路線，或吃掉攻擊者。';
      return '走了之後你的國王會被攻擊（這顆棋子正擋在國王前面），所以不能這樣走。';
    }

    // 被將軍時，其他不相關的走法也要提醒
    const inCheckNote = C.inCheck(st) ? '（而且你的國王正被將軍，必須先化解。）' : '';

    switch (t) {
      case K:
        return '國王一次只能走一格。' + inCheckNote;
      case Q:
        if (dr === 0 || dc === 0 || adr === adc) return '路線上有棋子擋住了，皇后不能跳過其他棋子。' + inCheckNote;
        return '皇后只能走直線、橫線或斜線。' + inCheckNote;
      case R:
        if (dr === 0 || dc === 0) return '路線上有棋子擋住了，城堡不能跳過其他棋子。' + inCheckNote;
        return '城堡只能走直線或橫線，不能走斜線。' + inCheckNote;
      case B:
        if (adr === adc) return '路線上有棋子擋住了，主教不能跳過其他棋子。' + inCheckNote;
        return '主教只能走斜線。' + inCheckNote;
      case N:
        return '騎士要走「L 形」：先走兩格，再轉彎走一格。' + inCheckNote;
      case P: {
        const fwd = -dr * s; // 正數 = 往前
        if (fwd <= 0) return '兵只能往前走，不能後退或橫走。' + inCheckNote;
        if (dc === 0) {
          if (target !== 0) return '兵前方被擋住了，兵不能直走去吃子。' + inCheckNote;
          if (fwd === 2) return '兵只有「第一次」移動，而且前兩格都空著時，才能走兩格。' + inCheckNote;
          return '兵一次只能往前走一格。' + inCheckNote;
        }
        if (adc === 1 && fwd === 1) return '兵只能斜著吃子，那一格沒有可以吃的敵人。' + inCheckNote;
        return '兵只能直走，或斜前方一格吃子。' + inCheckNote;
      }
      default:
        return '這棋子不能這樣走。';
    }
  }

  /*
   * 建立一個練習 session。step 來自 lessons.js。
   * 狀態 phase：'play' 進行中 | 'success' 成功 | 'fail'（走了合法棋但沒達成目標）
   */
  function createSession(step) {
    const st = C.fromFen(step.fen);
    const s = {
      step, st,
      lock: step.lock ? sq(step.lock) : null,
      selected: null,
      phase: 'play',
      last: null,
      moves: C.legalMoves(st)
    };
    // 有鎖定棋子的教學一開始就選好，使用者直接看到移動範圍
    if (s.lock !== null) s.selected = s.lock;

    // 國王安全課用：標出國王相鄰且被攻擊的格子；挑戰 4 則標出整盤被攻擊的空格
    s.danger = new Set();
    if (step.danger) {
      const side = st.turn, enemy = -side;
      for (let i = 0; i < 64; i++) {
        if (st.board[i] === 0 && C.isAttacked(st.board, i, enemy) && nearKing(st, i, side)) s.danger.add(i);
      }
    }
    s.marks = new Set((step.marks || []).map(sq));

    // 目前選取棋子的可走格：Map(格子 → 'move' | 'capture')
    s.targets = function () {
      const map = new Map();
      if (s.selected === null || s.phase !== 'play') return map;
      for (const m of s.moves) {
        if (m.from === s.selected) map.set(m.to, (st.board[m.to] !== 0 || m.flag === 1) ? 'capture' : 'move');
      }
      return map;
    };

    // 點擊一格，回傳結果：{ kind, msg?, moves?, success? }
    //   kind: ignore | select | deselect | warn（橘色提示）| promo（需選升變）| moved
    s.tap = function (target) {
      if (s.phase !== 'play') return { kind: 'ignore' };
      const own = st.board[target] * st.turn > 0;
      if (s.selected === null) {
        if (!own) return { kind: 'warn', msg: '請先點選你的棋子（白色棋子）。' };
        s.selected = target;
        return { kind: 'select' };
      }
      if (target === s.selected) {
        if (s.lock !== null) return { kind: 'ignore' };
        s.selected = null;
        return { kind: 'deselect' };
      }
      const ms = s.moves.filter((m) => m.from === s.selected && m.to === target);
      if (ms.length > 1) return { kind: 'promo', moves: ms };
      if (ms.length === 1) return s.play(ms[0]);
      if (own) {
        if (s.lock !== null) return { kind: 'warn', msg: '這一步請移動標示的那顆棋子。' };
        s.selected = target;
        return { kind: 'select' };
      }
      return { kind: 'warn', msg: explainIllegal(st, s.selected, target) };
    };

    // 實際走一步，並依「走完後的實際棋盤」判斷成功與否
    s.play = function (m) {
      C.play(st, m);
      s.last = { from: m.from, to: m.to };
      s.selected = null;
      s.moves = C.legalMoves(st);
      const ok = !!step.success(st, m);
      s.phase = ok ? 'success' : 'fail';
      const msg = ok ? step.okMsg : (step.failMsg ? step.failMsg(st, m) : '這步合法，但沒有達成目標。');
      return { kind: 'moved', success: ok, msg };
    };
    return s;
  }

  // 格子 i 是否在 side 方國王的相鄰一圈或同線附近（只用來限制危險標記數量）
  function nearKing(st, i, side) {
    const k = st.board.indexOf(side * K);
    if (k < 0) return false;
    return Math.abs((i >> 3) - (k >> 3)) <= 1 && Math.abs((i & 7) - (k & 7)) <= 1;
  }

  const api = { createSession, explainIllegal };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Session = api;
})(typeof window !== 'undefined' ? window : this);
