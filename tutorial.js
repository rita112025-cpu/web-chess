/*
 * tutorial.js — 「學習棋子」與「練習挑戰」的畫面與流程
 * 單元資料來自 lessons.js，單步邏輯來自 session.js，棋盤由 board.js 繪製。
 * 這裡有自己的局面（session），與自由對弈（app.js）完全分開。
 */
(function () {
  'use strict';
  const C = window.Chess;
  const $ = (id) => document.getElementById(id);

  const GROUPS = {
    learn: { title: '學習棋子', list: window.Lessons.LEARN, next: '下一課', done: '完成' },
    challenge: { title: '練習挑戰', list: window.Lessons.CHALLENGES, next: '下一關', done: '過關' }
  };

  let kind = 'learn';   // 'learn' | 'challenge'
  let li = 0;           // 目前單元索引
  let si = 0;           // 目前單元內的步驟索引
  let session = null;   // 目前的練習 session
  let hints = false;    // 是否顯示可走位置
  let feedback = null;  // { type: 'ok' | 'warn', text }
  const completed = { learn: new Set(), challenge: new Set() };

  const lesson = () => GROUPS[kind].list[li];
  const step = () => lesson().steps[si];

  // 開啟某個群組（從首頁進入）
  function open(k, startIndex) {
    kind = k;
    $('tTitleBar').textContent = GROUPS[k].title;
    load(startIndex || 0);
  }

  // 載入第 index 個單元的第一步
  function load(index) {
    li = index;
    si = 0;
    startStep();
  }

  // 重設目前步驟：重新由 FEN 建立局面，所以重試一定回到乾淨的初始狀態
  function startStep() {
    session = window.Session.createSession(step());
    hints = !!step().hints;
    feedback = null;
    window.Board.closePromo();
    render();
  }

  function onSquare(sq) {
    const r = session.tap(sq);
    if (r.kind === 'warn') feedback = { type: 'warn', text: r.msg };
    else if (r.kind === 'moved') finishMove(r);
    else if (r.kind === 'promo') return window.Board.askPromo(r.moves, session.st.turn, (m) => finishMove(session.play(m)));
    else if (r.kind === 'select' || r.kind === 'deselect') feedback = null;
    render();
  }

  function finishMove(r) {
    feedback = { type: r.success ? 'ok' : 'warn', text: r.msg };
    if (r.success && isLastStep()) completed[kind].add(lesson().id);
    render();
  }

  const isLastStep = () => si === lesson().steps.length - 1;
  const isLastLesson = () => li === GROUPS[kind].list.length - 1;

  // 下一步／下一課
  function next() {
    if (session.phase !== 'success') return;
    if (!isLastStep()) { si++; startStep(); return; }
    if (!isLastLesson()) load(li + 1);
  }

  function render() {
    const g = GROUPS[kind], les = lesson(), stp = step();

    // 單元導覽：點數字可跳關
    const nav = $('tNav');
    nav.innerHTML = '';
    g.list.forEach((l, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'chip' + (i === li ? ' on' : '') + (completed[kind].has(l.id) ? ' done' : '');
      b.textContent = i + 1;
      b.setAttribute('aria-label', '第 ' + (i + 1) + (kind === 'learn' ? ' 課：' : ' 關：') + l.title);
      b.onclick = () => load(i);
      nav.appendChild(b);
    });

    const stepNote = les.steps.length > 1 ? '（第 ' + (si + 1) + '／' + les.steps.length + ' 步）' : '';
    $('tTitle').textContent = (kind === 'learn' ? '第 ' + (li + 1) + ' 課：' : '第 ' + (li + 1) + ' 關：') + les.title + stepNote;
    $('tIntro').textContent = les.intro;
    $('tTask').textContent = '👉 ' + stp.task;

    window.Board.draw($('tBoard'), {
      st: session.st,
      flipped: false,
      selected: session.selected,
      targets: hints ? session.targets() : new Map(),
      last: session.last,
      checkSq: C.inCheck(session.st) ? session.st.board.indexOf(6 * session.st.turn) : -1,
      marks: session.marks,
      danger: session.danger,
      onSquare
    });

    const fb = $('tFeedback');
    fb.hidden = !feedback;
    if (feedback) {
      fb.className = 'feedback ' + feedback.type;
      const done = feedback.type === 'ok';
      const title = done ? (isLastStep() ? '✓ ' + g.done + '！' : '✓ 這一步完成了') : '再想一想';
      fb.innerHTML = '';
      const h = document.createElement('strong');
      h.textContent = title;
      const p = document.createElement('div');
      p.textContent = feedback.text;
      fb.append(h, p);
    }

    $('tHint').textContent = hints ? '隱藏提示' : '顯示提示';
    $('tHint').disabled = session.phase !== 'play';
    const ok = session.phase === 'success';
    const more = !isLastStep() || !isLastLesson();
    $('tNext').textContent = !isLastStep() ? '下一步' : g.next;
    $('tNext').disabled = !ok || !more;
    $('tNext').classList.toggle('primary', ok && more);
    $('tRetry').classList.toggle('primary', session.phase === 'fail');
    $('tFinish').hidden = !(ok && !more);
    $('tFinish').textContent = completed[kind].size === g.list.length ? '🎉 全部' + g.done + '！回首頁' : '回首頁';
  }

  $('tRetry').onclick = startStep;
  $('tNext').onclick = next;
  $('tHint').onclick = () => { hints = !hints; render(); };

  window.Tutorial = { open };
})();
