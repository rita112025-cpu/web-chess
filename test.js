// test.js — 棋規測試。執行方式：node test.js
// 包含 perft（驗證走法產生器）與各種特殊棋規與和局判定。
'use strict';
const C = require('./engine.js');

let passed = 0, failed = 0;
function check(name, ok, detail) {
  if (ok) { passed++; console.log('  ok   ' + name); }
  else { failed++; console.log('  FAIL ' + name + (detail !== undefined ? '  -> ' + detail : '')); }
}
function eq(name, actual, expected) { check(name, actual === expected, actual + ' !== ' + expected); }

// 以 e2e4 這樣的字串找出合法走法（升變可加第 5 碼，如 e7e8q）
const SQ = (n) => (8 - +n[1]) * 8 + (n.charCodeAt(0) - 97);
const PROMO = { q: 5, r: 4, b: 3, n: 2 };
function find(st, text) {
  const promo = text[4] ? PROMO[text[4]] : 0;
  return C.legalMoves(st).find((m) => m.from === SQ(text.slice(0, 2)) && m.to === SQ(text.slice(2, 4)) &&
    (!text[4] || m.promo === promo));
}
function playText(st, text) {
  const m = find(st, text);
  if (!m) throw new Error('非法走法 ' + text);
  C.play(st, m);
}

console.log('Perft');
const PERFT = [
  ['開局', 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', [20, 400, 8902, 197281]],
  ['Kiwipete（易位、釘住、過路兵）', 'r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1', [48, 2039, 97862]],
  ['局面 3（過路兵與將軍）', '8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - - 0 1', [14, 191, 2812, 43238]],
  ['局面 4（升變與易位）', 'r3k2r/Pppp1ppp/1b3nbN/nP6/BBP1P3/q4N2/Pp1P2PP/R2Q1RK1 w kq - 0 1', [6, 264, 9467]],
  ['局面 5', 'rnbq1k1r/pp1Pbppp/2p5/8/2B5/8/PPP1NnPP/RNBQK2R w KQ - 1 8', [44, 1486, 62379]]
];
for (const [name, fen, counts] of PERFT) {
  counts.forEach((n, i) => eq(name + ' 深度 ' + (i + 1), C.perft(C.fromFen(fen), i + 1), n));
}

console.log('王車易位');
{
  const st = C.fromFen('r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1');
  check('白方可短易位', !!find(st, 'e1g1'));
  check('白方可長易位', !!find(st, 'e1c1'));
  C.play(st, find(st, 'e1g1'));
  eq('短易位後城堡到 f1', st.board[SQ('f1')], 4);
  eq('短易位後國王到 g1', st.board[SQ('g1')], 6);
  const t = C.fromFen('r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1');
  C.play(t, find(t, 'e1c1'));
  eq('長易位後城堡到 d1', t.board[SQ('d1')], 4);
  eq('長易位後國王到 c1', t.board[SQ('c1')], 6);
  const a = C.fromFen('r3k2r/8/8/8/8/5r2/8/R3K2R w KQkq - 0 1'); // f3 黑城堡攻擊 f1
  check('經過被攻擊的格子不可短易位', !find(a, 'e1g1'));
  check('長易位不受 f 線影響', !!find(a, 'e1c1'));
  const c = C.fromFen('r3k2r/8/8/8/4r3/8/8/R3K2R w KQkq - 0 1'); // 被將軍
  check('被將軍時不可易位', !find(c, 'e1g1') && !find(c, 'e1c1'));
  const d = C.fromFen('r3k2r/8/8/8/8/8/8/R3K2R w - - 0 1');
  check('失去易位權後不可易位', !find(d, 'e1g1') && !find(d, 'e1c1'));
  const e = C.fromFen('r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1');
  playText(e, 'h1h2'); playText(e, 'a8a7'); playText(e, 'h2h1'); playText(e, 'a7a8');
  check('城堡動過再回原位也失去短易位', !find(e, 'e1g1'));
  check('另一側長易位仍保留', !!find(e, 'e1c1'));
  const f = C.fromFen('r3k2r/8/8/8/8/8/8/RN2K2R w KQkq - 0 1');
  check('中間有棋子不可長易位', !find(f, 'e1c1'));
}

console.log('吃過路兵');
{
  const st = C.fromFen('rnbqkbnr/ppp1pppp/8/8/3pP3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1');
  const m = find(st, 'd4e3');
  check('黑兵可吃過路兵', !!m && m.flag === 1);
  C.play(st, m);
  eq('被吃的白兵消失', st.board[SQ('e4')], 0);
  eq('黑兵落在 e3', st.board[SQ('e3')], -1);
  const t = C.newState();
  playText(t, 'e2e4'); playText(t, 'a7a6'); playText(t, 'e4e5'); playText(t, 'd7d5');
  check('對方兵剛走兩格時可吃過路兵', !!find(t, 'e5d6'));
  playText(t, 'h2h3'); playText(t, 'a6a5');
  check('過路兵機會只有一步', !find(t, 'e5d6'));
  // 過路兵會讓自己的國王暴露在橫線上時不合法
  const u = C.fromFen('8/8/8/K2pP2r/8/8/8/7k w - d6 0 1');
  check('過路兵暴露國王時不合法', !find(u, 'e5d6'));
}

console.log('兵升變');
{
  const st = C.fromFen('8/P6k/8/8/8/8/7K/8 w - - 0 1');
  const promos = C.legalMoves(st).filter((m) => m.from === SQ('a7'));
  eq('升變有四種選擇', promos.length, 4);
  check('包含皇后、城堡、主教、騎士', [5, 4, 3, 2].every((p) => promos.some((m) => m.promo === p)));
  C.play(st, find(st, 'a7a8n'));
  eq('升變為騎士', st.board[SQ('a8')], 2);
  const b = C.fromFen('1r6/P6k/8/8/8/8/7K/8 w - - 0 1');
  check('吃子升變', !!find(b, 'a7b8q'));
  const k = C.fromFen('8/7k/8/8/8/8/p6K/8 b - - 0 1');
  C.play(k, find(k, 'a2a1q'));
  eq('黑方升變為黑皇后', k.board[SQ('a1')], -5);
}

console.log('將軍、將死、逼和');
{
  const st = C.newState();
  ['f2f3', 'e7e5', 'g2g4', 'd8h4'].forEach((x) => playText(st, x));
  const s = C.status(st);
  check('愚者將死：白方被將死', s.over && s.result === 'checkmate' && s.check);
  const c = C.fromFen('4k3/8/8/8/8/8/8/R3K3 b - - 0 1');
  playText(c, 'e8e7');
  const r = C.fromFen('4k3/8/8/8/8/8/4r3/4K3 w - - 0 1');
  check('將軍狀態', C.status(r).check && !C.status(r).over);
  const stale = C.fromFen('7k/5Q2/6K1/8/8/8/8/8 b - - 0 1');
  const ss = C.status(stale);
  check('逼和', ss.over && ss.result === 'stalemate' && !ss.check);
  const pin = C.fromFen('4k3/4r3/8/8/8/8/4R3/4K3 w - - 0 1');
  check('被釘住的城堡不能離線', !find(pin, 'e2a2'));
}

console.log('和局判定');
{
  eq('50 步規則（99 半步未和）', C.status(C.fromFen('4k3/8/8/8/8/8/R7/4K3 w - - 99 80')).over, false);
  eq('50 步規則（100 半步和局）', C.status(C.fromFen('4k3/8/8/8/8/8/R7/4K3 w - - 100 80')).result, 'fifty');
  const st = C.fromFen('4k3/8/8/8/8/8/R7/4K3 w - - 0 1');
  const dance = ['a2a3', 'e8e7', 'a3a2', 'e7e8', 'a2a3', 'e8e7', 'a3a2'];
  dance.forEach((x) => playText(st, x));
  eq('第二次出現尚未和局', C.status(st).over, false);
  playText(st, 'e7e8');
  eq('三次重複局面', C.status(st).result, 'repetition');
  eq('王對王', C.status(C.fromFen('4k3/8/8/8/8/8/8/4K3 w - - 0 1')).result, 'insufficient');
  eq('王＋騎士對王', C.status(C.fromFen('4k3/8/8/8/8/8/8/3NK3 w - - 0 1')).result, 'insufficient');
  eq('王＋主教對王', C.status(C.fromFen('4k3/8/8/8/8/8/8/3BK3 w - - 0 1')).result, 'insufficient');
  eq('同色格主教對主教', C.status(C.fromFen('2b1k3/8/8/8/8/8/8/3BK3 w - - 0 1')).result, 'insufficient');
  eq('異色格主教不算子力不足', C.status(C.fromFen('3bk3/8/8/8/8/8/8/3BK3 w - - 0 1')).over, false);
  eq('有一個兵就不是子力不足', C.status(C.fromFen('4k3/8/8/8/8/8/P7/4K3 w - - 0 1')).over, false);
  eq('王＋雙騎士對王不自動判和', C.status(C.fromFen('4k3/8/8/8/8/8/8/2NNK3 w - - 0 1')).over, false);
}

console.log('悔棋與復原');
{
  const st = C.fromFen('r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1');
  const before = JSON.stringify(st);
  for (const m of C.legalMoves(st)) { C.make(st, m); C.unmake(st, m); }
  eq('make/unmake 不改變局面', JSON.stringify(st), before);
  const g = C.newState();
  const snaps = [];
  snaps.push(C.cloneState(g)); playText(g, 'e2e4');
  snaps.push(C.cloneState(g)); playText(g, 'e7e5');
  const restored = snaps.pop();
  eq('快照還原到黑方走之前', JSON.stringify(restored.board), JSON.stringify(C.fromFen('rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1').board));
  eq('快照還原後輪到黑方', restored.turn, -1);
}

console.log('隨機電腦');
{
  let allLegal = true;
  for (let i = 0; i < 300 && allLegal; i++) {
    const st = C.newState();
    for (let ply = 0; ply < 80; ply++) {
      const s = C.status(st);
      if (s.over) break;
      const m = C.randomMove(st);
      if (!s.moves.some((x) => x.from === m.from && x.to === m.to && x.promo === m.promo)) { allLegal = false; break; }
      C.play(st, m);
    }
  }
  check('隨機走子一定是合法走法（300 局隨機對弈）', allLegal);
  eq('無合法走法時回傳 null', C.randomMove(C.fromFen('7k/5Q2/6K1/8/8/8/8/8 b - - 0 1')), null);
}

console.log('\n通過 ' + passed + '，失敗 ' + failed);
process.exit(failed ? 1 : 0);
