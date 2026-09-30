// ====== 第３弾 定義クイズ：テスト用5問（小２語彙ルール） ======
const QUESTIONS = [
  {
    type: "choice",
    text: "三角形の せつめいとして ただしいのは どれですか。",
    choices: [
      "３本の 直線で できている 図形",
      "４つの ちょう点を もつ 図形",
      "丸い 形の 図形"
    ],
    answer: 1
  },
  {
    type: "choice",
    text: "三角形の せつめいとして ただしいのは どれですか。",
    choices: [
      "４本の 直線で できている 図形",
      "３つの ちょう点を もつ 図形",
      "かどが ５つある 形の 図形"
    ],
    answer: 2
  },
  {
    type: "choice",
    text: "三角形の せつめいとして ただしいのは どれですか。",
    choices: [
      "４本の 直線で できている 図形",
      "２つの ちょう点を もつ 図形",
      "かどが ３つある 形の 図形"
    ],
    answer: 3
  },
  {
    type: "fill",
    text: "三角形は（　）本の 直線(ちょくせん)で できています。",
    choices: ["３", "４", "５"],
    answer: "３"
  },
  {
    type: "fill",
    text: "三角形は（　）本の 辺(へん)で できています。",
    choices: ["２", "３", "４"],
    answer: "３"
  },
  {
    type: "fill",
    text: "三角形には（　）この かどが あります。",
    choices: ["１", "２", "３"],
    answer: "３"
  },
  {
    type: "fill",
    text: "三角形には（　）この ちょう点が あります。",
    choices: ["１", "３", "５"],
    answer: "３"
  },
  {
    type: "choice",
    text: "三角形の 辺は 何本ですか。",
    choices: ["２本", "３本", "４本"],
    answer: 2
  },
  {
    type: "choice",
    text: "三角形の ちょう点の 数は いくつですか。",
    choices: ["２つ", "３つ", "４つ"],
    answer: 2
  },
  {
    type: "choice",
    text: "三角形の かどの 数は いくつですか。",
    choices: ["１つ", "２つ", "３つ"],
    answer: 3
  },
  {
    type: "choice",
    text: "四角形の せつめいとして ただしいのは どれですか。",
    choices: [
      "３本の 直線で できている 図形",
      "４つの ちょう点を もつ 図形",
      "丸い 形の 図形"
    ],
    answer: 2
  },
  {
    type: "choice",
    text: "四角形の せつめいとして ただしいのは どれですか。",
    choices: [
      "４本の 直線で できている 図形",
      "３つの ちょう点を もつ 図形",
      "かどが ５つある 形の 図形"
    ],
    answer: 1
  },
  {
    type: "choice",
    text: "四角形の せつめいとして ただしいのは どれですか。",
    choices: [
      "３本の 直線で できている 図形",
      "２つの ちょう点を もつ 図形",
      "かどが ４つある 形の 図形"
    ],
    answer: 3
  },
  {
    type: "fill",
    text: "四角形は（　）本の 直線(ちょくせん)で できています。",
    choices: ["３", "４", "５"],
    answer: "４"
  },
  {
    type: "fill",
    text: "四角形は（　）本の 辺(へん)で できています。",
    choices: ["４", "５", "６"],
    answer: "４"
  },
  {
    type: "fill",
    text: "四角形には（　）この かどが あります。",
    choices: ["３", "４", "５"],
    answer: "４"
  },
  {
    type: "fill",
    text: "四角形には（　）この ちょう点が あります。",
    choices: ["２", "４", "６"],
    answer: "４"
  },
  {
    type: "choice",
    text: "四角形の 辺は 何本ですか。",
    choices: ["３本", "４本", "５本"],
    answer: 2
  },
  {
    type: "choice",
    text: "四角形の ちょう点の 数は いくつですか。",
    choices: ["４つ", "５つ", "６つ"],
    answer: 1
  },
  {
    type: "choice",
    text: "四角形の かどの 数は いくつですか。",
    choices: ["２つ", "３つ", "４つ"],
    answer: 3
  },
];
window.QUESTIONS = QUESTIONS;
