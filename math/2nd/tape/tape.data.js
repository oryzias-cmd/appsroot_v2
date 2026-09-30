// tape.data.js
// 形式：window.TAPE_DATA = [ ... ];
// prompt: (string|number)[] …… number だけボタン化
// boxPos: "top" | "left" | "right"

window.TAPE_DATA = [
  {
    id: "001",
    boxPos: "top",
    prompt: [
      "ジュースが何本(なんぼん)かあります。", 26,
      "本(ほん)くばったので、のこりが", 8,
      "本(ほん)になりました。\nジュースは、はじめに何本(なんぼん)ありましたか。"
    ],
    tape: { top: "box", bottom: [26, 8] },
    reveal: [
      { type: "boxEq", text: "□ － 26 ＝ 8" },
      { type: "solveEq", text: "26 ＋ 8 ＝ 34" },
      { type: "answer", text: "34本(ほん)" }
    ]
  },

  {
    id: "002",
    boxPos: "right",
    prompt: [
      "ぜんぶで", 28,
      "こです。そのうち", 11,
      "こつかいました。\nのこりは何こですか。"
    ],
    tape: { top: 28, bottom: [11, "box"] },
    reveal: [
      { type: "boxEq", text: "11 ＋ □ ＝ 28" },
      { type: "solveEq", text: "28 － 11 ＝ 17" },
      { type: "answer", text: "17こ" }
    ]
  },

  {
    id: "003",
    boxPos: "right",
    prompt: [
      "みかんが", 15,
      "こあります。何こか買ってきたので、ぜんぶで", 32,
      "こになりました。\n買ってきたみかんは何こですか。"
    ],
    tape: { top: 32, bottom: [15, "box"] },
    reveal: [
      { type: "boxEq", text: "15 ＋ □ ＝ 32" },
      { type: "solveEq", text: "32 － 15 ＝ 17" },
      { type: "answer", text: "17こ" }
    ]
  },

  {
    id: "004",
    boxPos: "top",
    prompt: [
      "ジュースが何本(なんぼん)かあります。", 26,
      "本(ほん)くばったので、のこりが", 8,
      "本(ほん)になりました。\nジュースは、はじめに何本(なんぼん)ありましたか。"
    ],
    tape: { top: "box", bottom: [26, 8] },
    reveal: [
      { type: "boxEq", text: "□ － 26 ＝ 8" },
      { type: "solveEq", text: "26 ＋ 8 ＝ 34" },
      { type: "answer", text: "34本(ほん)" }
    ]
  },

  {
    id: "005",
    boxPos: "left",
    prompt: [
      "教室(きょうしつ)に何人(なんにん)かいます。後(あと)から", 8,
      "人(にん)来(き)たので、みんなで", 23,
      "人(にん)になりました。\nはじめに何人(なんにん)いましたか。"
    ],
    tape: { top: 23, bottom: ["box", 8] },
    reveal: [
      { type: "boxEq", text: "□ ＋ 8 ＝ 23" },
      { type: "solveEq", text: "23 － 8 ＝ 15" },
      { type: "answer", text: "15人(にん)" }
    ]
  },

  {
    id: "006",
    boxPos: "left",
    prompt: [
      "リボンが", 12,
      "mあります。何mかつかって、まだ", 5,
      "mのこっています。\nつかったリボンは何mですか。"
    ],
    tape: { top: 12, bottom: ["box", 5] },
    reveal: [
      { type: "boxEq", text: "12 － □ ＝ 5" },
      { type: "solveEq", text: "12 － 5 ＝ 7" },
      { type: "answer", text: "7m" }
    ]
  },

  {
    id: "007",
    boxPos: "right",
    prompt: [
      "公園(こうえん)に", 15,
      "人(にん)います。後(あと)から何人(なんにん)か来(き)たので、みんなで", 23,
      "人(にん)になりました。\n後(あと)から来(き)た人(ひと)は何人(なんにん)ですか。"
    ],
    tape: { top: 23, bottom: [15, "box"] },
    reveal: [
      { type: "boxEq", text: "15 ＋ □ ＝ 23" },
      { type: "solveEq", text: "23 － 15 ＝ 8" },
      { type: "answer", text: "8人(にん)" }
    ]
  },

  {
    id: "008",
    boxPos: "top",
    prompt: [
      "公園(こうえん)に何人(なんにん)かいます。", 9,
      "人(にん)帰(かえ)ったので、のこった人数(にんずう)は", 12,
      "人(にん)になりました。\n公園(こうえん)には、はじめに何人(なんにん)いましたか。"
    ],
    tape: { top: "box", bottom: [9, 12] },
    reveal: [
      { type: "boxEq", text: "□ － 9 ＝ 12" },
      { type: "solveEq", text: "9 ＋ 12 ＝ 21" },
      { type: "answer", text: "21人(にん)" }
    ]
  },

  {
    id: "009",
    boxPos: "left",
    prompt: [
      "教室(きょうしつ)に何人(なんにん)かいます。後(あと)から", 8,
      "人(にん)来(き)たので、みんなで", 18,
      "人(にん)になりました。\nはじめに何人(なんにん)いましたか。"
    ],
    tape: { top: 18, bottom: ["box", 8] },
    reveal: [
      { type: "boxEq", text: "□ ＋ 8 ＝ 18" },
      { type: "solveEq", text: "18 － 8 ＝ 10" },
      { type: "answer", text: "10人(にん)" }
    ]
  },

  {
    id: "010",
    boxPos: "top",
    prompt: [
      "ジュースが何本(なんぼん)かあります。", 7,
      "本(ほん)くばったので、のこりが", 12,
      "本(ほん)になりました。\nジュースは、はじめに何本(なんぼん)ありましたか。"
    ],
    tape: { top: "box", bottom: [7, 12] },
    reveal: [
      { type: "boxEq", text: "□ － 7 ＝ 12" },
      { type: "solveEq", text: "7 ＋ 12 ＝ 19" },
      { type: "answer", text: "19本(ほん)" }
    ]
  },

  {
    id: "011",
    boxPos: "top",
    prompt: [
      "みかんが何こかあります。", 28,
      "こくばったので、のこりが", 7,
      "こになりました。\nみかんは、はじめに何こありましたか。"
    ],
    tape: { top: "box", bottom: [28, 7] },
    reveal: [
      { type: "boxEq", text: "□ － 28 ＝ 7" },
      { type: "solveEq", text: "28 ＋ 7 ＝ 35" },
      { type: "answer", text: "35こ" }
    ]
  },

  {
    id: "012",
    boxPos: "left",
    prompt: [
      "おり紙(がみ)が", 87,
      "枚(まい)あります。2年生(ねんせい)に1枚(まい)ずつくばると、", 15,
      "枚(まい)のこりました。\n2年生(ねんせい)に何枚(なんまい)くばったのでしょうか。"
    ],
    tape: { top: 87, bottom: ["box", 15] },
    reveal: [
      { type: "boxEq", text: "87 － □ ＝ 15" },
      { type: "solveEq", text: "87 － 15 ＝ 72" },
      { type: "answer", text: "72枚(まい)" }
    ]
  },

  {
    id: "013",
    boxPos: "top",
    prompt: [
      "たまごをりょうりに", 12,
      "こつかったので、のこりが", 8,
      "こになりました。\nたまごは、はじめ何こあったのでしょうか。"
    ],
    tape: { top: "box", bottom: [12, 8] },
    reveal: [
      { type: "boxEq", text: "□ － 12 ＝ 8" },
      { type: "solveEq", text: "12 ＋ 8 ＝ 20" },
      { type: "answer", text: "20こ" }
    ]
  },

  {
    id: "014",
    boxPos: "left",
    prompt: [
      "りおさんは、おねえさんにシールを", 24,
      "枚(まい)もらったので、シールが", 93,
      "枚(まい)になりました。\nりおさんは、はじめに何枚(なんまい)もっていたのでしょうか。"
    ],
    tape: { top: 93, bottom: ["box", 24] },
    reveal: [
      { type: "boxEq", text: "□ ＋ 24 ＝ 93" },
      { type: "solveEq", text: "93 － 24 ＝ 69" },
      { type: "answer", text: "69枚(まい)" }
    ]
  },

  {
    id: "015",
    boxPos: "right",
    prompt: [
      "花だんの花(はな)が", 38,
      "本(ほん)さいていました。つぎの日(ひ)、何本(なんぼん)かさいたので、ぜんぶで", 52,
      "本(ほん)になりました。\nつぎの日(ひ)、何本(なんぼん)さいたのでしょうか。"
    ],
    tape: { top: 52, bottom: [38, "box"] },
    reveal: [
      { type: "boxEq", text: "38 ＋ □ ＝ 52" },
      { type: "solveEq", text: "52 － 38 ＝ 14" },
      { type: "answer", text: "14本(ほん)" }
    ]
  },

  {
    id: "016",
    boxPos: "top",
    prompt: [
      "キャンディがあります。2年生(ねんせい)", 34,
      "人(にん)に1こずつくばると、のこりが", 17,
      "こになりました。\nはじめに何こあったのでしょう。"
    ],
    tape: { top: "box", bottom: [34, 17] },
    reveal: [
      { type: "boxEq", text: "□ － 34 ＝ 17" },
      { type: "solveEq", text: "34 ＋ 17 ＝ 51" },
      { type: "answer", text: "51こ" }
    ]
  },

  {
    id: "017",
    boxPos: "left",
    prompt: [
      "ぎょうざを", 60,
      "こやきました。みんなで食(た)べたので、のこりが", 7,
      "こになりました。\nぎょうざを何こ食(た)べたのでしょうか。"
    ],
    tape: { top: 60, bottom: ["box", 7] },
    reveal: [
      { type: "boxEq", text: "60 － □ ＝ 7" },
      { type: "solveEq", text: "60 － 7 ＝ 53" },
      { type: "answer", text: "53こ" }
    ]
  },

  {
    id: "018",
    boxPos: "top",
    prompt: [
      "ロールキャベツを作(つく)りました。みんなで", 26,
      "こ食(た)べましたが、まだ", 19,
      "このこっています。\nはじめに、何こ作(つく)ったのでしょうか。"
    ],
    tape: { top: "box", bottom: [26, 19] },
    reveal: [
      { type: "boxEq", text: "□ － 26 ＝ 19" },
      { type: "solveEq", text: "26 ＋ 19 ＝ 45" },
      { type: "answer", text: "45こ" }
    ]
  },

  {
    id: "019",
    boxPos: "right",
    prompt: [
      "クッキーが", 67,
      "枚(まい)ありました。また、何枚(なんまい)か作(つく)ったので", 105,
      "枚(まい)になりました。\nクッキーを、あとから何枚(なんまい)作(つく)ったのでしょうか。"
    ],
    tape: { top: 105, bottom: [67, "box"] },
    reveal: [
      { type: "boxEq", text: "67 ＋ □ ＝ 105" },
      { type: "solveEq", text: "105 － 67 ＝ 38" },
      { type: "answer", text: "38枚(まい)" }
    ]
  },

  {
    id: "020",
    boxPos: "left",
    prompt: [
      "水そうにメダカがいます。メダカの赤(あか)ちゃんが", 23,
      "ひき生(う)まれて", 60,
      "ひきになりました。\nはじめに水そうにいたメダカは何びきでしょうか。"
    ],
    tape: { top: 60, bottom: ["box", 23] },
    reveal: [
      { type: "boxEq", text: "□ ＋ 23 ＝ 60" },
      { type: "solveEq", text: "60 － 23 ＝ 37" },
      { type: "answer", text: "37ひき" }
    ]
  },

  {
    id: "021",
    boxPos: "right",
    prompt: [
      "めぐみさんのせの高(たか)さは", 128,
      "cmです。何cmかのだいの上(うえ)にのると、せの高(たか)さが", 163,
      "cmになりました。\nだいの高(たか)さは何cmですか。"
    ],
    tape: { top: 163, bottom: [128, "box"] },
    reveal: [
      { type: "boxEq", text: "128 ＋ □ ＝ 163" },
      { type: "solveEq", text: "163 － 128 ＝ 35" },
      { type: "answer", text: "35cm" }
    ]
  }
];
