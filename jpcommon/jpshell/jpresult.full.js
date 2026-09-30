/* jpresult.full.js (JPN Result Card)
   - 全て縦書き
   - 右→左配置：左=ボタン / 中=励まし / 線 / 右=成績
*/
(() => {
  const OVERLAY_ID = 'jpresultOverlay';

  const createEl = (tag, className) => {
    const el = document.createElement(tag);
    if (className) el.className = className;
    return el;
  };

  const ensureOverlay = () => {
    let root = document.getElementById(OVERLAY_ID);
    if (root) return root;

    root = createEl('div', 'jpresult-overlay');
    root.id = OVERLAY_ID;
    root.style.display = 'none';

    const card = createEl('div', 'jpresult-card');

    const grid = createEl('div', 'jpresult-grid');

    const score = createEl('div', 'jpresult-score');
    score.id = 'jpresultScore';

    const divider = createEl('div', 'jpresult-divider');

    const msg = createEl('div', 'jpresult-message');
    msg.id = 'jpresultMessage';

    const btns = createEl('div', 'jpresult-buttons');

    const btnRetry = createEl('button', 'jpresult-btn');
    btnRetry.type = 'button';
    btnRetry.id = 'jpresultBtnRetry';
    const btnRetrySpan = createEl('span');
    btnRetrySpan.textContent = 'おなじ コースを もういちど';
    btnRetry.appendChild(btnRetrySpan);

    const btnBack = createEl('button', 'jpresult-btn');
    btnBack.type = 'button';
    btnBack.id = 'jpresultBtnBack';
    const btnBackSpan = createEl('span');
    btnBackSpan.textContent = 'せっていに もどる';
    btnBack.appendChild(btnBackSpan);

    btns.appendChild(btnRetry);
    btns.appendChild(btnBack);

    // grid: [buttons | message | divider | score]
    // 画面上は「左=buttons / 中=励まし / 線 / 右=成績」になる
    grid.appendChild(btns);
    grid.appendChild(msg);
    grid.appendChild(divider);
    grid.appendChild(score);

    card.appendChild(grid);
    root.appendChild(card);
    document.body.appendChild(root);

    return root;
  };

const normalizeWordMode = (v) => {
    const s = String(v || '');

    // 旧値互換（過去URL/保存）
    if (s === 'hira') return 'kana';
    if (s === 'mixed') return 'kanjiYomi';
    if (s === 'kanji') return 'kanjiYomi';
    if (s === 'kanjiYomi') return 'kanjiYomi';
    if (s === 'kana') return 'kana';

    // 既定は kana（安全側）
    return 'kana';
  };

  // ★漢字(よみ) の表示切替は JPKit.wordFilter に一本化
  const formatByWordMode = (text, wordMode) => {
    const wm = normalizeWordMode(wordMode);
    const s = String(text || '');

    try{
      if (window.JPKit && window.JPKit.wordFilter && typeof window.JPKit.wordFilter.applyParen === 'function'){
        return window.JPKit.wordFilter.applyParen(s, wm);
      }
    }catch(e){}

    // フォールバック（万一 JPKit が無い場合）
    return s.replace(/([一-龥々〆ヵヶ]+)\(([^()]+)\)/g, (m, kanji, yomi) => {
      return (wm === 'kana') ? String(yomi || '') : String(kanji || '');
    });
  };

  // ★成績帯ごとの 2×2 合成（headline[2] × advice[2]）
  const pickEncourage2x2 = (ok, total, prevKey) => {
    const rate = total > 0 ? ok / total : 0;

    // 成績帯（割合ベース）
    // 0〜59 / 60〜79 / 80〜99 / 100
    const bands = [
      {
        min: 1.0,
        headline: ['すごい。', 'かんぺき。'],
        advice: ['つぎも このちょうし。', 'そのまま すすもう。']
      },
      {
        min: 0.80,
        headline: ['よく がんばったね。', 'いいね。'],
        advice: ['つぎも がんばろう。', 'つぎは もっと ふやそう。']
      },
      {
        min: 0.60,
        headline: ['いい ちょうし。', 'もうすこし。'],
        advice: ['ゆっくり かくにん。', 'つぎは もう すこし。']
      },
      {
        min: -1,
        headline: ['だいじょうぶ。', 'あせらなくて いいよ。'],
        advice: ['つぎは ゆっくり やろう。', '一(ひと)つずつ たしかめよう。']
      }
    ];

    const band = bands.find(b => rate >= b.min) || bands[bands.length - 1];

    const pick = () => {
      const hi = Math.random() < 0.5 ? 0 : 1;
      const ai = Math.random() < 0.5 ? 0 : 1;
      const key = `${hi}-${ai}`;
      return { key, lines: [band.headline[hi], band.advice[ai]] };
    };

    // 連続で同じ組み合わせを避ける（最大3回）
    let r = pick();
    let tries = 0;
    while (prevKey && r.key === prevKey && tries < 3) {
      r = pick();
      tries++;
    }

    return r;
  };

  const setMessageLines = (lines) => {
    const msg = document.getElementById('jpresultMessage');
    msg.innerHTML = '';
    lines.forEach((t) => {
      const s = createEl('span', 'jpresult-msgline');
      s.textContent = t;
      msg.appendChild(s);
    });
  };

  const api = {
    show: (opts) => {

      // ★母型：wordMode 自動再適用（result）
      // - 戻る復帰 / タブ復帰でも、歯車を押さずに正しい表記へ戻す
      try{
        if (window.JPKit && JPKit.wordFilter && typeof JPKit.wordFilter.installAutoApply === 'function') {
          JPKit.wordFilter.installAutoApply({ onceKey: '__jpresultAutoApply', root: document.body });
        }
      }catch(e){}

      const root = ensureOverlay();
      const total = Number(opts && opts.total != null ? opts.total : 0);
      const ok = Number(opts && opts.ok != null ? opts.ok : 0);

      const score = document.getElementById('jpresultScore');

      // ★国語版：縦は短いのでコンパクトに（改行＝列送り）
      // 例）3もんちゅう / 2もん / せいかい
      const toKanji = (n) => {
        const x = Number(n);
        if (!Number.isFinite(x)) return String(n);

        const d = ['〇','一','二','三','四','五','六','七','八','九'];

        if (x === 0) return d[0];
        if (x < 0) return '－' + toKanji(Math.abs(x));

        // 0〜99 まで対応（この教材の出題数なら十分）
        if (x < 10) return d[x];

        if (x < 20) return '十' + (x % 10 === 0 ? '' : d[x % 10]);

        if (x < 100) {
          const t = Math.floor(x / 10);
          const r = x % 10;
          return d[t] + '十' + (r === 0 ? '' : d[r]);
        }

        // 100以上は念のためアラビア数字で返す（必要なら拡張）
        return String(x);
      };

      // ★C案の保険：opts.wordMode が無い/空のときは URL から拾う
      const qs = new URLSearchParams(location.search);
      const wmFromOpts = (opts && typeof opts.wordMode === 'string') ? opts.wordMode : '';
      const wmFromUrl = qs.get('wordMode') || '';
      const wordMode = normalizeWordMode(wmFromOpts || wmFromUrl);

      // ★成績表示は mode で “元の文” 自体を切り替える
      // - kanjiYomi：漢字(よみ) → formatByWordModeで 漢字（よみ）
      // - kana     ：数字は漢数字のまま、本文はひらがなだけ（漢字を残さない）
      if (wordMode === 'kana') {
        score.textContent = `${toKanji(total)}もんちゅう\n${toKanji(ok)}もん\nせいかい`;
      } else {
        const rawScore = `${toKanji(total)}もん中(ちゅう)\n${toKanji(ok)}もん\n正(せい)かい`;
        score.textContent = formatByWordMode(rawScore, wordMode);
      }

      const prevKey = api._lastComboKey || '';
      const picked = pickEncourage2x2(ok, total, prevKey);
      api._lastComboKey = picked.key;

      const rawLines = (opts && Array.isArray(opts.messageLines) && opts.messageLines.length)
        ? opts.messageLines
        : picked.lines;

      const lines = rawLines.map(t => formatByWordMode(t, wordMode));

      setMessageLines(lines);

      const btnRetryText = (opts && opts.retryLabel) ? String(opts.retryLabel) : 'おなじ コースを もう一(いち)ど';
      const btnBackText = (opts && opts.backLabel) ? String(opts.backLabel) : 'せっていに もどる';

      const btnRetry = document.getElementById('jpresultBtnRetry');
      const btnBack = document.getElementById('jpresultBtnBack');

      btnRetry.querySelector('span').textContent = btnRetryText;
      btnBack.querySelector('span').textContent = btnBackText;

      btnRetry.onclick = () => {
        if (opts && typeof opts.onRetry === 'function') opts.onRetry();
      };
      btnBack.onclick = () => {
        if (opts && typeof opts.onBack === 'function') opts.onBack();
      };

      root.style.display = 'grid';
    },

    hide: () => {
      const root = document.getElementById(OVERLAY_ID);
      if (!root) return;
      root.style.display = 'none';
    }
  };

  window.JpResult = api;
})();
