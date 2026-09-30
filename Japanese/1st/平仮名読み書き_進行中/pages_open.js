/* pages_open.js – Open(50音)ページ：UI再構築の実体 */
(function(){
  "use strict";

  // 便利関数
  function el(id){ return document.getElementById(id); }
  function data(){ return window.OpenPageData || {}; }

  // 行ボタン / 段ボタンの参照をここで管理
  var rowBtnMap  = new Map();
  var danBtnList = [];

  // 1マス作成
  function makeCell(ch, extra){
    var cell = document.createElement("div");
    cell.className = "cell" + (extra?(" "+extra):"") + (ch===""?" empty":"");
    if (ch !== ""){
      cell.textContent = ch;
      cell.addEventListener("click", function(){
        if (cell.classList.contains("placeholder")) return;
        var selected = data().selected;
        if (selected.has(ch)){ selected.delete(ch); cell.classList.remove("selected"); }
        else { selected.add(ch); cell.classList.add("selected"); }
        updateCount();
        updateGroupPressedStates();
      });
    }
    return cell;
  }

  // 50音のグリッド
  function buildGrid(){
    var columns = data().columns || [];
    var gridEl  = el("grid");
    gridEl.innerHTML = "";
    var rows=5, cols=columns.length;
    for (var r=0; r<rows; r++){
      for (var c=cols-1; c>=0; c--){
        var col = columns[c];
        var ch  = col.chars[r] || "";
        // や/わ の空きを い/う/え の薄字プレースホルダで埋める
        if (ch==="" && (col.key==="ya"||col.key==="wa") && (r===1||r===2||r===3)){
          ch = (r===1?"い" : r===2?"う" : "え");
          gridEl.appendChild(makeCell(ch,"placeholder")); continue;
        }
        // ん列の下4マスは見た目だけの空き
        if (col.key==="n" && r>0){
          var hidden = document.createElement("div");
          hidden.className = "cell n-hidden";
          gridEl.appendChild(hidden); continue;
        }
        gridEl.appendChild(makeCell(ch));
      }
    }
  }

  // 行（わ行/ら行…）ボタン
  function buildRowBar(){
    var columns = data().columns || [];
    var rowBar  = el("rowBar");
    rowBtnMap.clear();
    rowBar.innerHTML = "";
    rowBar.appendChild(Object.assign(document.createElement("div"), {className:"row-spacer"}));

    ["wa","ra","ya","ma","ha","na","ta","sa","ka","a"].forEach(function(key){
      var col = columns.find(function(c){ return c.key===key; });
      if (!col) return;
      var b = document.createElement("button");
      b.className = "rowbtn";
      b.textContent = col.label;
      b.title = col.chars.filter(Boolean).join(" ");
      b.addEventListener("click", function(){
        var selected = data().selected;
        var base = col.chars.filter(Boolean);
        var chars = (key==="wa") ? base.concat(["ん"]) : base;
        var hasAll = chars.every(function(ch){ return selected.has(ch); });
        chars.forEach(function(ch){ if(hasAll) selected.delete(ch); else selected.add(ch); });
        refreshGridSelections(); updateCount(); setPressed(b,!hasAll);
        updateGroupPressedStates();
      });
      rowBar.appendChild(b);
      rowBtnMap.set(key, b);
    });
  }

  // 段（あ段/い段…）ボタン
  function buildDanCol(){
    var columns = data().columns || [];
    var danList = data().danList || [];
    var danCol  = el("danCol");
    danCol.innerHTML = "";
    danBtnList.length = 0;

    danList.forEach(function(d){
      var b = document.createElement("button");
      b.className = "danbtn";
      b.textContent = d.label;
      b.addEventListener("click", function(){
        var selected = data().selected;
        var chars = columns.map(function(col){ return col.chars[d.idx]; }).filter(Boolean);
        var hasAll = chars.every(function(ch){ return selected.has(ch); });
        chars.forEach(function(ch){ if(hasAll) selected.delete(ch); else selected.add(ch); });
        refreshGridSelections(); updateCount(); setPressed(b,!hasAll);
        updateGroupPressedStates();
      });
      danCol.appendChild(b);
      danBtnList.push({ idx:d.idx, el:b });
    });
  }

  // セルの選択ハイライト
  function refreshGridSelections(){
    var selected = data().selected;
    el("grid").querySelectorAll(".cell:not(.empty):not(.placeholder)").forEach(function(cell){
      var ch = cell.textContent.trim();
      if (selected.has(ch)) cell.classList.add("selected");
      else                  cell.classList.remove("selected");
    });
  }

  // 行・段ボタンの押下状態
  function updateGroupPressedStates(){
    var columns  = data().columns || [];
    var selected = data().selected;

    ["wa","ra","ya","ma","ha","na","ta","sa","ka","a"].forEach(function(key){
      var col = columns.find(function(c){ return c.key===key; });
      if(!col) return;
      var base  = col.chars.filter(Boolean);
      var chars = (key==="wa") ? base.concat(["ん"]) : base;
      var hasAll = chars.length>0 && chars.every(function(ch){ return selected.has(ch); });
      var btn = rowBtnMap.get(key);
      if (btn) setPressed(btn, hasAll);
    });

    danBtnList.forEach(function(o){
      var chars = columns.map(function(col){ return col.chars[o.idx]; }).filter(Boolean);
      var hasAll = chars.length>0 && chars.every(function(ch){ return selected.has(ch); });
      setPressed(o.el, hasAll);
    });
  }

  // カウント表示
  function updateCount(){
    var elc = el("selCount");
    if (!elc) return;
    var selected = data().selected;
    elc.textContent = String(selected ? selected.size : 0);
  }

  // 右列の高さ合わせ
  function syncRightColHeight(){
    var p = el("danPanel");
    var u = el("utilCol");
    if (!p || !u) return;
    u.style.height = p.offsetHeight + "px";
    u.style.justifyContent = "space-between";
  }

  // 公開API
  function rebuild(){
    buildRowBar();
    buildGrid();
    buildDanCol();
    refreshGridSelections();
    updateCount();
    syncRightColHeight();
    console.log("[pages_open] rebuilt selectors*");
  }

  // ←ここを置き換え
  window.PagesOpen = {
    init: function(){ console.log("[pages_open] init"); },
    rebuildSelectors: rebuild,
    // ここから4つを“外から呼べる”ように公開
    refreshGridSelections: refreshGridSelections,
    updateGroupPressedStates: updateGroupPressedStates,
    updateCount: updateCount,
    syncRightColHeight: syncRightColHeight
  };

  document.addEventListener("DOMContentLoaded", function(){
    console.log("[pages_open] loaded & ready");
    if (window.PagesOpen && typeof window.PagesOpen.init === "function"){
      window.PagesOpen.init();
    }
    // 初期表示は HTML 側で構築済み。必要なら次の行のコメントを外すとこちらで再構築できます。
    // rebuild();
  });
})();
