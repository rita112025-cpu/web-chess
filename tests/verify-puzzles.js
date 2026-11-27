#!/usr/bin/env node
// 以 engine.js 驗證 puzzles.js 每一題：起始局面、所有正解、重播走法。
// 執行：node tests/verify-puzzles.js
// 驗證範圍（贏子題）：關鍵走法之後，雙方各種合法著法全寬度搜尋 DEPTH 個半步，
// 末端再以「只看吃子／升變，被將軍時看全部應將」的靜態搜尋延伸；評分只計子力（兵1 騎士3 主教3 城堡5 后9），
// 將死記為極大值。此範圍之外的長變化（例如 5 個半步以上才出現的反擊）不在驗證範圍內。
'use strict';
const path = require('path');
const C = require(path.join(__dirname, '..', 'engine.js'));
const PUZZLES = require(path.join(__dirname, '..', 'puzzles.js'));

const DEPTH = 4;          // 關鍵走法之後的全寬度半步數
const WIN_THRESHOLD = 2;  // 至少淨賺 2 分子力才算「贏子」
const VAL = [0, 1, 3, 3, 5, 9, 0];
const MATE = 1000;

const sqIndex = (s) => (8 - +s[1]) * 8 + (s.charCodeAt(0) - 97);
const uci = (m) => C.sqName(m.from) + C.sqName(m.to) + (m.promo ? 'nbrq'[[2, 3, 4, 5].indexOf(m.promo)] : '');
function findMove(st, u, list) {
  const from = sqIndex(u.slice(0, 2)), to = sqIndex(u.slice(2, 4));
  const promo = u[4] ? { n: 2, b: 3, r: 4, q: 5 }[u[4]] : 0;
  return (list || C.legalMoves(st)).find((m) => m.from === from && m.to === to && (m.promo || 0) === promo) || null;
}
// 吃子（價值高的被吃子優先）與升變先搜，提高剪枝效率；不影響搜尋結果。
function ordered(st, moves) {
  const key = (m) => (m.promo ? 10 : 0) + (m.flag === 1 ? 1 : VAL[Math.abs(st.board[m.to])]) * 10 - VAL[Math.abs(st.board[m.from])];
  return moves.map((m) => [key(m), m]).sort((a, b) => b[0] - a[0]).map((x) => x[1]);
}
function material(st, side) {
  let s = 0;
  for (const p of st.board) if (p) s += (p > 0 ? 1 : -1) * VAL[Math.abs(p)];
  return s * side;
}

let nodes = 0;
function quiesce(st, alpha, beta, qd, ply) {
  nodes++;
  const moves = C.legalMoves(st);
  const check = C.inCheck(st);
  if (moves.length === 0) return check ? -(MATE - ply) : 0;
  let best = -Infinity;
  if (!check) {
    best = material(st, st.turn);
    if (best >= beta || qd >= 10) return best;
    if (best > alpha) alpha = best;
  }
  for (const m of ordered(st, moves)) {
    if (!check && !m.promo && st.board[m.to] === 0 && m.flag !== 1) continue;
    C.make(st, m);
    const v = -quiesce(st, -beta, -alpha, qd + 1, ply + 1);
    C.unmake(st, m);
    if (v > best) best = v;
    if (v > alpha) alpha = v;
    if (alpha >= beta) break;
  }
  return best;
}
function search(st, depth, alpha, beta, ply) {
  if (depth <= 0) return quiesce(st, alpha, beta, 0, ply);
  nodes++;
  const moves = C.legalMoves(st);
  if (moves.length === 0) return C.inCheck(st) ? -(MATE - ply) : 0;
  let best = -Infinity;
  for (const m of ordered(st, moves)) {
    C.make(st, m);
    const v = -search(st, depth - 1, -beta, -alpha, ply + 1);
    C.unmake(st, m);
    if (v > best) best = v;
    if (v > alpha) alpha = v;
    if (alpha >= beta) break;
  }
  return best;
}
// 解題方走 m 後，以解題方角度的精確分數（全窗口，不剪枝於根）。
function scoreAfter(st, m, depth) {
  C.make(st, m);
  const v = -search(st, depth, -Infinity, Infinity, 1);
  C.unmake(st, m);
  return v;
}

let failures = 0;
const fail = (msg) => { failures++; console.log('  ✗ ' + msg); };
const ok = (msg) => console.log('  ✓ ' + msg);

function checkStart(p, st) {
  const kings = { 6: 0, '-6': 0 };
  st.board.forEach((x, i) => {
    if (Math.abs(x) === 6) kings[x]++;
    if (Math.abs(x) === 1 && (i < 8 || i >= 56)) fail('兵在底線：' + C.sqName(i));
  });
  if (kings[6] !== 1 || kings[-6] !== 1) fail('國王數量錯誤');
  // 未輪走的一方不得正被將軍
  const other = C.cloneState(st); other.turn = -st.turn;
  if (C.inCheck(other)) fail('未輪走的一方正被將軍，局面不合法');
  const s = C.status(st);
  if (s.over) fail('起始局面已結束：' + s.result);
  const turnTxt = st.turn === 1 ? '白方' : '黑方';
  if (failures === 0) ok('起始局面合法（' + turnTxt + '先走，' + s.moves.length + ' 種合法走法）');
}

for (const [idx, p] of PUZZLES.entries()) {
  const before = failures;
  console.log('\n第 ' + (idx + 1) + ' 題 [' + p.id + '] ' + p.title + '（' + p.goal + '）');
  const st = C.fromFen(p.fen);
  checkStart(p, st);
  const side = st.turn;
  const all = C.legalMoves(st);

  if (p.hintSq && !(st.board[sqIndex(p.hintSq)] * side > 0)) fail('提示格 ' + p.hintSq + ' 上不是解題方的棋子');
  for (const u of p.solutions) {
    const m = findMove(st, u);
    if (!m) { fail('正解 ' + u + ' 不是合法走法'); continue; }
    if (p.hintSq && C.sqName(m.from) !== p.hintSq) fail('正解 ' + u + ' 不是移動提示格的棋子');
  }

  let found;
  if (p.kind === 'mate') {
    found = [];
    for (const m of all) {
      const u = uci(m), sanTxt = C.san(st, m, all);
      C.make(st, m);
      const replies = C.legalMoves(st);
      const mate = replies.length === 0 && C.inCheck(st);
      C.unmake(st, m);
      if (mate) { found.push(u); ok('將死：' + sanTxt + '（對方合法應手數 = 0，且正被將軍）'); }
    }
  } else {
    const base = material(st, side);
    // 每一種合法走法都以零寬窗口判定「對方最佳防守下是否仍淨賺 ≥ 門檻」，達標者再算精確分數。
    const T = base + WIN_THRESHOLD;
    found = [];
    for (const m of all) {
      C.make(st, m);
      const v = -search(st, DEPTH, -T, -(T - 1), 1);
      C.unmake(st, m);
      if (v >= T) {
        const gain = scoreAfter(st, m, DEPTH) - base;
        found.push(uci(m));
        if (gain > MATE / 2) fail(C.san(st, m, all) + ' 會導致將死，題目目標應改為將死');
        else ok('贏子：' + C.san(st, m, all) + '，對方最佳防守下淨賺 ' + gain + ' 分');
      }
    }
    ok('其餘 ' + (all.length - found.length) + ' 種走法在相同搜尋範圍內都未達淨賺 ' + WIN_THRESHOLD + ' 分');

    // 對方每一種應手都檢查：沒有任何應手能讓解題方的淨賺低於門檻
    for (const u of p.solutions) {
      const m = findMove(st, u, all);
      if (!m) continue;
      C.make(st, m);
      const replies = C.legalMoves(st);
      let worst = Infinity, worstSan = '';
      for (const r of replies) {
        const rs = C.san(st, r, replies);
        C.make(st, r);
        const v = search(st, DEPTH - 1, -Infinity, Infinity, 2) - base;
        C.unmake(st, r);
        if (v < worst) { worst = v; worstSan = rs; }
      }
      C.unmake(st, m);
      if (worst >= WIN_THRESHOLD) ok('正解 ' + u + '：對方全部 ' + replies.length + ' 種應手都擋不住贏子，最頑強的是 ' + worstSan + '（仍淨賺 ' + worst + '）');
      else fail('正解 ' + u + '：對方 ' + worstSan + ' 可把淨賺壓到 ' + worst);
    }
  }

  const want = [...p.solutions].sort().join(','), got = [...found].sort().join(',');
  if (want === got) ok('題庫正解集合與引擎找到的集合一致：' + want);
  else fail('正解集合不一致：題庫 [' + want + ']，引擎 [' + got + ']');

  // 重播走法
  if (!p.solutions.includes(p.line[0])) fail('重播第一步不在正解內');
  const rs = C.fromFen(p.fen);
  const sans = [];
  let lineOk = true;
  for (const [i, u] of p.line.entries()) {
    const legalNow = C.legalMoves(rs);
    const m = findMove(rs, u, legalNow);
    if (!m) { fail('重播第 ' + (i + 1) + ' 步 ' + u + ' 不合法'); lineOk = false; break; }
    if (p.kind === 'material' && i === 1) {
      // 對手的關鍵應手必須是搜尋認定的最佳防守之一
      const replies = legalNow;
      const base = material(st, side);
      const vals = replies.map((r) => { C.make(rs, r); const v = search(rs, DEPTH - 1, -Infinity, Infinity, 2) - base; C.unmake(rs, r); return v; });
      const minV = Math.min(...vals);
      const mine = vals[replies.findIndex((r) => r.from === m.from && r.to === m.to)];
      if (mine === minV) ok('重播的對手應手 ' + C.san(rs, m, legalNow) + ' 屬於最佳防守（淨賺 ' + mine + '）');
      else fail('重播的對手應手 ' + u + ' 不是最佳防守（' + mine + ' > ' + minV + '）');
    }
    sans.push(C.san(rs, m, legalNow));
    C.play(rs, m);
  }
  if (lineOk) {
    if (p.kind === 'mate') {
      const s = C.status(rs);
      if (s.result === 'checkmate') ok('重播 ' + sans.join(' ') + ' 結束於將死');
      else fail('重播結束時不是將死');
    } else {
      const gain = material(rs, side) - material(st, side);
      const q = quiesce(C.cloneState(rs), -Infinity, Infinity, 0, 0) * rs.turn * side - material(st, side);
      if (gain >= WIN_THRESHOLD && q >= WIN_THRESHOLD) ok('重播 ' + sans.join(' ') + ' 後淨賺 ' + gain + ' 分（之後吃子交換仍為 ' + q + '）');
      else fail('重播後淨賺不足：' + gain + '（吃子交換後 ' + q + '）');
    }
  }
  console.log(failures === before ? '  → 通過' : '  → 失敗');
}

console.log('\n搜尋節點數：' + nodes);
console.log(failures ? '\n結果：' + failures + ' 項失敗' : '\n結果：全部通過');
process.exit(failures ? 1 : 0);
