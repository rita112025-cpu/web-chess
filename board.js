/*
 * board.js — 棋盤繪製（自由對弈與教學模式共用）
 * 只負責「把局面畫出來並回報點擊」，不含任何棋規或遊戲流程。
 */
(function (root) {
  'use strict';

  // 實心棋子符號；︎ 強制文字樣式，避免手機顯示成彩色 emoji
  const GLYPH = { 1: '♟', 2: '♞', 3: '♝', 4: '♜', 5: '♛', 6: '♚' };
  const NAME = { 1: '兵', 2: '騎士', 3: '主教', 4: '城堡', 5: '皇后', 6: '國王' };
  const glyph = (p) => GLYPH[Math.abs(p)] + '︎';
  const sideName = (s) => (s === 1 ? '白方' : '黑方');

  /*
   * 畫出棋盤到 el。o 的欄位：
   *   st        局面（需要 board 陣列）
   *   flipped   是否翻轉（黑方在下）
   *   selected  目前選取的格子（或 null）
   *   targets   Map：格子 → 'move' | 'capture'，顯示可走位置的圓點／圓圈
   *   last      最後一步 { from, to }
   *   checkSq   被將軍的國王所在格（或 -1）
   *   marks     Set：教學用的目標星號格
   *   danger    Set：教學用的危險（被攻擊）格
   *   onSquare  點擊回呼 (sq) => void
   */
  function draw(el, o) {
    el.innerHTML = '';
    const b = o.st.board;
    for (let i = 0; i < 64; i++) {
      const sq = o.flipped ? 63 - i : i;
      const r = sq >> 3, c = sq & 7, p = b[sq];
      const sqEl = document.createElement('button');
      sqEl.type = 'button';
      sqEl.className = 'sq ' + ((r + c) % 2 ? 'dark' : 'light');
      if (o.last && (sq === o.last.from || sq === o.last.to)) sqEl.classList.add('last');
      if (sq === o.selected) sqEl.classList.add('sel');
      if (sq === o.checkSq) sqEl.classList.add('check');
      if (o.targets && o.targets.has(sq)) sqEl.classList.add(o.targets.get(sq));
      if (o.danger && o.danger.has(sq)) sqEl.insertAdjacentHTML('beforeend', '<i class="dg"></i>');
      if (o.marks && o.marks.has(sq)) sqEl.insertAdjacentHTML('beforeend', '<i class="mk"></i>');
      if (p) sqEl.insertAdjacentHTML('beforeend', '<span class="pc ' + (p > 0 ? 'w' : 'b') + '">' + glyph(p) + '</span>');
      if ((i >> 3) === 7) sqEl.insertAdjacentHTML('beforeend', '<span class="coord f">' + 'abcdefgh'[c] + '</span>');
      if ((i & 7) === 0) sqEl.insertAdjacentHTML('beforeend', '<span class="coord r">' + (8 - r) + '</span>');
      const name = 'abcdefgh'[c] + (8 - r);
      sqEl.setAttribute('aria-label', name + (p ? ' ' + sideName(p > 0 ? 1 : -1) + NAME[Math.abs(p)] : ''));
      sqEl.dataset.sq = name;
      sqEl.onclick = () => o.onSquare(sq);
      el.appendChild(sqEl);
    }
  }

  // 升變選單（共用 #promo）：moves 是同一目標格的多個升變走法，選好後呼叫 onPick(move)
  function askPromo(moves, turn, onPick) {
    const box = document.getElementById('promoOpts');
    box.innerHTML = '';
    for (const m of moves) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.innerHTML = '<span class="pc ' + (turn === 1 ? 'w' : 'b') + '">' + glyph(m.promo) + '</span>';
      btn.setAttribute('aria-label', NAME[m.promo]);
      btn.onclick = () => { closePromo(); onPick(m); };
      box.appendChild(btn);
    }
    document.getElementById('promo').classList.add('show');
  }
  function closePromo() { document.getElementById('promo').classList.remove('show'); }

  root.Board = { draw, glyph, askPromo, closePromo, NAME, sideName };
})(window);
