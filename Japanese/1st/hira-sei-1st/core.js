/* core.js – 共通状態＆ユーティリティ */
(function(){
  "use strict";

  // ===== 共通状態 =====
  const AppState = {
    mmScale: 3.78,              // 1mm ≒ 3.78px
    selected: new Set(),        // 50音の選択セット
  };

  // ===== ユーティリティ =====
  function pxOf(mm){ return Math.round(mm * (AppState.mmScale || 3.78)); }
  function isKana(ch){ return /^[ぁ-ん]$/.test(ch||""); }

  // 50音の母集団
  function getAllKanaPool(){
    const cols = (window.OpenPageData && OpenPageData.columns) ? OpenPageData.columns : [];
    const pool = [];
    cols.forEach(c => (c.chars||[]).forEach(ch => { if (isKana(ch)) pool.push(ch); }));
    return pool;
  }

  // 選択セットから問題列を作る（足りなければプールから補充）
  function buildQuestionQueue(total=5){
    const chosen = Array.from(AppState.selected).filter(isKana);
    const pool = getAllKanaPool();
    const out = [];
    const src = (chosen.length>0 ? chosen : pool).slice();
    // ランダム化
    for(let i=src.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [src[i],src[j]]=[src[j],src[i]]; }
    for(let i=0;i<total && i<src.length;i++) out.push(src[i]);
    // まだ足りなければ先頭から補充
    let k=0; while(out.length<total && pool.length>0){ out.push(pool[k%pool.length]); k++; }
    return out;
  }

  // ===== Openページ用データ（縦書き右→左の並び順で用意） =====
  window.OpenPageData = window.OpenPageData || {};
  OpenPageData.selected = AppState.selected;  // 共有
  OpenPageData.columns = [
    { label:"あ行", key:"a",  chars:["あ","い","う","え","お"] },
    { label:"か行", key:"ka", chars:["か","き","く","け","こ"] },
    { label:"さ行", key:"sa", chars:["さ","し","す","せ","そ"] },
    { label:"た行", key:"ta", chars:["た","ち","つ","て","と"] },
    { label:"な行", key:"na", chars:["な","に","ぬ","ね","の"] },
    { label:"は行", key:"ha", chars:["は","ひ","ふ","へ","ほ"] },
    { label:"ま行", key:"ma", chars:["ま","み","む","め","も"] },
    { label:"や行", key:"ya", chars:["や","","ゆ","","よ"] },
    { label:"ら行", key:"ra", chars:["ら","り","る","れ","ろ"] },
    { label:"わ行", key:"wa", chars:["わ","","","","を"] },
    { label:"ん",   key:"n",  chars:["ん"] }
  ];

  // ===== 公開 =====
  window.AppState = AppState;
  window.pxOf = pxOf;
  window.isKana = isKana;
  window.getAllKanaPool = getAllKanaPool;
  window.buildQuestionQueue = buildQuestionQueue;

  document.addEventListener('DOMContentLoaded', ()=>console.log('[core] ready'));
})();
