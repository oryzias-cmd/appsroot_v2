/* judge_bridge.js - HIRAGANA_kaki から StrokeJudge を呼ぶための薄い橋渡し */
(function (global) {
  // 受け入れる userStrokes 形式をゆるく：A/BどちらでもOK
  // A) [{points:[{x,y,t}...]}...]
  // B) [ [{x,y,t}...], ... ]
  function normalizeUserStrokes(userStrokes) {
    if (!userStrokes || !userStrokes.length) return [];
    if (userStrokes[0] && userStrokes[0].points) return userStrokes;  // 既にA
    if (Array.isArray(userStrokes[0])) {                               // B→A
      return userStrokes.map(arr => ({ points: arr }));
    }
    if (userStrokes[0] && userStrokes[0].x != null && userStrokes[0].y != null) {
      return [{ points: userStrokes }];
    }
    return [];
  }

  /**
   * HIRAGANA_kaki から呼ぶ窓口
   * @param {string} char - 例 'ふ'
   * @param {Array} userStrokes - 上記A/BどちらでもOK
   * @param {HTMLCanvasElement} canvas - 書画面のキャンバス
   * @param {Object} [opts] - { mode:'easy'|'normal'|'strict', useDTW:false }
   */
  function judgeHiragana(char, userStrokes, canvas, opts = {}) {
    if (!global.StrokeJudge) {
      console.error('StrokeJudge が読み込まれていません（stroke_judge_module.js を先に読み込んでください）');
      return { pass:false, score:0, commentHtml:'<span>じゅんび ちゅう だよ</span>', commentText:'じゅんび ちゅう だよ', variantName:null };
    }
    const norm = normalizeUserStrokes(userStrokes);
    return global.StrokeJudge.evaluate({
      char,
      userStrokes: norm,
      viewBox: { w: canvas?.width || 600, h: canvas?.height || 420 },
      mode: opts.mode || 'normal',
      useDTW: !!opts.useDTW
    });
  }

  // グローバル公開
  global.judgeHiragana = judgeHiragana;
})(window);
