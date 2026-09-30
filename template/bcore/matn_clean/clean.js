/* clean.js（cleanQuiz最小：SetupとResultCardの標準化）
   目的：
   - kit.full.js の歯車が探す openSettings を提供する（SetupCard）
   - kit.full.js の「もどる」が探す back を提供する（URL指定で entry へ）
   - result は ResultCard（resultレゴ標準）で表示する（ダミー検証用）
   - quiz棚は触らない（空のまま）
*/
(() => {
  'use strict';

  // 「もどる」挙動：history ではなく URL 指定で entry へ戻す
  const ENTRY_PAGE = './clean_entry.html';

  // ---------------------------------------------------------
  // 小物
  // ---------------------------------------------------------
  function getQS(){
    return (typeof location.search === 'string') ? location.search : '';
  }

  function goEntry(){
    location.href = ENTRY_PAGE + getQS();
  }

  function ensureSetupMount(){
    let host = document.getElementById('setupMount');
    if(host) return host;
    host = document.createElement('div');
    host.id = 'setupMount';
    document.body.appendChild(host);
    return host;
  }

  function readBody(attr, fallback){
    const v = document.body.getAttribute(attr);
    return (v === null || v === undefined || v === '') ? fallback : v;
  }

  function writeBody(attr, value){
    document.body.setAttribute(attr, String(value));
  }

  function setPhase(phase){
    try{
      document.body.setAttribute('data-phase', String(phase || 'quiz'));
    }catch(_e){}
  }

  function showQuizPage(){
    const quiz = document.getElementById('quizPage');
    const res = document.getElementById('resultPage');
    if(quiz) quiz.hidden = false;
    if(res) res.hidden = true;
    setPhase('quiz');
  }

  // ---------------------------------------------------------
  // SetupCard（歯車）
  // ---------------------------------------------------------
  function openSettings(){
    if(!window.SetupCard || typeof window.SetupCard.show !== 'function'){
      alert('setup.full.js が読み込まれていません');
      return;
    }

    ensureSetupMount();

    const cur = {
      eqSize: readBody('data-eq-size', 'm'),
      oxSize: readBody('data-ox-size', 'm'),
      colorMode: readBody('data-color-mode', 'color')
    };

    window.SetupCard.show({
      mount: '#setupMount',
      startLabel: 'とじる',
      columns: [
        {
          weight: 1,
          cards: [
            {
              id: 'eqSize',
              title: '文字の 大きさ',
              desc: '',
              type: 'radio',
              required: false,
              options: [
                { value: 's', label: '小' },
                { value: 'm', label: '中' },
                { value: 'l', label: '大' }
              ],
              default: cur.eqSize
            }
          ]
        },
        {
          weight: 1,
          cards: [
            {
              id: 'oxSize',
              title: '○×ボタン',
              desc: '',
              type: 'radio',
              required: false,
              options: [
                { value: 'm', label: 'ふつう' },
                { value: 'l', label: '大きめ' }
              ],
              default: cur.oxSize
            }
          ]
        },
        {
          weight: 1,
          cards: [
            {
              id: 'colorMode',
              title: 'いろ',
              desc: '',
              type: 'radio',
              required: false,
              options: [
                { value: 'color', label: 'カラー' },
                { value: 'mono',  label: 'ひかえめ\n＋はっきり' }
              ],
              default: cur.colorMode
            }
          ]
        }
      ],
      onStart: (out) => {
        const nextEq = String((out && out.eqSize) || cur.eqSize || 'm');
        const nextOx = String((out && out.oxSize) || cur.oxSize || 'm');
        const nextCol = String((out && out.colorMode) || cur.colorMode || 'color');

        writeBody('data-eq-size', nextEq);
        writeBody('data-ox-size', nextOx);
        writeBody('data-color-mode', nextCol);

        if(window.SetupCard && typeof window.SetupCard.hide === 'function'){
          window.SetupCard.hide();
        }
      }
    });
  }

  // ---------------------------------------------------------
  // ResultCard（resultレゴ標準）ダミー表示
  // ---------------------------------------------------------
  function showResultDummy(){
    if(!(window.ResultCard && typeof window.ResultCard.show === 'function')){
      alert('result.full.js が読み込まれていません');
      return;
    }

    setPhase('result');

    const labels = {
      heading: "【 け っ か 】",
      retry: "もういちど",
      setup: "エントリーへ もどる"
    };

    window.ResultCard.show({
      results: [
        "ダミー表示（Result棚の検証）",
        "ここが表示できれば、Result棚はOKです。"
      ],
      tier: "low",
      labels,
      buttons: ["retry","setup"],
      onRetry: () => {
        window.ResultCard.hide();
        showQuizPage();
      },
      onSetup: () => {
        window.ResultCard.hide();
        goEntry();
      }
    });
  }

  // ---------------------------------------------------------
  // kit.full.js が参照する入口を提供
  // ---------------------------------------------------------
  window.AppActions = window.AppActions || {};

  // 歯車 → SetupCard
  window.AppActions.openSettings = openSettings;

  // 「もどる」→ entry（URL指定）
  window.AppActions.back = goEntry;

  // ダミー result（検証用）
  window.AppActions.openResultDummy = showResultDummy;

  // 保険：別名でも拾えるようにする（kitが AppShellOptions も見る場合）
  window.AppShellOptions = window.AppShellOptions || {};
  if(!window.AppShellOptions.openSettings){
    window.AppShellOptions.openSettings = openSettings;
  }

  // ---------------------------------------------------------
  // 既存のフォールバックresult棚が残っている場合の配線（押したら標準ResultCardへ）
  // ---------------------------------------------------------
  function wireFallbackButtons(){
    const btnReplay = document.getElementById('btnReplay');
    const btnToSetup = document.getElementById('btnToSetup');

    if(btnReplay){
      btnReplay.addEventListener('click', () => {
        showQuizPage();
      });
    }

    if(btnToSetup){
      btnToSetup.addEventListener('click', () => {
        goEntry();
      });
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    wireFallbackButtons();
    showQuizPage();
  });
})();