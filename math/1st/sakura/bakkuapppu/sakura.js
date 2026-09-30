/* sakura.js（kuku名残の全撤去＋⚙SetupCardを開く入口だけ残す）
   目的：
   - kuku由来の表示（かけ算行・読み行・○×ボタン・カウントダウンなど）を全面撤去
   - ⚙クリックで SetupCard（setup.full.js）を開けるようにする
   - quiz本体のFlowや設計は触らない（ここでは “kuku残骸を消す” だけ）
*/

(() => {
  'use strict';

  // =========================================================
  // 1) kuku名残DOMを削除（HTMLに残っていても表示しない）
  // =========================================================
  function removeIfExists(selector){
    try{
      const el = document.querySelector(selector);
      if(el && el.parentNode) el.parentNode.removeChild(el);
    }catch(e){}
  }

  function removeAll(selector){
    try{
      const els = document.querySelectorAll(selector);
      for(const el of els){
        if(el && el.parentNode) el.parentNode.removeChild(el);
      }
    }catch(e){}
  }

  function cleanupKukuRemnants(){
    // かけ算表示・問題番号・読み行
    removeIfExists('#qIndexBadge');
    removeIfExists('#equationBox');
    removeIfExists('#readingRow');

    // ○×ボタン（判定行）
    removeIfExists('#judgeRow');

    // カウントダウン系
    removeIfExists('#countdownOverlay');
    removeIfExists('#timerBanner');

    // まとめラッパ（式エリアごと撤去）
    removeAll('.quiz-eq-wrapper');
    removeAll('.eq-panel');
    removeAll('.quiz-grid');
    removeAll('.equation-row');

    // もし式表示の親だけ残っていた場合の保険
    removeAll('[data-kuku]');
  }

  // =========================================================
  // 2) ⚙ → SetupCard を開く（settingsHref不要：openSettingsを提供）
  // =========================================================
  function getBodySetting(attr, fallback){
    try{
      const v = document.body && document.body.getAttribute(attr);
      return (v === null || v === undefined || v === '') ? fallback : v;
    }catch(e){
      return fallback;
    }
  }

  function applyBodySetting(attr, value){
    try{
      if(document.body){
        document.body.setAttribute(attr, String(value));
      }
    }catch(e){}
  }

  function ensureSetupMount(){
    // quiz領域を潰さないため、専用の空divを body 直下に置く
    let host = document.getElementById('setupMount');
    if(host) return host;

    host = document.createElement('div');
    host.id = 'setupMount';
    document.body.appendChild(host);
    return host;
  }

  function openSettings(){
    if(!window.SetupCard || typeof window.SetupCard.show !== 'function'){
      alert('setup.full.js が読み込まれていません');
      return;
    }

    const host = ensureSetupMount();

    const cur = {
      eqSize: getBodySetting('data-eq-size', 'm'),
      oxSize: getBodySetting('data-ox-size', 'm'),
      colorMode: getBodySetting('data-color-mode', 'color')
    };

    window.SetupCard.show({
      // 重要：quizを描き替えない mount
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
        const next = {
          eqSize: String((out && out.eqSize) || cur.eqSize || 'm'),
          oxSize: String((out && out.oxSize) || cur.oxSize || 'm'),
          colorMode: String((out && out.colorMode) || cur.colorMode || 'color')
        };

        applyBodySetting('data-eq-size', next.eqSize);
        applyBodySetting('data-ox-size', next.oxSize);
        applyBodySetting('data-color-mode', next.colorMode);

        try{
          if(window.SetupCard && typeof window.SetupCard.hide === 'function'){
            window.SetupCard.hide();
          }
        }catch(e){}
      }
    });
  }

  function wireOpenSettingsForKit(){
    // kit.full.js が探す入口（どちらでも拾えるように両方定義）
    window.AppActions = window.AppActions || {};
    window.AppActions.openSettings = openSettings;

    window.AppShellOptions = window.AppShellOptions || {};
    if(!window.AppShellOptions.openSettings){
      window.AppShellOptions.openSettings = openSettings;
    }
  }

  // =========================================================
  // 3) 起動
  // =========================================================
  function boot(){
    cleanupKukuRemnants();
    wireOpenSettingsForKit();
  }

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', boot);
  }else{
    boot();
  }
})();