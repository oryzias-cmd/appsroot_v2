// jpcommon/shell/header.js
// 右端ヘッダー帯（薄赤）のテキスト制御レゴ
(function(){
  const TID = 'jpnHeaderTitle';
  const MID = 'jpnHeaderMount';

  function ensureTitleEl(){
    // 1) まず mount の中に作る（最優先）
    const mount = document.getElementById(MID);
    if (mount){
      let el = document.getElementById(TID);
      if (el) return el;
      el = document.createElement('div');
      el.id = TID;
      mount.appendChild(el);
      return el;
    }

    // 2) mount が無ければ v-header 直下に作る（保険）
    const host = document.querySelector('.v-header');
    if (!host) return null;

    let el = document.getElementById(TID);
    if (el) return el;

    el = document.createElement('div');
    el.id = TID;
    host.appendChild(el);
    return el;
  }

  function ensureBacklinkEl(){
    const host = document.querySelector('.v-side-top');
    if (!host) return null;

    let el = document.getElementById('entryBacklink');
    if (el) return el;

    el = host.querySelector('a.backlink');
    if (el) return el;

    el = document.createElement('a');
    el.id = 'entryBacklink';
    el.className = 'backlink';
    el.href = '#';
    el.textContent = 'もどる';
    host.appendChild(el);
    return el;
  }

  const api = {
    setTitle(text){
      const el = ensureTitleEl();
      if (!el) return;
      el.textContent = (text ?? '国語');
    },
    // 学年・単元などをパーツ的に差し込む例（必要なら使用）
    setRich({ grade='', unit='', title='' }={}){
      const el = ensureTitleEl();
      if (!el) return;
      const parts = [grade, unit, title].filter(Boolean).join('　');
      el.textContent = parts || '国語';
    },
    setBackHref(href){
      const el = ensureBacklinkEl();
      if (!el) return;
      if (typeof href === 'string' && href) el.href = href;
      if (!String(el.textContent || '').trim()) el.textContent = 'もどる';
    }
  };

  // 初期表示は入れない（チラつき防止）
  // - entry / quiz 側（EntryFull + applyVSideOnce）が必ず setRich で上書きする前提
  // - ここで「国語」を入れると、ロード順や BFCache 復帰で一瞬だけ旧表示が見えてしまう
  document.addEventListener('DOMContentLoaded', function(){
    // no-op
  });

  window.JpnHeader = api;
})();
