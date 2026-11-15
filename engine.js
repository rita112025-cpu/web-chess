/*
 * engine.js — 西洋棋規則引擎（教學版）
 *
 * 只負責「棋規」：產生合法走法、將軍／將死／和局判定，以及一個隨機走子的電腦。
 * 完全不碰畫面，所以可以直接用 Node 跑測試（見 test.js）。
 *
 * 資料表示法：
 *   棋盤 board 是長度 64 的陣列，索引 = 列 * 8 + 行，第 0 列是第 8 橫線（畫面最上方）。
 *   棋子：白方為正數、黑方為負數；兵=1 騎士=2 主教=3 城堡=4 皇后=5 國王=6。
 *   turn：1 = 白方走、-1 = 黑方走。
 *   castle：王車易位權利的位元旗標，1=白短 2=白長 4=黑短 8=黑長。
 *   ep：吃過路兵的目標格（沒有則 -1）。
 *   half：半步計數（供 50 步規則，滿 100 半步和局）。
 *   keys：歷史局面字串（供三次重複判定）。
 */
(function (root) {
  'use strict';

  const P = 1, N = 2, B = 3, R = 4, Q = 5, K = 6;
  const KN = [[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]];
  const KG = [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]];
  const DIAG = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
  const ORTH = [[-1, 0], [1, 0], [0, -1], [0, 1]];
  const PROMOS = [Q, R, B, N]; // 兵可升變的棋子

  // 局面識別字串：棋子位置 + 輪誰走 + 易位權利 + 過路兵格，三次重複就是比對它
  function positionKey(st) {
    return st.board.join(',') + '|' + st.turn + '|' + st.castle + '|' + st.ep;
  }

  // 建立標準開局
  function newState() {
    const b = new Array(64).fill(0);
    const back = [R, N, B, Q, K, B, N, R];
    for (let c = 0; c < 8; c++) {
      b[c] = -back[c];
      b[8 + c] = -P;
      b[48 + c] = P;
      b[56 + c] = back[c];
    }
    const st = { board: b, turn: 1, castle: 15, ep: -1, half: 0, full: 1, keys: [] };
    st.keys.push(positionKey(st));
    return st;
  }

  // 由 FEN 字串建立局面。介面不提供匯入，只給測試（perft、特殊棋規）使用
  function fromFen(fen) {
    const parts = fen.trim().split(/\s+/);
    const b = new Array(64).fill(0);
    const map = { p: P, n: N, b: B, r: R, q: Q, k: K };
    let sq = 0;
    for (const ch of parts[0]) {
      if (ch === '/') continue;
      if (ch >= '1' && ch <= '8') { sq += +ch; continue; }
      const lower = ch.toLowerCase();
      b[sq++] = (ch === lower ? -1 : 1) * map[lower];
    }
    let castle = 0;
    const cs = parts[2] || '-';
    if (cs.includes('K')) castle |= 1;
    if (cs.includes('Q')) castle |= 2;
    if (cs.includes('k')) castle |= 4;
    if (cs.includes('q')) castle |= 8;
    let ep = -1;
    if (parts[3] && parts[3] !== '-') ep = (8 - +parts[3][1]) * 8 + (parts[3].charCodeAt(0) - 97);
    const st = {
      board: b, turn: parts[1] === 'b' ? -1 : 1, castle, ep,
      half: +(parts[4] || 0), full: +(parts[5] || 1), keys: []
    };
    st.keys.push(positionKey(st));
    return st;
  }

  // 複製局面（悔棋用：每走一步先存一份快照）
  function cloneState(st) {
    return {
      board: st.board.slice(), turn: st.turn, castle: st.castle, ep: st.ep,
      half: st.half, full: st.full, keys: st.keys.slice()
    };
  }

  // 判斷 sq 這一格是否被 by 方攻擊（by = 1 白 / -1 黑）。
  // 做法：從 sq 反向找——有沒有敵方的兵、騎士、國王、或沿直線／斜線射來的棋子。
  function isAttacked(b, sq, by) {
    const r = sq >> 3, c = sq & 7;
    // 兵：白兵往上（列數變小）攻擊，所以攻擊者在 sq 的下一列
    const pr = r + (by === 1 ? 1 : -1);
    if (pr >= 0 && pr < 8) {
      if (c > 0 && b[pr * 8 + c - 1] === by * P) return true;
      if (c < 7 && b[pr * 8 + c + 1] === by * P) return true;
    }
    // 騎士與國王：固定偏移
    for (let i = 0; i < 8; i++) {
      const rr = r + KN[i][0], cc = c + KN[i][1];
      if (rr >= 0 && rr < 8 && cc >= 0 && cc < 8 && b[rr * 8 + cc] === by * N) return true;
      const r2 = r + KG[i][0], c2 = c + KG[i][1];
      if (r2 >= 0 && r2 < 8 && c2 >= 0 && c2 < 8 && b[r2 * 8 + c2] === by * K) return true;
    }
    // 主教／皇后走斜線、城堡／皇后走直橫線：碰到第一個棋子就停
    for (let i = 0; i < 4; i++) {
      let rr = r + DIAG[i][0], cc = c + DIAG[i][1];
      while (rr >= 0 && rr < 8 && cc >= 0 && cc < 8) {
        const p = b[rr * 8 + cc];
        if (p !== 0) { if (p === by * B || p === by * Q) return true; break; }
        rr += DIAG[i][0]; cc += DIAG[i][1];
      }
      rr = r + ORTH[i][0]; cc = c + ORTH[i][1];
      while (rr >= 0 && rr < 8 && cc >= 0 && cc < 8) {
        const p = b[rr * 8 + cc];
        if (p !== 0) { if (p === by * R || p === by * Q) return true; break; }
        rr += ORTH[i][0]; cc += ORTH[i][1];
      }
    }
    return false;
  }

  function findKing(b, s) {
    return b.indexOf(s * K);
  }

  // 產生「偽合法」走法：符合棋子走法，但尚未檢查走完後自己的國王是否被將。
  // flag：0 一般、1 吃過路兵、2 王車易位、3 兵走兩格
  function genPseudo(st) {
    const b = st.board, s = st.turn, out = [];
    for (let from = 0; from < 64; from++) {
      const p = b[from];
      if (p * s <= 0) continue; // 空格或對方棋子
      const t = Math.abs(p), r = from >> 3, c = from & 7;
      if (t === P) {
        const dir = -s, startRow = s === 1 ? 6 : 1, promoRow = s === 1 ? 0 : 7;
        const r1 = r + dir;
        if (r1 < 0 || r1 > 7) continue;
        // 走到底線時，每種升變棋子各算一個走法
        const add = (to) => {
          if (r1 === promoRow) for (const pr of PROMOS) out.push({ from, to, promo: pr, flag: 0 });
          else out.push({ from, to, promo: 0, flag: 0 });
        };
        // 直走一格；在起始列且前兩格皆空時可走兩格
        if (b[r1 * 8 + c] === 0) {
          add(r1 * 8 + c);
          if (r === startRow && b[(r + 2 * dir) * 8 + c] === 0) {
            out.push({ from, to: (r + 2 * dir) * 8 + c, promo: 0, flag: 3 });
          }
        }
        // 斜吃：目標有敵子，或是過路兵目標格
        for (const dc of [-1, 1]) {
          const cc = c + dc;
          if (cc < 0 || cc > 7) continue;
          const to = r1 * 8 + cc;
          if (b[to] * s < 0) add(to);
          else if (to === st.ep) out.push({ from, to, promo: 0, flag: 1 });
        }
      } else if (t === N || t === K) {
        const dirs = t === N ? KN : KG;
        for (let i = 0; i < 8; i++) {
          const rr = r + dirs[i][0], cc = c + dirs[i][1];
          if (rr < 0 || rr > 7 || cc < 0 || cc > 7) continue;
          const to = rr * 8 + cc;
          if (b[to] * s > 0) continue; // 不能吃自己人
          out.push({ from, to, promo: 0, flag: 0 });
        }
        // 王車易位：未動過、中間無子、國王起點／經過／終點都沒被攻擊
        if (t === K) {
          const row = s === 1 ? 56 : 0, kS = s === 1 ? 1 : 4, qS = s === 1 ? 2 : 8;
          if (from === row + 4) {
            if ((st.castle & kS) && b[row + 5] === 0 && b[row + 6] === 0 && b[row + 7] === s * R &&
              !isAttacked(b, row + 4, -s) && !isAttacked(b, row + 5, -s) && !isAttacked(b, row + 6, -s)) {
              out.push({ from, to: row + 6, promo: 0, flag: 2 });
            }
            if ((st.castle & qS) && b[row + 3] === 0 && b[row + 2] === 0 && b[row + 1] === 0 && b[row] === s * R &&
              !isAttacked(b, row + 4, -s) && !isAttacked(b, row + 3, -s) && !isAttacked(b, row + 2, -s)) {
              out.push({ from, to: row + 2, promo: 0, flag: 2 });
            }
          }
        }
      } else {
        // 主教、城堡、皇后：沿方向滑動，遇到自己人停、遇到敵人吃掉後停
        const dirs = t === B ? DIAG : t === R ? ORTH : DIAG.concat(ORTH);
        for (let i = 0; i < dirs.length; i++) {
          let rr = r + dirs[i][0], cc = c + dirs[i][1];
          while (rr >= 0 && rr < 8 && cc >= 0 && cc < 8) {
            const to = rr * 8 + cc, q = b[to];
            if (q * s > 0) break;
            out.push({ from, to, promo: 0, flag: 0 });
            if (q !== 0) break;
            rr += dirs[i][0]; cc += dirs[i][1];
          }
        }
      }
    }
    return out;
  }

  // 執行走法（直接修改 st），並把還原所需資訊記在 m 上
  function make(st, m) {
    const b = st.board, s = st.turn;
    const piece = b[m.from];
    m.piece = piece;
    m.cap = b[m.to];
    m.pc = st.castle; m.pe = st.ep; m.ph = st.half;
    b[m.to] = m.promo ? s * m.promo : piece;
    b[m.from] = 0;
    if (m.flag === 1) {
      // 吃過路兵：被吃的兵在目標格的後方，不在目標格上
      const cp = m.to + (s === 1 ? 8 : -8);
      m.cap = b[cp];
      b[cp] = 0;
    } else if (m.flag === 2) {
      // 王車易位：把城堡搬到國王旁邊
      if (m.to > m.from) { b[m.to - 1] = b[m.to + 1]; b[m.to + 1] = 0; }
      else { b[m.to + 1] = b[m.to - 2]; b[m.to - 2] = 0; }
    }
    // 國王動過就失去雙邊易位權；城堡起點或被吃的格子也會失去對應易位權
    let cr = st.castle;
    if (Math.abs(piece) === K) cr &= s === 1 ? ~3 : ~12;
    if (m.from === 63 || m.to === 63) cr &= ~1;
    if (m.from === 56 || m.to === 56) cr &= ~2;
    if (m.from === 7 || m.to === 7) cr &= ~4;
    if (m.from === 0 || m.to === 0) cr &= ~8;
    st.castle = cr;
    st.ep = m.flag === 3 ? (m.from + m.to) / 2 : -1;
    st.half = (Math.abs(piece) === P || m.cap) ? 0 : st.half + 1;
    if (s === -1) st.full++;
    st.turn = -s;
  }

  // 還原 make 的效果（搜尋合法走法時用來「試走再退回」）
  function unmake(st, m) {
    const b = st.board;
    st.turn = -st.turn;
    const s = st.turn;
    b[m.from] = m.piece;
    if (m.flag === 1) {
      b[m.to] = 0;
      b[m.to + (s === 1 ? 8 : -8)] = m.cap;
    } else {
      b[m.to] = m.cap;
      if (m.flag === 2) {
        if (m.to > m.from) { b[m.to + 1] = b[m.to - 1]; b[m.to - 1] = 0; }
        else { b[m.to - 2] = b[m.to + 1]; b[m.to + 1] = 0; }
      }
    }
    st.castle = m.pc; st.ep = m.pe; st.half = m.ph;
    if (s === -1) st.full--;
  }

  // 正式走一步：執行走法並記錄局面（供三次重複判定）
  function play(st, m) {
    make(st, m);
    st.keys.push(positionKey(st));
  }

  // 合法走法 = 偽合法走法中，走完後自己的國王沒被攻擊的那些
  function legalMoves(st) {
    const s = st.turn, b = st.board, out = [];
    const ksq = findKing(b, s);
    for (const m of genPseudo(st)) {
      make(st, m);
      const k = Math.abs(m.piece) === K ? m.to : ksq;
      if (!isAttacked(b, k, -s)) out.push(m);
      unmake(st, m);
    }
    return out;
  }

  // 輪到的一方是否正被將軍
  function inCheck(st) {
    return isAttacked(st.board, findKing(st.board, st.turn), -st.turn);
  }

  // 子力不足：雙方都不可能將死對方
  //   國王對國王、國王＋單一輕子對國王、或雙方只剩「同色格」主教
  function insufficient(b) {
    const minors = [];
    for (let i = 0; i < 64; i++) {
      const t = Math.abs(b[i]);
      if (t === 0 || t === K) continue;
      if (t === N || t === B) minors.push({ t, shade: ((i >> 3) + (i & 7)) % 2 });
      else return false; // 還有兵、城堡或皇后
    }
    if (minors.length <= 1) return true;
    return minors.every((m) => m.t === B && m.shade === minors[0].shade);
  }

  // 局面狀態：{ over, result, check, moves }
  // result：checkmate 將死 / stalemate 逼和 / insufficient 子力不足 / fifty 50 步 / repetition 三次重複
  function status(st) {
    const moves = legalMoves(st);
    const check = inCheck(st);
    if (moves.length === 0) {
      return { over: true, result: check ? 'checkmate' : 'stalemate', check, moves };
    }
    if (insufficient(st.board)) return { over: true, result: 'insufficient', check, moves };
    if (st.half >= 100) return { over: true, result: 'fifty', check, moves };
    const last = st.keys[st.keys.length - 1];
    let n = 0;
    for (const k of st.keys) if (k === last) n++;
    if (n >= 3) return { over: true, result: 'repetition', check, moves };
    return { over: false, result: null, check, moves };
  }

  // 簡單電腦：從所有合法走法中隨機挑一步（教學用，沒有任何搜尋）
  function randomMove(st) {
    const moves = legalMoves(st);
    return moves.length ? moves[Math.floor(Math.random() * moves.length)] : null;
  }

  // 格子名稱，例如 e4
  function sqName(sq) {
    return 'abcdefgh'[sq & 7] + (8 - (sq >> 3));
  }

  // perft：數出指定深度的所有合法走法路徑數，用來驗證走法產生器是否正確
  function perft(st, d) {
    if (d === 0) return 1;
    let n = 0;
    for (const m of legalMoves(st)) {
      make(st, m);
      n += perft(st, d - 1);
      unmake(st, m);
    }
    return n;
  }

  const api = {
    newState, fromFen, cloneState, legalMoves, play, make, unmake, status, inCheck,
    randomMove, sqName, perft,
    // 以下供教學模式解釋「為什麼不能這樣走」使用
    pseudoMoves: genPseudo, isAttacked, findKing
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Chess = api;
})(typeof window !== 'undefined' ? window : this);
