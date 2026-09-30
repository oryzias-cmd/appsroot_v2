/* clock_text.js
   時計アプリ専用の表示文言。
   hira = ひらがなのみ / kata = カタカナまじり / kanji = 漢字まじり
   文言を直すときは、基本的にこのファイルを編集します。
*/
(() => {
  'use strict';

  const STORAGE_KEY = 'clock-word-mode';
  const MODES = ['hira', 'kata', 'kanji'];

  const TEXT = {
    entry: {
      problemTitle: { hira:'もんだい', kata:'もんだい', kanji:'問題' },
      read:         { hira:'とけい①\nよむ', kata:'とけい①\nよむ', kanji:'時計①\n読む' },
      move:         { hira:'とけい②\nうごかす', kata:'とけい②\nうごかす', kanji:'時計②\n動かす' },
      countTitle:   { hira:'もんだいの かず', kata:'もんだいの かず', kanji:'問題の 数' },
      q3:           { hira:'3もん', kata:'3もん', kanji:'3問' },
      q5:           { hira:'5もん', kata:'5もん', kanji:'5問' },
      q10:          { hira:'10もん', kata:'10もん', kanji:'10問' },
      start:        { hira:'はじめる', kata:'スタート', kanji:'始める' },
      back:         { hira:'← もどる', kata:'← もどる', kanji:'← 戻る' },
      gearLabel:    { hira:'せっていを ひらく', kata:'せっていを ひらく', kanji:'設定を 開く' },
      modeButton: {
        hira: 'ひら→', kata: 'カタ→', kanji: '漢字→'
      }
    },

    main: {
      hourUnit:     { hira:'じ', kata:'じ', kanji:'時' },
      minuteUnit:   { hira:'ふん', kata:'ふん', kanji:'分' },
      half:         { hira:'はん', kata:'はん', kanji:'半' },
      exact:        { hira:'ちょうど', kata:'ちょうど', kanji:'ちょうど' },
      hourSelect:   { hira:'なんじ', kata:'なんじ', kanji:'何時' },
      minuteSelect: { hira:'なんふん', kata:'なんふん', kanji:'何分' },
      backOne:      { hira:'1つけす', kata:'1つけす', kanji:'1つ消す' },
      clearAll:     { hira:'ぜんぶけす', kata:'ぜんぶけす', kanji:'全部消す' },
      check:        { hira:'こたえあわせ', kata:'こたえあわせ', kanji:'答え合わせ' },
      next:         { hira:'▶ つぎへ', kata:'▶ つぎへ', kanji:'▶ 次へ' },
      summary:      { hira:'★ まとめ', kata:'★ まとめ', kanji:'★ まとめ' },
      assistMinute: { hira:'ふん', kata:'ふん', kanji:'分' },
      assistColor:  { hira:'いろわけ', kata:'いろわけ', kanji:'色分け' },
      assistShort:  { hira:'みじかいはり', kata:'みじかいはり', kanji:'短い針' },
      assistRed:    { hira:'あかめもり', kata:'あかめもり', kanji:'赤目盛り' },
      clockLabel:   { hira:'とけい', kata:'とけい', kanji:'時計' },
      inputHourError: {
        hira:'じは 0〜12の あいだで いれてね。',
        kata:'じは 0〜12の あいだで いれてね。',
        kanji:'時は 0〜12の 間で 入れてね。'
      },
      inputMinuteError: {
        hira:'ふんは 0〜59の あいだで いれてね。',
        kata:'ふんは 0〜59の あいだで いれてね。',
        kanji:'分は 0〜59の 間で 入れてね。'
      },
      needHour: {
        hira:'じを いれてね。', kata:'じを いれてね。', kanji:'時を 入れてね。'
      },
      needBoth: {
        hira:'じと ふんを いれてね。', kata:'じと ふんを いれてね。', kanji:'時と 分を 入れてね。'
      },
      correctTitle: { hira:'○ せいかい！', kata:'○ せいかい！', kanji:'○ 正解！' },
      wrongTitle:   { hira:'× おしい！', kata:'× おしい！', kanji:'× おしい！' },
      yourAnswer:   { hira:'あなたの こたえ', kata:'あなたの こたえ', kanji:'あなたの 答え' },
      correctAnswer:{ hira:'ただしいのは', kata:'ただしいのは', kanji:'正しいのは' },
      timeExact: {
        hira:'{hour}じ {minute}', kata:'{hour}じ {minute}', kanji:'{hour}時 {minute}'
      },
      hourExactExplain: {
        hira:'みじかいはりが「{pos}」 → {hour}じ',
        kata:'みじかいはりが「{pos}」 → {hour}じ',
        kanji:'短い針が「{pos}」 → {hour}時'
      },
      hourBetweenExplain: {
        hira:'みじかいはりが「{pos}」の あいだ → {hour}じ',
        kata:'みじかいはりが「{pos}」の あいだ → {hour}じ',
        kanji:'短い針が「{pos}」の 間 → {hour}時'
      },
      minuteFaceExplain: {
        hira:'ながいはりが「{face}」 → {minute}',
        kata:'ながいはりが「{face}」 → {minute}',
        kanji:'長い針が「{face}」 → {minute}'
      },
      minuteFineExplain: {
        hira:'ながいはりが「{base}」から {diff}つ → {minute}',
        kata:'ながいはりが「{base}」から {diff}つ → {minute}',
        kanji:'長い針が「{base}」から {diff}つ → {minute}'
      },
      shortHandHeading: { hira:'●みじかいはり', kata:'●みじかいはり', kanji:'●短い針' },
      longHandHeading:  { hira:'●ながいはり', kata:'●ながいはり', kanji:'●長い針' },
      hourExactExplainBody: {
        hira:'「{pos}」 → {hour}じ', kata:'「{pos}」 → {hour}じ', kanji:'「{pos}」 → {hour}時'
      },
      hourBetweenExplainBody: {
        hira:'「{pos}」の あいだ → {hour}じ', kata:'「{pos}」の あいだ → {hour}じ', kanji:'「{pos}」の 間 → {hour}時'
      },
      minuteFaceExplainBody: {
        hira:'「{face}」 → {minute}', kata:'「{face}」 → {minute}', kanji:'「{face}」 → {minute}'
      },
      minuteFineExplainBody: {
        hira:'「{base}」から {diff}つ → {minute}', kata:'「{base}」から {diff}つ → {minute}', kanji:'「{base}」から {diff}つ → {minute}'
      }
    },

    lv2: {
      problemExact: {
        hira:'{hour}じ ちょうどに しよう', kata:'{hour}じ ちょうどに しよう', kanji:'{hour}時 ちょうどに しよう'
      },
      problemHalf: {
        hira:'{hour}じ はんに しよう', kata:'{hour}じ はんに しよう', kanji:'{hour}時 半に しよう'
      },
      problemMinute: {
        hira:'{hour}じ {minute}に しよう', kata:'{hour}じ {minute}に しよう', kanji:'{hour}時 {minute}に しよう'
      },
      hourExactBody: {
        hira:'{hour}じ → 「{pos}」', kata:'{hour}じ → 「{pos}」', kanji:'{hour}時 → 「{pos}」'
      },
      hourBetweenBody: {
        hira:'{hour}じ → 「{pos}」の あいだ', kata:'{hour}じ → 「{pos}」の あいだ', kanji:'{hour}時 → 「{pos}」の 間'
      },
      minuteFaceBody: {
        hira:'{minute} → 「{face}」', kata:'{minute} → 「{face}」', kanji:'{minute} → 「{face}」'
      },
      minuteFineBody: {
        hira:'{minute} → 「{base}」から {diff}つ', kata:'{minute} → 「{base}」から {diff}つ', kanji:'{minute} → 「{base}」から {diff}つ'
      },
      showCorrect: {
        hira:'せいかいを みる', kata:'せいかいを みる', kanji:'正解を 見る'
      },
      showSelf: {
        hira:'じぶんの こたえを みる', kata:'じぶんの こたえを みる', kanji:'自分の 答えを 見る'
      }
    },

    settings: {
      common:       { hira:'きょうつう', kata:'きょうつう', kanji:'共通' },
      thisClock:    { hira:'この とけいの せってい', kata:'この とけいの せってい', kanji:'この 時計の 設定' },
      back:         { hira:'← めにゅうにもどる', kata:'← メニューにもどる', kanji:'← メニューに戻る' },
      soundOn:      { hira:'🔊 おと ON', kata:'🔊 おと ON', kanji:'🔊 音 ON' },
      soundOff:     { hira:'🔇 おと OFF', kata:'🔇 おと OFF', kanji:'🔇 音 OFF' },
      stepTitle:    { hira:'じかんの きざみ', kata:'じかんの きざみ', kanji:'時間の 刻み' },
      step30:       { hira:'30ぷんきざみ', kata:'30ぷんきざみ', kanji:'30分刻み' },
      step5:        { hira:'5ふんきざみ', kata:'5ふんきざみ', kanji:'5分刻み' },
      step1:        { hira:'1ぷんきざみ', kata:'1ぷんきざみ', kanji:'1分刻み' },
      advanced:     { hira:'じかんの ひょうじ（じょうきゅう）', kata:'じかんの ひょうじ（じょうきゅう）', kanji:'時間の 表示（上級）' },
      hour24:       { hira:'24じかん ひょうじを つかう', kata:'24じかん ひょうじを つかう', kanji:'24時間 表示を 使う' },
      ampm:         { hira:'ごぜん／ごごらべるを ひょうじ', kata:'ごぜん／ごごラベルを ひょうじ', kanji:'午前／午後ラベルを 表示' },
      close:        { hira:'とじる', kata:'とじる', kanji:'閉じる' }
    },

    result: {
      retry: { hira:'もういちど', kata:'もういちど', kanji:'もう一度' },
      back:  { hira:'もどる', kata:'もどる', kanji:'戻る' },
      q3: {
        perfect: [
          { hira:'ぜんぶ できた！', kata:'パーフェクト！', kanji:'全部 できた！' },
          { hira:'すごい！ ぜんぶ せいかい！', kata:'すごい！ ぜんぶ せいかい！', kanji:'すごい！ 全部 正解！' },
          { hira:'やったね！ かんぺき！', kata:'やったね！ かんぺき！', kanji:'やったね！ 完璧！' },
          { hira:'ぜんぶ ばっちり！', kata:'ぜんぶ ばっちり！', kanji:'全部 ばっちり！' }
        ],
        pass: [
          { hira:'よく できたね！', kata:'よく できたね！', kanji:'よく できたね！' },
          { hira:'あと すこし！ いいちょうし！', kata:'あと すこし！ いいちょうし！', kanji:'あと 少し！ いい調子！' },
          { hira:'じょうずに できたね！', kata:'じょうずに できたね！', kanji:'上手に できたね！' },
          { hira:'いいぞ！ そのちょうし！', kata:'いいぞ！ そのちょうし！', kanji:'いいぞ！ その調子！' },
          { hira:'がんばったね！', kata:'がんばったね！', kanji:'がんばったね！' }
        ],
        retryMsg: [
          { hira:'もういちど やってみよう！', kata:'もういちど やってみよう！', kanji:'もう一度 やってみよう！' },
          { hira:'だいじょうぶ。つぎも やってみよう！', kata:'だいじょうぶ。つぎも やってみよう！', kanji:'大丈夫。次も やってみよう！' },
          { hira:'ゆっくり やってみよう！', kata:'ゆっくり やってみよう！', kanji:'ゆっくり やってみよう！' },
          { hira:'もうすこし！', kata:'もうすこし！', kanji:'もう少し！' },
          { hira:'つぎは できるかな？', kata:'つぎは できるかな？', kanji:'次は できるかな？' }
        ]
      },
      q5: {
        perfect: [
          { hira:'5もん ぜんぶ せいかい！', kata:'5もん ぜんぶ せいかい！', kanji:'5問 全部 正解！' },
          { hira:'ぱあふぇくと！', kata:'パーフェクト！', kanji:'パーフェクト！' },
          { hira:'すごい！ ぜんぶ できた！', kata:'すごい！ ぜんぶ できた！', kanji:'すごい！ 全部 できた！' },
          { hira:'かんぺき！ やったね！', kata:'かんぺき！ やったね！', kanji:'完璧！ やったね！' },
          { hira:'ぜんぶ ばっちり！', kata:'ぜんぶ ばっちり！', kanji:'全部 ばっちり！' }
        ],
        pass: [
          { hira:'とっても よく できたね！', kata:'とっても よく できたね！', kanji:'とっても よく できたね！' },
          { hira:'おしい！ すごいぞ！', kata:'おしい！ すごいぞ！', kanji:'おしい！ すごいぞ！' },
          { hira:'いいちょうし！', kata:'いいちょうし！', kanji:'いい調子！' },
          { hira:'じょうずに できたね！', kata:'じょうずに できたね！', kanji:'上手に できたね！' },
          { hira:'あと ちょっとだったね！', kata:'あと ちょっとだったね！', kanji:'あと ちょっとだったね！' }
        ],
        retryMsg: [
          { hira:'もういちど やってみよう！', kata:'もういちど やってみよう！', kanji:'もう一度 やってみよう！' },
          { hira:'ゆっくり かんがえてみよう！', kata:'ゆっくり かんがえてみよう！', kanji:'ゆっくり 考えてみよう！' },
          { hira:'つぎは もっと できそう！', kata:'つぎは もっと できそう！', kanji:'次は もっと できそう！' },
          { hira:'がんばったね。もういっかい！', kata:'がんばったね。もういっかい！', kanji:'がんばったね。もう一回！' },
          { hira:'ひんとも つかってみよう！', kata:'ヒントも つかってみよう！', kanji:'ヒントも 使ってみよう！' }
        ]
      },
      q10: {
        perfect: [
          { hira:'10もん ぜんぶ せいかい！', kata:'10もん ぜんぶ せいかい！', kanji:'10問 全部 正解！' },
          { hira:'ぱあふぇくと！ すごい！', kata:'パーフェクト！ すごい！', kanji:'パーフェクト！ すごい！' },
          { hira:'ぜんぶ できた！', kata:'ぜんぶ できた！', kanji:'全部 できた！' },
          { hira:'かんぺき！ おみごと！', kata:'かんぺき！ おみごと！', kanji:'完璧！ お見事！' },
          { hira:'すごいぞ！ ぜんぶ ばっちり！', kata:'すごいぞ！ ぜんぶ ばっちり！', kanji:'すごいぞ！ 全部 ばっちり！' }
        ],
        pass: [
          { hira:'たくさん できたね！', kata:'たくさん できたね！', kanji:'たくさん できたね！' },
          { hira:'とっても よく できました！', kata:'とっても よく できました！', kanji:'とっても よく できました！' },
          { hira:'いいちょうし！', kata:'いいちょうし！', kanji:'いい調子！' },
          { hira:'がんばったね！', kata:'がんばったね！', kanji:'がんばったね！' },
          { hira:'もうすこしで ぱあふぇくと！', kata:'もうすこしで パーフェクト！', kanji:'もう少しで パーフェクト！' }
        ],
        retryMsg: [
          { hira:'もういちど ちょうせん！', kata:'もういちど チャレンジ！', kanji:'もう一度 挑戦！' },
          { hira:'ゆっくり やってみよう！', kata:'ゆっくり やってみよう！', kanji:'ゆっくり やってみよう！' },
          { hira:'ひんとを つかってみよう！', kata:'ヒントを つかってみよう！', kanji:'ヒントを 使ってみよう！' },
          { hira:'つぎは もっと できるよ！', kata:'つぎは もっと できるよ！', kanji:'次は もっと できるよ！' },
          { hira:'さいごまで がんばったね！', kata:'さいごまで がんばったね！', kanji:'最後まで がんばったね！' }
        ]
      }
    }
  };

  function normalize(mode) {
    return MODES.includes(mode) ? mode : 'kata';
  }

  function loadMode() {
    try { return normalize(localStorage.getItem(STORAGE_KEY)); }
    catch (_) { return 'kata'; }
  }

  function saveMode(mode) {
    const next = normalize(mode);
    try { localStorage.setItem(STORAGE_KEY, next); } catch (_) {}
    window.dispatchEvent(new CustomEvent('clock:wordmode-changed', { detail:{ mode:next } }));
    return next;
  }

  function nextMode() {
    const cur = loadMode();
    const i = MODES.indexOf(cur);
    return saveMode(MODES[(i + 1) % MODES.length]);
  }

  function getPath(path) {
    return String(path).split('.').reduce((v, k) => v && v[k], TEXT);
  }

  function pick(path, mode = loadMode()) {
    const item = getPath(path);
    if (item == null) return '';
    if (typeof item === 'string') return item;
    if (Array.isArray(item)) return item;
    return item[normalize(mode)] ?? item.kata ?? item.hira ?? item.kanji ?? '';
  }

  function format(path, vars = {}, mode = loadMode()) {
    let s = String(pick(path, mode));
    Object.entries(vars).forEach(([k, v]) => {
      s = s.replaceAll(`{${k}}`, String(v));
    });
    return s;
  }

  function random(path, mode = loadMode()) {
    const list = getPath(path);
    if (!Array.isArray(list) || list.length === 0) return '';
    const item = list[Math.floor(Math.random() * list.length)];
    return item[normalize(mode)] ?? item.kata ?? item.hira ?? item.kanji ?? '';
  }

  window.ClockText = { TEXT, MODES, loadMode, saveMode, nextMode, pick, format, random };
})();
