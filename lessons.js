/*
 * lessons.js — 教學與挑戰關卡資料（純資料，不含畫面）
 *
 * 每個單元 { id, group, title, icon, intro, steps }，每個 step 是一個「練習局面 + 一步棋」：
 *   fen      預設練習局面（由引擎載入，白方先走）
 *   lock     只能移動這一格的棋子（教學時避免走錯棋子）；null 表示不限
 *   task     操作指示（短句）
 *   marks    要標示星號的目標格
 *   danger   true 時，標出國王周圍被攻擊的格子
 *   hints    true 時預設顯示可走位置
 *   success  (stAfter, move) => boolean，成功判定。一律根據「走完後的實際棋盤」判斷
 *   okMsg    成功時的說明
 *   failMsg  走了合法但不符合目標時的說明 (stAfter, move) => string
 *
 * 所有走法的合法性都由 engine.js 判定；這裡只描述「這一步算不算達成目標」。
 */
(function (root) {
  'use strict';
  const C = root.Chess || require('./engine.js');

  const sq = (name) => (8 - +name[1]) * 8 + (name.charCodeAt(0) - 97);
  const at = (st, name) => st.board[sq(name)];

  // 教學單元的共通成功條件：任何合法走法都算完成
  const anyMove = () => true;

  const PIECES = [
    {
      id: 'king', group: 'piece', title: '國王', icon: 6,
      intro: '國王是最重要的棋子：被將死就輸了。它每次只能走一格，方向不限，但不可以走進被對方攻擊的位置。',
      steps: [{
        fen: '7k/8/8/r7/4K3/8/8/8 w - - 0 1', lock: 'e4', hints: true, danger: true,
        task: '點一下綠色圓點，把國王走一格。紅色格子是黑城堡攻擊的範圍，不能進去。',
        success: anyMove, okMsg: '做得好！國王每次走一格，而且避開了被攻擊的格子。'
      }]
    },
    {
      id: 'queen', group: 'piece', title: '皇后', icon: 5,
      intro: '皇后是最強的棋子，可以沿直線、橫線、斜線走任意格數，但不能跳過其他棋子。',
      steps: [{
        fen: '8/7k/8/8/3Q4/8/8/K7 w - - 0 1', lock: 'd4', hints: true,
        task: '點一下任何一個圓點，讓皇后走過去。',
        success: anyMove, okMsg: '很好！皇后可以直走、橫走、斜走，想走幾格都可以。'
      }]
    },
    {
      id: 'rook', group: 'piece', title: '城堡', icon: 4,
      intro: '城堡只能走直線或橫線，格數不限，同樣不能跳過其他棋子。',
      steps: [{
        fen: '7k/8/8/8/3R4/8/8/K7 w - - 0 1', lock: 'd4', hints: true,
        task: '點一下任何一個圓點，讓城堡走過去。',
        success: anyMove, okMsg: '很好！城堡只走直線和橫線。'
      }]
    },
    {
      id: 'bishop', group: 'piece', title: '主教', icon: 3,
      intro: '主教只能走斜線，格數不限。每個主教永遠待在同一種顏色的格子上。',
      steps: [{
        fen: '8/7k/8/8/3B4/8/8/K7 w - - 0 1', lock: 'd4', hints: true,
        task: '點一下任何一個圓點，讓主教走過去。',
        success: anyMove, okMsg: '很好！主教只走斜線，而且永遠留在同一種顏色的格子上。'
      }]
    },
    {
      id: 'knight', group: 'piece', title: '騎士', icon: 2,
      intro: '騎士走「L 形」：先走兩格再轉彎走一格。它是唯一可以跳過其他棋子的棋子。',
      steps: [{
        fen: '7k/8/4p3/8/2PNP3/3P4/8/K7 w - - 0 1', lock: 'd4', hints: true,
        task: '騎士被自己的兵圍住了，但它可以跳出去！點一個圓點試試（圓圈表示可以吃子）。',
        success: anyMove, okMsg: '很好！騎士走 L 形，可以跳過周圍的棋子。'
      }]
    },
    {
      id: 'pawn', group: 'piece', title: '士兵', icon: 1,
      intro: '兵只能往前走：一般走一格，第一次可以走兩格；吃子時要「斜前方」吃，不能直吃。',
      steps: [{
        fen: '7k/8/8/8/8/3p4/4P3/K7 w - - 0 1', lock: 'e2', hints: true,
        task: '點一個圓點：可以直走一格、直走兩格，或是斜吃左前方的黑兵。',
        success: anyMove, okMsg: '很好！兵直走、斜吃，第一次還能一次走兩格。'
      }]
    }
  ];

  const SPECIAL = [
    {
      id: 'castle', group: 'special', title: '王車易位', icon: 6,
      intro: '國王和城堡都還沒動過、中間沒有棋子、國王沒被將軍也不經過被攻擊的格子時，國王可以朝城堡走兩格，城堡跳到國王另一側。',
      steps: [{
        fen: '4k3/8/8/8/8/8/8/R3K2R w KQ - 0 1', lock: 'e1', hints: true,
        task: '把國王走兩格（點 g1 或 c1），看看城堡怎麼跟著動。',
        success: (st) => (at(st, 'g1') === 6 && at(st, 'f1') === 4) || (at(st, 'c1') === 6 && at(st, 'd1') === 4),
        okMsg: '完成王車易位！國王走了兩格，城堡跳到它的另一側，一步棋同時保護國王又讓城堡上場。',
        failMsg: () => '這只是普通的國王走法。王車易位要把國王走「兩格」到 g1 或 c1。'
      }]
    },
    {
      id: 'enpassant', group: 'special', title: '吃過路兵', icon: 1,
      intro: '對方的兵第一次走兩格、停在你的兵旁邊時，你可以「立刻」斜走到它跳過的格子，把它吃掉，就像它只走了一格。',
      steps: [{
        fen: '4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 1', lock: 'e5', hints: true,
        task: '黑兵剛從 d7 走兩格到 d5。把你的兵斜走到 d6，吃掉它。',
        success: (st) => at(st, 'd6') === 1 && at(st, 'd5') === 0,
        okMsg: '完成吃過路兵！黑兵被吃掉了，雖然它不在你落腳的格子上。這個機會只有對方剛走兩格的那一步可以用。',
        failMsg: () => '這是普通的直走。吃過路兵要把兵斜走到 d6。'
      }]
    },
    {
      id: 'promotion', group: 'special', title: '士兵升變', icon: 1,
      intro: '兵走到對方底線時必須升變，可以變成皇后、城堡、主教或騎士（通常選皇后最強）。',
      steps: [{
        fen: '4k3/P7/8/8/8/8/8/4K3 w - - 0 1', lock: 'a7', hints: true,
        task: '把兵走到 a8，然後選一個想升變的棋子。',
        success: (st) => { const p = at(st, 'a8'); return p > 1; },
        okMsg: '升變成功！你的兵變成了更強的棋子。',
        failMsg: () => '兵還沒有升變，請走到 a8。'
      }]
    },
    {
      id: 'checkmate', group: 'special', title: '將軍與將死', icon: 6,
      intro: '攻擊對方國王叫「將軍」，對方必須立刻化解。如果對方怎麼走都化解不了，就是「將死」，你獲勝。',
      steps: [
        {
          fen: '4k3/8/8/8/8/8/8/R3K3 w - - 0 1', lock: 'a1', hints: false,
          task: '第 1 步：用城堡走一步將軍黑王（e8）。城堡要能攻擊到 e8。',
          success: (st) => C.inCheck(st) && !C.status(st).over,
          okMsg: '將軍！黑王被攻擊了，但它還能走開（例如 d7、e7、f7），所以還不是將死。',
          failMsg: () => '這一步沒有攻擊到黑王。想一想：城堡走到哪裡，可以沿著線攻擊 e8？'
        },
        {
          fen: 'r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4', lock: 'h5', hints: false,
          task: '第 2 步：白皇后和主教一起瞄準黑兵 f7。找出能直接將死的一步！',
          success: (st) => C.status(st).result === 'checkmate',
          okMsg: '將死！皇后吃掉 f7 並將軍，有白主教保護，黑王無處可逃——這就是著名的「學者將死」。',
          failMsg: () => '這步沒有將死，黑方還有辦法應對。提示：f7 只有黑王在守，而白主教正盯著 f7。'
        }
      ]
    }
  ];

  const CHALLENGES = [
    {
      id: 'c1', group: 'challenge', title: '用城堡吃子', icon: 4,
      intro: '城堡沿直線或橫線走。',
      steps: [{
        fen: '7k/3p4/8/8/3R2b1/8/8/4K3 w - - 0 1', marks: ['d7'],
        task: '用城堡吃掉有星號的黑兵（d7）。',
        success: (st) => at(st, 'd7') === 4,
        okMsg: '城堡沿著 d 線直走，吃掉了目標。',
        failMsg: () => '這步合法，但沒有吃到有星號的黑兵。城堡要沿 d 線往上吃它。'
      }]
    },
    {
      id: 'c2', group: 'challenge', title: '主教走斜線', icon: 3,
      intro: '主教只走斜線。',
      steps: [{
        fen: '4k3/8/8/8/8/8/8/2B1K3 w - - 0 1', marks: ['f4'],
        task: '用主教走到有星號的 f4。',
        success: (st) => at(st, 'f4') === 3,
        okMsg: '主教沿著 c1–f4 這條斜線走過去了。',
        failMsg: () => '這步合法，但沒有走到有星號的 f4。從 c1 沿右上斜線數三格。'
      }]
    },
    {
      id: 'c3', group: 'challenge', title: '騎士跳過阻擋', icon: 2,
      intro: '騎士可以跳過其他棋子。',
      steps: [{
        fen: '4k3/8/8/8/8/8/PPPP4/1N2K3 w - - 0 1', marks: ['c3'],
        task: '騎士被兵擋住了。跳到有星號的 c3。',
        success: (st) => at(st, 'c3') === 2,
        okMsg: '騎士直接跳過了前面的兵。',
        failMsg: () => '這步合法，但沒有走到有星號的 c3。'
      }]
    },
    {
      id: 'c4', group: 'challenge', title: '找安全格', icon: 6,
      intro: '國王不能走進被攻擊的格子。',
      steps: [{
        fen: '7k/b7/8/r7/4K3/8/8/8 w - - 0 1', hints: false,
        task: '黑城堡和黑主教正在攻擊某些格子。把國王移到沒有被攻擊的安全格。',
        success: (st) => st.board[sq('e4')] === 0 && C.findKing(st.board, 1) >= 0 &&
          !C.isAttacked(st.board, C.findKing(st.board, 1), -1),
        okMsg: '你找到了沒有被攻擊的安全格。',
        failMsg: () => '請移動國王到安全的格子。'
      }]
    },
    {
      id: 'c5', group: 'challenge', title: '解除將軍', icon: 6,
      intro: '被將軍時必須化解。',
      steps: [{
        fen: '4r1k1/8/8/8/8/2B5/8/4K3 w - - 0 1', hints: false,
        task: '白王被黑城堡將軍了！走一步讓國王脫離攻擊（可以移開國王，或讓別的棋子擋住）。',
        success: (st) => C.findKing(st.board, 1) >= 0 && !C.isAttacked(st.board, C.findKing(st.board, 1), -1),
        okMsg: '國王不再被攻擊了。解除將軍可以移開國王、擋住路線，或吃掉攻擊者。',
        failMsg: () => '這步沒有解除將軍。'
      }]
    },
    {
      id: 'c6', group: 'challenge', title: '一步將死', icon: 5,
      intro: '找出將死的一步。',
      steps: [{
        fen: '6k1/5ppp/8/8/8/8/5PPP/R5K1 w - - 0 1', hints: false,
        task: '黑王被自己的兵擋住了退路。用城堡走一步將死黑王！',
        success: (st) => C.status(st).result === 'checkmate',
        okMsg: '城堡走到底線將死——黑王被自己的兵堵住了。這叫「底線將死」。',
        failMsg: () => '這步沒有將死，黑方還能應對。想想城堡走到哪裡能攻擊黑王，而且黑王無處可逃？'
      }]
    }
  ];

  const api = { PIECES, SPECIAL, CHALLENGES, LEARN: PIECES.concat(SPECIAL), sq };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Lessons = api;
})(typeof window !== 'undefined' ? window : this);
