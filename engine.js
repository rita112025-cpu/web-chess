(function (root) {
  'use strict';

  // Pieces: white positive, black negative. P=1 N=2 B=3 R=4 Q=5 K=6.
  // Board index = row * 8 + col, row 0 is rank 8 (top).
  const P = 1, N = 2, B = 3, R = 4, Q = 5, K = 6;
  const KN = [[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]];
  const KG = [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]];
  const DIAG = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
  const ORTH = [[-1, 0], [1, 0], [0, -1], [0, 1]];
  const PROMOS = [Q, R, B, N];
  const LETTERS = 'PNBRQK';

  function positionKey(st) {
    return st.board.join(',') + '|' + st.turn + '|' + st.castle + '|' + st.ep;
  }

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

  function cloneState(st) {
    return {
      board: st.board.slice(), turn: st.turn, castle: st.castle, ep: st.ep,
      half: st.half, full: st.full, keys: st.keys.slice()
    };
  }

  function isAttacked(b, sq, by) {
    const r = sq >> 3, c = sq & 7;
    const pr = r + (by === 1 ? 1 : -1);
    if (pr >= 0 && pr < 8) {
      if (c > 0 && b[pr * 8 + c - 1] === by * P) return true;
      if (c < 7 && b[pr * 8 + c + 1] === by * P) return true;
    }
    for (let i = 0; i < 8; i++) {
      const rr = r + KN[i][0], cc = c + KN[i][1];
      if (rr >= 0 && rr < 8 && cc >= 0 && cc < 8 && b[rr * 8 + cc] === by * N) return true;
      const r2 = r + KG[i][0], c2 = c + KG[i][1];
      if (r2 >= 0 && r2 < 8 && c2 >= 0 && c2 < 8 && b[r2 * 8 + c2] === by * K) return true;
    }
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
    const k = s * K;
    for (let i = 0; i < 64; i++) if (b[i] === k) return i;
    return -1;
  }

  // flag: 0 normal, 1 en passant, 2 castle, 3 double pawn push
  function genPseudo(st, capOnly) {
    const b = st.board, s = st.turn, out = [];
    for (let from = 0; from < 64; from++) {
      const p = b[from];
      if (p * s <= 0) continue;
      const t = Math.abs(p), r = from >> 3, c = from & 7;
      if (t === P) {
        const dir = -s, startRow = s === 1 ? 6 : 1, promoRow = s === 1 ? 0 : 7;
        const r1 = r + dir;
        if (r1 < 0 || r1 > 7) continue;
        const add = (to) => {
          if (r1 === promoRow) for (const pr of PROMOS) out.push({ from, to, promo: pr, flag: 0 });
          else out.push({ from, to, promo: 0, flag: 0 });
        };
        if (!capOnly && b[r1 * 8 + c] === 0) {
          add(r1 * 8 + c);
          if (r === startRow && b[(r + 2 * dir) * 8 + c] === 0) {
            out.push({ from, to: (r + 2 * dir) * 8 + c, promo: 0, flag: 3 });
          }
        }
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
          const to = rr * 8 + cc, q = b[to];
          if (q * s > 0) continue;
          if (capOnly && q === 0) continue;
          out.push({ from, to, promo: 0, flag: 0 });
        }
        if (t === K && !capOnly) {
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
        const dirs = t === B ? DIAG : t === R ? ORTH : DIAG.concat(ORTH);
        for (let i = 0; i < dirs.length; i++) {
          let rr = r + dirs[i][0], cc = c + dirs[i][1];
          while (rr >= 0 && rr < 8 && cc >= 0 && cc < 8) {
            const to = rr * 8 + cc, q = b[to];
            if (q * s > 0) break;
            if (q === 0) { if (!capOnly) out.push({ from, to, promo: 0, flag: 0 }); }
            else { out.push({ from, to, promo: 0, flag: 0 }); break; }
            rr += dirs[i][0]; cc += dirs[i][1];
          }
        }
      }
    }
    return out;
  }

  function make(st, m) {
    const b = st.board, s = st.turn;
    const piece = b[m.from];
    m.piece = piece;
    m.cap = b[m.to];
    m.pc = st.castle; m.pe = st.ep; m.ph = st.half;
    b[m.to] = m.promo ? s * m.promo : piece;
    b[m.from] = 0;
    if (m.flag === 1) {
      const cp = m.to + (s === 1 ? 8 : -8);
      m.cap = b[cp];
      b[cp] = 0;
    } else if (m.flag === 2) {
      if (m.to > m.from) { b[m.to - 1] = b[m.to + 1]; b[m.to + 1] = 0; }
      else { b[m.to + 1] = b[m.to - 2]; b[m.to - 2] = 0; }
    }
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

  function play(st, m) {
    make(st, m);
    st.keys.push(positionKey(st));
  }

  function legalMoves(st) {
    const s = st.turn, b = st.board, out = [];
    const ksq = findKing(b, s);
    for (const m of genPseudo(st, false)) {
      make(st, m);
      const k = Math.abs(m.piece) === K ? m.to : ksq;
      if (!isAttacked(b, k, -s)) out.push(m);
      unmake(st, m);
    }
    return out;
  }

  function inCheck(st) {
    return isAttacked(st.board, findKing(st.board, st.turn), -st.turn);
  }

  function insufficient(b) {
    let minors = 0;
    for (let i = 0; i < 64; i++) {
      const t = Math.abs(b[i]);
      if (t === 0 || t === K) continue;
      if (t === N || t === B) minors++;
      else return false;
    }
    return minors <= 1;
  }

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

  function sqName(sq) {
    return 'abcdefgh'[sq & 7] + (8 - (sq >> 3));
  }

  function san(st, m, legal) {
    const b = st.board;
    const t = Math.abs(b[m.from]);
    let base;
    if (m.flag === 2) {
      base = m.to > m.from ? 'O-O' : 'O-O-O';
    } else {
      const capture = b[m.to] !== 0 || m.flag === 1;
      let name = t === P ? '' : LETTERS[t - 1];
      let dis = '';
      if (t !== P) {
        const others = legal.filter(x => x !== m && x.to === m.to && Math.abs(b[x.from]) === t);
        if (others.length) {
          const file = sqName(m.from)[0], rank = sqName(m.from)[1];
          if (!others.some(x => (x.from & 7) === (m.from & 7))) dis = file;
          else if (!others.some(x => (x.from >> 3) === (m.from >> 3))) dis = rank;
          else dis = file + rank;
        }
      } else if (capture) {
        name = sqName(m.from)[0];
      }
      base = name + dis + (capture ? 'x' : '') + sqName(m.to) + (m.promo ? '=' + LETTERS[m.promo - 1] : '');
    }
    make(st, m);
    let suffix = '';
    if (inCheck(st)) suffix = legalMoves(st).length === 0 ? '#' : '+';
    unmake(st, m);
    return base + suffix;
  }

  // ---------- AI ----------
  const VAL = [0, 100, 320, 330, 500, 900, 0];
  const PST = [null,
    [0, 0, 0, 0, 0, 0, 0, 0, 50, 50, 50, 50, 50, 50, 50, 50, 10, 10, 20, 30, 30, 20, 10, 10, 5, 5, 10, 25, 25, 10, 5, 5,
      0, 0, 0, 20, 20, 0, 0, 0, 5, -5, -10, 0, 0, -10, -5, 5, 5, 10, 10, -20, -20, 10, 10, 5, 0, 0, 0, 0, 0, 0, 0, 0],
    [-50, -40, -30, -30, -30, -30, -40, -50, -40, -20, 0, 0, 0, 0, -20, -40, -30, 0, 10, 15, 15, 10, 0, -30, -30, 5, 15, 20, 20, 15, 5, -30,
      -30, 0, 15, 20, 20, 15, 0, -30, -30, 5, 10, 15, 15, 10, 5, -30, -40, -20, 0, 5, 5, 0, -20, -40, -50, -40, -30, -30, -30, -30, -40, -50],
    [-20, -10, -10, -10, -10, -10, -10, -20, -10, 0, 0, 0, 0, 0, 0, -10, -10, 0, 5, 10, 10, 5, 0, -10, -10, 5, 5, 10, 10, 5, 5, -10,
      -10, 0, 10, 10, 10, 10, 0, -10, -10, 10, 10, 10, 10, 10, 10, -10, -10, 5, 0, 0, 0, 0, 5, -10, -20, -10, -10, -10, -10, -10, -10, -20],
    [0, 0, 0, 0, 0, 0, 0, 0, 5, 10, 10, 10, 10, 10, 10, 5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5,
      -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, 0, 0, 0, 5, 5, 0, 0, 0],
    [-20, -10, -10, -5, -5, -10, -10, -20, -10, 0, 0, 0, 0, 0, 0, -10, -10, 0, 5, 5, 5, 5, 0, -10, -5, 0, 5, 5, 5, 5, 0, -5,
      0, 0, 5, 5, 5, 5, 0, -5, -10, 5, 5, 5, 5, 5, 0, -10, -10, 0, 5, 0, 0, 0, 0, -10, -20, -10, -10, -5, -5, -10, -10, -20],
    [-30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30,
      -20, -30, -30, -40, -40, -30, -30, -20, -10, -20, -20, -20, -20, -20, -20, -10, 20, 20, 0, 0, 0, 0, 20, 20, 20, 30, 10, 0, 0, 10, 30, 20]
  ];
  const INF = 1000000, MATE = 100000;

  function evaluate(st, noise) {
    const b = st.board;
    let score = 0;
    for (let i = 0; i < 64; i++) {
      const p = b[i];
      if (p === 0) continue;
      const t = Math.abs(p);
      if (p > 0) score += VAL[t] + PST[t][i];
      else score -= VAL[t] + PST[t][i ^ 56];
    }
    score *= st.turn;
    if (noise) score += (Math.random() * 2 - 1) * noise;
    return score;
  }

  function orderMoves(moves, b, pv) {
    for (const m of moves) {
      let sc = 0;
      const victim = m.flag === 1 ? P : Math.abs(b[m.to]);
      if (victim) sc = 10 * VAL[victim] - VAL[Math.abs(b[m.from])] / 10 + 1000;
      if (m.promo) sc += VAL[m.promo];
      if (pv && m.from === pv.from && m.to === pv.to && m.promo === pv.promo) sc += 100000;
      m.order = sc;
    }
    moves.sort((a, c) => c.order - a.order);
  }

  function quiesce(st, alpha, beta, qd, ctx) {
    const stand = evaluate(st, ctx.noise);
    if (qd >= 6) return stand;
    if (stand >= beta) return stand;
    if (stand > alpha) alpha = stand;
    const s = st.turn, b = st.board;
    const moves = genPseudo(st, true);
    orderMoves(moves, b, null);
    const ksq = findKing(b, s);
    for (const m of moves) {
      make(st, m);
      const k = Math.abs(m.piece) === K ? m.to : ksq;
      if (isAttacked(b, k, -s)) { unmake(st, m); continue; }
      const sc = -quiesce(st, -beta, -alpha, qd + 1, ctx);
      unmake(st, m);
      if (sc >= beta) return sc;
      if (sc > alpha) alpha = sc;
    }
    return alpha;
  }

  function search(st, depth, alpha, beta, ply, ctx) {
    if ((++ctx.nodes & 1023) === 0 && Date.now() > ctx.deadline) ctx.abort = true;
    if (ctx.abort) return 0;
    if (depth <= 0) return quiesce(st, alpha, beta, 0, ctx);
    const s = st.turn, b = st.board;
    const moves = genPseudo(st, false);
    orderMoves(moves, b, ply === 0 ? ctx.pv : null);
    const ksq = findKing(b, s);
    let legalCount = 0, best = -INF;
    for (const m of moves) {
      make(st, m);
      const k = Math.abs(m.piece) === K ? m.to : ksq;
      if (isAttacked(b, k, -s)) { unmake(st, m); continue; }
      legalCount++;
      const sc = -search(st, depth - 1, -beta, -alpha, ply + 1, ctx);
      unmake(st, m);
      if (ctx.abort) return 0;
      if (sc > best) {
        best = sc;
        if (ply === 0) ctx.iterBest = { from: m.from, to: m.to, promo: m.promo };
      }
      if (sc > alpha) alpha = sc;
      if (alpha >= beta) break;
    }
    if (legalCount === 0) return isAttacked(b, ksq, -s) ? -MATE + ply : 0;
    return best;
  }

  const LEVELS = {
    1: { depth: 1, time: 300, noise: 150 },
    2: { depth: 3, time: 1000, noise: 4 },
    3: { depth: 5, time: 2500, noise: 3 }
  };

  function chooseMove(st, level) {
    const cfg = LEVELS[level] || LEVELS[2];
    const root = legalMoves(st);
    if (root.length === 0) return null;
    if (root.length === 1) return root[0];
    const ctx = { nodes: 0, deadline: Date.now() + cfg.time, abort: false, noise: cfg.noise, pv: null, iterBest: null };
    let best = null;
    for (let d = 1; d <= cfg.depth; d++) {
      ctx.iterBest = null;
      const sc = search(st, d, -INF, INF, 0, ctx);
      if (ctx.abort) break;
      if (ctx.iterBest) { best = ctx.iterBest; ctx.pv = best; }
      if (Math.abs(sc) > MATE - 100) break;
    }
    if (!best) best = root[0];
    return root.find(m => m.from === best.from && m.to === best.to && m.promo === best.promo) || root[0];
  }

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
    san, sqName, chooseMove, perft
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Chess = api;
})(typeof window !== 'undefined' ? window : this);
