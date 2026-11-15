// tutorial.test.js — 教學與挑戰測試。執行方式：node tutorial.test.js
// 以 session.js（教學邏輯）搭配 engine.js 驗證：每個單元可完成、錯誤有解釋、非法走法不改變棋盤、重試會重設。
'use strict';
const C = require('./engine.js');
const L = require('./lessons.js');
const S = require('./session.js');

let passed = 0, failed = 0;
function check(name, ok, detail) {
  if (ok) { passed++; console.log('  ok   ' + name); }
  else { failed++; console.log('  FAIL ' + name + (detail !== undefined ? '  -> ' + detail : '')); }
}
const sq = L.sq;
const find = (id) => L.PIECES.concat(L.SPECIAL, L.CHALLENGES).find((l) => l.id === id);
const fresh = (id, si) => S.createSession(find(id).steps[si || 0]);
const boardOf = (s) => JSON.stringify(s.st.board) + s.st.turn;
// 依序點擊格子，回傳最後一次的結果
function taps(s, ...names) {
  let r;
  for (const n of names) r = s.tap(sq(n));
  return r;
}

console.log('單元資料');
check('6 種棋子單元', L.PIECES.length === 6);
check('4 個特殊規則單元', L.SPECIAL.length === 4);
check('至少 6 個挑戰關卡', L.CHALLENGES.length >= 6);
const all = L.PIECES.concat(L.SPECIAL, L.CHALLENGES);
check('單元 id 不重複', new Set(all.map((l) => l.id)).size === all.length);
check('每個步驟的初始局面合法且未結束', all.every((l) => l.steps.every((st) => {
  const s = S.createSession(st);
  // 有合法走法、不是將死／逼和（單王加主教的練習局面屬子力不足，但不影響教學）
  const res = C.status(s.st).result;
  return s.moves.length > 0 && res !== 'checkmate' && res !== 'stalemate';
})));
check('挑戰一開始不會自動算成功（成功必須走出對的棋）', L.CHALLENGES.every((l) => l.steps.every((st) => !st.success(C.fromFen(st.fen)))));

console.log('六種棋子教學');
for (const id of ['king', 'queen', 'rook', 'bishop', 'knight', 'pawn']) {
  const s = fresh(id);
  const targets = s.targets();
  check(id + '：一開始就顯示移動範圍（有可走格）', targets.size > 0 && s.selected === s.lock);
  // 找一個非法目標：不是可走格、也不是自己的棋子
  let bad = -1;
  for (let i = 0; i < 64; i++) if (!targets.has(i) && s.st.board[i] * s.st.turn <= 0 && i !== s.selected) { bad = i; break; }
  const before = boardOf(s);
  const r = s.tap(bad);
  check(id + '：點非法格 → 橘色說明且棋盤不變', r.kind === 'warn' && r.msg.length >= 6 && boardOf(s) === before && s.phase === 'play', r.msg);
  const first = [...targets.keys()][0];
  const ok = s.tap(first);
  check(id + '：點合法格 → 成功', ok.kind === 'moved' && ok.success && s.phase === 'success' && ok.msg.length > 5);
  check(id + '：成功後不再接受點擊', s.tap(first).kind === 'ignore');
}

console.log('錯誤說明內容');
{
  const msg = (id, from, to) => { const s = fresh(id); return S.explainIllegal(s.st, sq(from), sq(to)); };
  check('國王走進被攻擊格', /攻擊/.test(msg('king', 'e4', 'e5')));
  check('國王走兩格', /一格/.test(msg('king', 'e4', 'e6')));
  check('皇后走 L 形', /直線、橫線或斜線/.test(msg('queen', 'd4', 'e6')));
  check('城堡走斜線', /不能走斜線/.test(msg('rook', 'd4', 'f6')));
  check('主教走直線', /只能走斜線/.test(msg('bishop', 'd4', 'd6')));
  check('騎士走直線', /L 形/.test(msg('knight', 'd4', 'd6')));
  check('走到自己的棋子上', /自己的棋子/.test(msg('knight', 'd4', 'c4')));
  check('兵後退', /往前/.test(msg('pawn', 'e2', 'e1')));
  check('兵斜走到空格', /斜著吃/.test(msg('pawn', 'e2', 'f3')));
  check('兵走三格', /一格|兩格/.test(msg('pawn', 'e2', 'e5')));
  const blocked = S.explainIllegal(C.fromFen('4k3/8/8/8/R2p3K/8/8/8 w - - 0 1'), sq('a4'), sq('g4'));
  check('城堡被擋住', /擋住/.test(blocked), blocked);
  const pinned = S.explainIllegal(C.fromFen('4r2k/8/8/8/8/8/4B3/4K3 w - - 0 1'), sq('e2'), sq('d3'));
  check('被釘住的棋子', /國王會被攻擊/.test(pinned), pinned);
}

console.log('特殊規則教學');
{
  let s = fresh('castle');
  let r = taps(s, 'g1');
  check('王車易位（短）成功', r.success && s.st.board[sq('g1')] === 6 && s.st.board[sq('f1')] === 4);
  s = fresh('castle');
  r = taps(s, 'c1');
  check('王車易位（長）成功', r.success && s.st.board[sq('c1')] === 6 && s.st.board[sq('d1')] === 4);
  s = fresh('castle');
  r = taps(s, 'd1');
  check('國王只走一格不算易位，且有說明', r.kind === 'moved' && !r.success && s.phase === 'fail' && /兩格/.test(r.msg));

  s = fresh('enpassant');
  r = taps(s, 'd6');
  check('吃過路兵成功（黑兵被移除）', r.success && s.st.board[sq('d5')] === 0 && s.st.board[sq('d6')] === 1);
  s = fresh('enpassant');
  r = taps(s, 'e6');
  check('直走 e6 不算吃過路兵', r.kind === 'moved' && !r.success && s.st.board[sq('d5')] === -1);

  s = fresh('promotion');
  r = taps(s, 'a8');
  check('升變需要選擇（4 種）', r.kind === 'promo' && r.moves.length === 4);
  check('選擇前棋盤未改變', s.st.board[sq('a7')] === 1 && s.phase === 'play');
  const rook = r.moves.find((m) => m.promo === 4);
  r = s.play(rook);
  check('升變為城堡成功', r.success && s.st.board[sq('a8')] === 4);

  s = fresh('checkmate', 0);
  r = taps(s, 'a8');
  check('將軍（步驟 1）成功', r.success && C.inCheck(s.st) && !C.status(s.st).over);
  s = fresh('checkmate', 0);
  r = taps(s, 'a2');
  check('步驟 1 沒將軍 → 失敗並說明', !r.success && s.phase === 'fail' && r.msg.length > 5);
  s = fresh('checkmate', 1);
  r = taps(s, 'f7');
  check('將死（步驟 2）成功，由引擎判定', r.success && C.status(s.st).result === 'checkmate');
  s = fresh('checkmate', 1);
  r = taps(s, 'h4');
  check('步驟 2 走 Qh4 沒將死 → 失敗', !r.success && s.phase === 'fail');
}

console.log('練習挑戰');
{
  const run = (id, from, to) => { const s = fresh(id); const r = taps(s, from, to); return { s, r }; };
  let t = run('c1', 'd4', 'd7');
  check('1 城堡吃指定棋子：成功', t.r.success && t.s.st.board[sq('d7')] === 4);
  t = run('c1', 'd4', 'g4');
  check('1 吃到別的棋子：失敗並說明', !t.r.success && t.r.kind === 'moved' && /d7|黑兵/.test(t.r.msg));
  t = run('c1', 'd4', 'e5');
  check('1 城堡斜走：非法，棋盤不變', t.r.kind === 'warn' && t.s.st.board[sq('d4')] === 4 && /斜線/.test(t.r.msg), t.r.msg);

  t = run('c2', 'c1', 'f4');
  check('2 主教沿斜線到 f4：成功', t.r.success);
  t = run('c2', 'c1', 'd2');
  check('2 主教走到別的斜線格：失敗', !t.r.success && t.r.kind === 'moved');
  t = run('c2', 'c1', 'c3');
  check('2 主教走直線：非法', t.r.kind === 'warn' && t.s.st.board[sq('c1')] === 3);

  t = run('c3', 'b1', 'c3');
  check('3 騎士跳到 c3：成功', t.r.success && t.s.st.board[sq('c3')] === 2);
  t = run('c3', 'b1', 'a3');
  check('3 騎士跳到 a3：失敗（不是目標）', !t.r.success && t.r.kind === 'moved');
  t = run('c3', 'b1', 'b3');
  check('3 騎士直走：非法', t.r.kind === 'warn' && t.s.st.board[sq('b1')] === 2);

  for (const to of ['d3', 'f3', 'f4']) {
    t = run('c4', 'e4', to);
    check('4 國王走到安全格 ' + to + '：成功', t.r.success);
  }
  for (const to of ['e5', 'd4', 'e3', 'd5']) {
    t = run('c4', 'e4', to);
    check('4 國王走到被攻擊格 ' + to + '：非法且棋盤不變', t.r.kind === 'warn' && t.s.st.board[sq('e4')] === 6 && /攻擊/.test(t.r.msg), t.r.msg);
  }
  const c4 = fresh('c4');
  check('4 預設不顯示危險格（讓使用者自己找）', c4.danger.size === 0);

  t = run('c5', 'e1', 'd1');
  check('5 國王走開解除將軍：成功', t.r.success);
  t = run('c5', 'c3', 'e5');
  check('5 主教擋住：成功', t.r.success && t.s.st.board[sq('e5')] === 3);
  t = run('c5', 'e1', 'e2');
  check('5 仍在將軍線上：非法且說明將軍', t.r.kind === 'warn' && /將軍|攻擊/.test(t.r.msg) && t.s.st.board[sq('e1')] === 6, t.r.msg);
  t = run('c5', 'c3', 'b4');
  check('5 沒解除將軍的棋：非法', t.r.kind === 'warn' && /將軍/.test(t.r.msg), t.r.msg);

  t = run('c6', 'a1', 'a8');
  check('6 一步將死：成功', t.r.success && C.status(t.s.st).result === 'checkmate');
  t = run('c6', 'a1', 'a2');
  check('6 沒將死：失敗', !t.r.success && t.s.phase === 'fail');
  t = run('c6', 'a1', 'a7');
  check('6 城堡到 a7 沒將死：失敗', !t.r.success);
}

console.log('重試與隔離');
{
  const s = fresh('c3');
  const init = boardOf(s);
  taps(s, 'b1', 'a3');
  check('失敗後局面已改變', boardOf(s) !== init && s.phase === 'fail');
  check('失敗後不再接受點擊', s.tap(sq('c3')).kind === 'ignore');
  const retry = fresh('c3');
  check('重試：重新建立 session，局面回到初始', boardOf(retry) === init && retry.phase === 'play' && retry.last === null);
  check('重試與舊 session 互不影響', boardOf(s) !== boardOf(retry));
  // 教學 session 有自己的局面，不會碰到引擎共用狀態
  const g = C.newState();
  const gBefore = JSON.stringify(g);
  taps(fresh('c6'), 'a1', 'a8');
  check('教學操作不影響一般對局局面', JSON.stringify(g) === gBefore);
  const lockedPiece = fresh('king');
  const r = lockedPiece.tap(sq('a5')); // 點到黑城堡
  check('鎖定單元：點其他棋子被擋下並說明', r.kind === 'warn' && lockedPiece.selected === lockedPiece.lock);
}

console.log('\n通過 ' + passed + '，失敗 ' + failed);
process.exit(failed ? 1 : 0);
