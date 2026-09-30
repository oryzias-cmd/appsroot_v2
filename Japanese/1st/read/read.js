// ひらがな読みアプリ用：画面全体で data-role をフックして
// ReadEngine と既存ボタンへ橋渡しするグローバル版
(function(){
  'use strict';

  console.log('[read.js] global bridge loaded');

  // ───────────────────────────────
  // ReadEngine まわりのユーティリティ
  // ───────────────────────────────
  function callReadEngineNext(){
    const RE = window.ReadEngine;
    if (!RE) {
      console.warn('[read.js] ReadEngine が見つかりません');
      return false;
    }
    // よくありそうな候補を順に試す
    const cands = ['next', 'nextQuestion', 'goNext', 'skip'];
    for (let name of cands){
      if (typeof RE[name] === 'function'){
        console.debug('[read.js] call ReadEngine.' + name + '()');
        try{ RE[name](); }catch(e){ console.error('[read.js] ReadEngine.'+name+' でエラー', e); }
        return true;
      }
    }
    console.warn('[read.js] ReadEngine に next 系の公開関数が見つかりません');
    return false;
  }

  function callReadEngineRestart(){
    const RE = window.ReadEngine;
    if (!RE) {
      console.warn('[read.js] ReadEngine が見つかりません');
      return false;
    }
    const cands = ['restart', 'restartCourse', 'restartSame', 'reset'];
    for (let name of cands){
      if (typeof RE[name] === 'function'){
        console.debug('[read.js] call ReadEngine.' + name + '()');
        try{ RE[name](); }catch(e){ console.error('[read.js] ReadEngine.'+name+' でエラー', e); }
        return true;
      }
    }
    console.warn('[read.js] ReadEngine に restart 系の公開関数が見つかりません');
    return false;
  }

  // ───────────────────────────────
  // 機能ごとの共通関数
  // ───────────────────────────────

  // 「同じコースをもういちど」
  function restartSameCourse(){
    console.debug('[read.js] restartSameCourse');

    // 1) ReadEngine に restart 系APIがあればそれを使う
    if (callReadEngineRestart()) return;

    // 2) なければ「スタート」ボタンを押し直す（startCourse）
    const startBtn = document.getElementById('startCourse');
    if (startBtn){
      console.debug('[read.js] restart via #startCourse.click()');
      startBtn.click();
      return;
    }

    console.warn('[read.js] restart 用の手段が見つかりませんでした');
  }

  // 「つぎのもんだい」
  function goNextQuestion(){
    console.debug('[read.js] goNextQuestion');

    // 1) ReadEngine に next 系APIがあればそれを使う
    if (callReadEngineNext()) return;

    console.warn('[read.js] 次の問題へ進む公開APIが見つかりませんでした');
  }

  // 「もどる」
  function backToOpen(){
    console.debug('[read.js] backToOpen');

    // 1) コース画面の「もどる」ボタンがあればその click を利用
    const backBtn = document.getElementById('backToOpen');
    if (backBtn){
      backBtn.click();
    }else{
      // なければページクラスを直接切り替え
      const openPage   = document.getElementById('openPage');
      const coursePage = document.getElementById('coursePage');
      if (openPage)   openPage.classList.remove('hidden');
      if (coursePage) coursePage.classList.add('hidden');
    }

    // 読みミニパネルを隠す
    const panel = document.getElementById('readMiniPanel');
    if (panel){
      panel.style.display = 'none';
    }

    // phase を setup に戻す（footer を CSS で隠す）
    try{
      document.body.dataset.phase = 'setup';
    }catch(e){
      console.warn('[read.js] failed to set body.dataset.phase = "setup"', e);
    }
  }

  // data-role ごとの処理まとめ
  function handleRoleClick(role, event){
    switch(role){
      case 'primary':  // 「こたえあわせ」→「もういちど」扱い
        if (event.preventDefault)  event.preventDefault();
        if (event.stopPropagation) event.stopPropagation();
        restartSameCourse();
        break;
      case 'next':     // 「つぎのもんだい」
        if (event.preventDefault)  event.preventDefault();
        if (event.stopPropagation) event.stopPropagation();
        goNextQuestion();
        break;
      case 'back':     // 「もどる」
        if (event.preventDefault)  event.preventDefault();
        if (event.stopPropagation) event.stopPropagation();
        backToOpen();
        break;
      default:
        // sound / その他はここでは触らない
        break;
    }
  }

  // ───────────────────────────────
  // 初期化：ラベル変更＋全体クリック監視
  // ───────────────────────────────
  function onReady(){
    console.log('[read.js] onReady');

      // ▼ ひらがな50音コンポーネント（hira50.js）初期化
  if (window.Hira50 && document.getElementById('openPage')){
    // 他のアプリからも参照できるようにグローバルへも残しておく
    window.Hira50Instance = window.Hira50.init({
      root: document.getElementById('openPage')
      // onStart は後で ReadEngine とつなぐ。今はデフォルト動作（coursePageへ）でOK。
    });
  }

  // footer の primary ラベルを「🔁 もういちど」に変更（存在すれば）
    const primaryBtn = document.querySelector('[data-role="primary"]');
    if (primaryBtn){
      primaryBtn.textContent = '🔁 もういちど';
    }

    // 画面全体で [data-role] 付き要素のクリックを監視（キャプチャ段階）
    document.addEventListener('click', function(e){
      const btn = e.target.closest('[data-role]');
      if (!btn) return;

      const role = btn.getAttribute('data-role');
      if (!role) return;

      console.debug('[read.js] data-role clicked:', role);
      handleRoleClick(role, e);
    }, true);
  }

  // DOM 準備後に初期化
  if (document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', onReady, { once:true });
  }else{
    onReady();
  }
})();
