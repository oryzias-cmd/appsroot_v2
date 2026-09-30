/* ========================================
   data.js（かくしことば）
   - 1問に「正解パターン（ことば＋いる/ある）」を複数持てる
   - answers は必ず配列（1つだけでも配列）
======================================== */

window.KAKUSHI_DATA = [
  {
    base: 'すいか',
    answers: [
      { hidden: 'いか', exist: 'いる' }
    ],
    hints: {
      1: '海(うみ)に　いる　白(しろ)い　生(い)きものだよ。',
    }
  },
  {
    base: 'ぞうきん',
    answers: [
      { hidden: 'ぞう', exist: 'いる' },
      { hidden: 'うき', exist: 'ある' },
      { hidden: 'きん', exist: 'ある' }
    ],
    hints: {
      1: 'はなが　長(なが)いよ。',
    }
  },
  {
    base: 'れすとらん',
    answers: [
      { hidden: 'らん', exist: 'ある' },
      { hidden: 'とら', exist: 'いる' }
    ],
    hints: {
      1: '黄色(きいろ)と　黒(くろ)の　しまもようだね。',
    }
  },
  {
    base: 'ずがこうさく',
    answers: [
      { hidden: 'さく', exist: 'ある' }
    ],
    hints: {
      1: '絵(え)が　すきですか。工作(こうさく)が　すきですか。',
    }
  },
  {
    base: 'かばん',
    answers: [
      { hidden: 'ばん', exist: 'ある' },
      { hidden: 'かば', exist: 'いる' }
    ],
    hints: {
      1: '大(おお)きな　口(くち)の　どうぶつだよ。',
    }
  },
  {
    base: 'はちまき',
    answers: [
      { hidden: 'はち', exist: 'いる' },
      { hidden: 'ちまき', exist: 'ある' }
    ],
    hints: {
      1: 'おいしいけれど　いたいなあ。',
    }
  },
  {
    base: 'ぶたい',
    answers: [
      { hidden: 'たい', exist: 'いる' },
      { hidden: 'ぶた', exist: 'いる' }
    ],
    hints: {
      1: 'いのししの　なかまだね。',
    }
  },
  {
    base: 'いわし',
    answers: [
      { hidden: 'いわ', exist: 'ある' },
      { hidden: 'わし', exist: 'いる' }
    ],
    hints: {
      1: 'とりの　王(おう)さまだよ。',
    }
  },
  {
    base: 'みかん',
    answers: [
      { hidden: 'かん', exist: 'ある' }
    ],
    hints: {
      1: 'ジュースが　入(はい)っているね。',
    }
  },
  {
    base: 'すいとう',
    answers: [
      { hidden: 'いと', exist: 'ある' }
    ],
    hints: {
      1: 'ほそくて　長(なが)いよ。',
    }
  },
  {
    base: 'パンダ',
    answers: [
      { hidden: 'パン', exist: 'ある' }
    ],
    hints: {
      1: '白黒(しろくろ)じゃなくて、ちゃ色(いろ)かな。',
    }
  },
  {
    base: 'はたけ',
    answers: [
      { hidden: 'はた', exist: 'ある' },
      { hidden: 'たけ', exist: 'ある' }
    ],
    hints: {
      1: 'パンダの　大(だい)こうぶつだね。',
    }
  },
  {
    base: 'ぼうし',
    answers: [
      { hidden: 'ぼう', exist: 'ある' },
      { hidden: 'うし', exist: 'いる' }
    ],
    hints: {
      1: ['①ぎゅうにゅうを　だしてくれるね。','②ながい　木(「き」)だよ']
    }
  },
  {
    base: 'さかな',
    answers: [
      { hidden: 'さか', exist: 'ある' }
    ],
    hints: {
      1: '下(くだ)りは　らくちんだね。',
    }
  }
];
