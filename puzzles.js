// 「猜下一步」原創戰術題庫（固定順序）。走法使用 UCI 格式（例：d4g7）。
// solutions：所有能達成題目目標的走法；line：解答與重播用的主變化（第一步必須在 solutions 內）。
// 每題的局面、正解與重播走法由 tests/verify-puzzles.js 以 engine.js 驗證。
// 分數以兵=1、騎士=3、主教=3、城堡=5、后=9 計。
(function (root) {
  'use strict';
  const PUZZLES = [
    {
      id: 'mate-diagonal',
      kind: 'mate',
      theme: '一步將死',
      title: '長斜線的終點',
      goal: '一步將死',
      fen: '4r1k1/pp3p1p/2q3p1/8/3Q4/8/PB3PPP/6K1 w - - 0 1',
      hint1: '白后和 b2 的主教站在同一條長斜線上。看看黑王旁邊，哪些格子同時被這兩個棋子照顧到。',
      hint2: '要移動的是 d4 的白后。',
      hintSq: 'd4',
      solutions: ['d4g7', 'd4h8'],
      line: ['d4g7'],
      explain: '白后沿 a1–h8 長斜線衝到 g7 或 h8 都是將死：后由 b2 主教保護，黑王吃不回去，f7、h7 被自己的兵堵住，f8 與 h8 也都在白后控制下。兩步都會被接受。'
    },
    {
      id: 'mate-smother',
      kind: 'mate',
      theme: '一步將死',
      title: '被自己人困住的國王',
      goal: '一步將死',
      fen: '3r2k1/pp3ppp/1q6/3Q4/6n1/2P5/PP4PP/2B3RK b - - 0 1',
      hint1: '白王四周的 g1、g2、h2 全被白方自己的棋子佔住。找一步白方擋不了、也吃不掉的將軍。吃掉白后很誘人，但題目要的是將死。',
      hint2: '要移動的是 g4 的黑騎士。',
      hintSq: 'g4',
      solutions: ['g4f2'],
      line: ['g4f2'],
      explain: '…Nf2# 是悶殺：騎士將軍無法被阻擋，f2 也沒有白子能吃；白王的 g1、g2、h2 全被自己的城堡和兵佔住，無處可逃。…Rxd5 雖然能吃后，但不是將死。'
    },
    {
      id: 'fork-knight',
      kind: 'material',
      theme: '雙重攻擊',
      title: '騎士的叉擊',
      goal: '找出能贏子的走法',
      fen: 'r2q4/pb4kp/1pn3p1/5pN1/8/8/PPQ2PPP/4R1K1 w - - 0 1',
      hint1: '黑王和黑后都站在騎士跳得到的距離。看看哪個格子能同時威脅這兩個目標，而且黑方吃不掉那個格子上的棋子。',
      hint2: '要移動的是 g5 的白騎士。',
      hintSq: 'g5',
      solutions: ['g5e6'],
      line: ['g5e6', 'g7f6', 'e6d8', 'a8d8'],
      explain: 'Ne6+ 同時將軍並攻擊 d8 黑后。黑方必須先處理將軍，下一步白方就用騎士吃后。即使黑方用城堡吃回騎士，白方仍以騎士換后，淨賺 6 分子力。'
    },
    {
      id: 'fork-pawn',
      kind: 'material',
      theme: '雙重攻擊',
      title: '小兵的雙重攻擊',
      goal: '找出能贏子的走法',
      fen: '2b2rk1/ppp2ppp/2n5/3pp3/8/3B1N2/PPP2PPP/5RK1 b - - 0 1',
      hint1: '白方的主教和騎士並排站在第三橫列。看看哪個格子能讓一個小兵同時威脅它們兩個。',
      hint2: '要移動的是 e5 的黑兵。',
      hintSq: 'e5',
      solutions: ['e5e4'],
      line: ['e5e4', 'd3e4', 'd5e4', 'f3d2'],
      explain: '…e4 同時攻擊 d3 主教與 f3 騎士。e4 兵有 d5 兵保護，白方用主教吃兵後會被 d5 兵吃回，騎士仍被攻擊而必須撤退；不論怎麼應對，白方都會用一個輕子換一個兵，黑方淨賺 2 分。'
    },
    {
      id: 'skewer-rook',
      kind: 'material',
      theme: '串擊',
      title: '直線上的串擊',
      goal: '找出能贏子的走法',
      fen: '2r1q3/8/p5p1/1p2kp1p/8/2N3P1/PP3PKP/R7 w - - 0 1',
      hint1: '黑王和黑后排在同一條直線上，中間沒有東西。從國王這一側將軍，國王讓開之後，後面那個子就露出來了。',
      hint2: '要移動的是 a1 的白城堡。',
      hintSq: 'a1',
      solutions: ['a1e1'],
      line: ['a1e1', 'e5d6', 'e1e8', 'c8e8'],
      explain: 'Re1+ 是串擊：黑王在 e 線上被將軍，黑方沒有棋子能擋在中間，國王只能離開 e 線，後面的 e8 黑后就被白城堡吃掉。黑方用城堡吃回後，白方仍以城堡換后，淨賺 4 分。'
    },
    {
      id: 'pin-queen',
      kind: 'material',
      theme: '牽制',
      title: '釘住白后',
      goal: '找出能贏子的走法',
      fen: 'r2q1rk1/1pp2ppp/2nbp3/p2p4/2PP4/4PN2/PP1Q1PPP/R3KB1R b - - 0 1',
      hint1: '白后和白王在同一條斜線上，中間只隔一個空格。想想哪個棋子能站上這條斜線，而且有人保護它。',
      hint2: '要移動的是 d6 的黑主教。',
      hintSq: 'd6',
      solutions: ['d6b4'],
      line: ['d6b4', 'd2b4', 'a5b4'],
      explain: '…Bb4 把白后釘在白王前面：后不能離開這條斜線，否則白王會被將軍。主教有 a5 兵保護，白后吃主教就會被兵吃回；白方怎麼應對都至少失去后換一個主教，黑方淨賺 6 分。'
    }
  ];
  if (typeof module !== 'undefined' && module.exports) module.exports = PUZZLES;
  else root.PUZZLES = PUZZLES;
})(typeof window !== 'undefined' ? window : this);
